import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type { Profile } from '@clickbit/shared';
import { CacheService } from '../redis/cache.service';

function getRegisterableDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2 || !hostname.includes('.') || hostname === 'localhost') return hostname;
  return parts.slice(-2).join('.');
}

function rpConfig(config: ConfigService, requestOrigin?: string) {
  const rpName = config.get<string>('WEBAUTHN_RP_NAME') || 'ClickBit';
  const defaultOrigin = (config.get<string>('WEBAUTHN_ORIGIN') || config.get<string>('FRONTEND_URL') || 'https://localhost').replace(/\/$/, '');
  let rpID = config.get<string>('WEBAUTHN_RP_ID') || '';
  if (!rpID) {
    const originToUse = requestOrigin || defaultOrigin;
    try {
      rpID = getRegisterableDomain(new URL(originToUse).hostname);
    } catch {
      rpID = 'localhost';
    }
  }
  if (!rpID) rpID = 'localhost';
  const origin = requestOrigin || defaultOrigin;
  return { rpName, rpID, origin };
}

function challengeOrThrow(body: any): string {
  const challenge = body?.challenge;
  if (!challenge) throw new BadRequestException('challenge is required');
  return challenge;
}

@Injectable()
export class PasskeysService {
  private tablesEnsured = false;

  constructor(private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('passkeys', ...parts) ?? `passkeys:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  private async ensureTables() {
    if (this.tablesEnsured) return;
    const statements = [
      `CREATE TABLE IF NOT EXISTS "passkeys" (
        id SERIAL NOT NULL,
        user_id INTEGER NOT NULL,
        credential_id VARCHAR(255) NOT NULL,
        friendly_name VARCHAR(255),
        credential_public_key BYTEA NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        transports TEXT,
        user_agent VARCHAR(500),
        last_used_at TIMESTAMPTZ(6),
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ(6),
        CONSTRAINT passkeys_pkey PRIMARY KEY (id),
        CONSTRAINT passkeys_credential_id_key UNIQUE (credential_id)
      )`,
      `CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "passkeys"(user_id)`,
      `CREATE INDEX IF NOT EXISTS "passkeys_credential_id_idx" ON "passkeys"(credential_id)`,
      `CREATE TABLE IF NOT EXISTS "passkey_challenges" (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        user_id INTEGER,
        challenge VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        expires_at TIMESTAMPTZ(6) NOT NULL,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT passkey_challenges_pkey PRIMARY KEY (id),
        CONSTRAINT passkey_challenges_challenge_key UNIQUE (challenge)
      )`,
      `CREATE INDEX IF NOT EXISTS "passkey_challenges_challenge_idx" ON "passkey_challenges"(challenge)`,
      `CREATE INDEX IF NOT EXISTS "passkey_challenges_expires_at_idx" ON "passkey_challenges"(expires_at)`,
    ];
    for (const stmt of statements) {
      await this.prisma.$executeRawUnsafe(stmt);
    }
    this.tablesEnsured = true;
  }

  private async saveChallenge(userId: number | null, challenge: string, type: 'registration' | 'login') {
    await this.prisma.passkey_challenges.create({
      data: {
        user_id: userId,
        challenge,
        type,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  }

  private async consumeChallenge(challenge: string, type: 'registration' | 'login') {
    const record = await this.prisma.passkey_challenges.findUnique({ where: { challenge } });
    if (!record) throw new BadRequestException('Invalid or expired challenge');
    if (record.type !== type) throw new BadRequestException('Challenge type mismatch');
    if (record.expires_at < new Date()) {
      await this.prisma.passkey_challenges.delete({ where: { id: record.id } });
      throw new BadRequestException('Challenge expired');
    }
    await this.prisma.passkey_challenges.delete({ where: { id: record.id } });
    return record;
  }

  private issueToken(profile: Profile) {
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new BadRequestException('JWT secret is not configured');
    const accessToken = jwt.sign(
      { id: profile.id, email: profile.email, role: profile.role, first_name: profile.first_name, last_name: profile.last_name },
      jwtSecret,
      { expiresIn: '24h' },
    );
    return { accessToken, refreshToken: accessToken };
  }

  async generateRegistrationOptions(user: Profile, requestOrigin?: string) {
    await this.invalidateCache();

    await this.ensureTables();
    const { rpName, rpID } = rpConfig(this.config, requestOrigin);
    const existing = await this.prisma.passkeys.findMany({
      where: { user_id: user.id, deleted_at: null },
      select: { credential_id: true },
    });

    const opts: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.email,
      userDisplayName: `${user.first_name} ${user.last_name}`.trim() || user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((e) => ({ id: e.credential_id })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };

    const options = await generateRegistrationOptions(opts);
    await this.saveChallenge(user.id, options.challenge, 'registration');
    return { success: true, data: options };
  }

  async verifyRegistration(user: Profile, body: any, requestOrigin?: string) {
    await this.invalidateCache();

    await this.ensureTables();
    const { rpID, origin } = rpConfig(this.config, requestOrigin);
    const record = await this.consumeChallenge(challengeOrThrow(body), 'registration');
    if (record.user_id !== user.id) throw new UnauthorizedException('Challenge does not belong to this user');

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: record.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Passkey registration verification failed');
    }

    const { registrationInfo } = verification;
    if (!registrationInfo) throw new BadRequestException('No registration info returned');

    const { credential } = registrationInfo;
    const existing = await this.prisma.passkeys.findUnique({ where: { credential_id: credential.id } });
    if (existing) throw new BadRequestException('This passkey is already registered');

    const transports = Array.isArray(credential.transports) ? credential.transports.join(',') : (credential.transports as any as string) || undefined;
    const passkey = await this.prisma.passkeys.create({
      data: {
        user_id: user.id,
        credential_id: credential.id,
        friendly_name: body.friendly_name || 'Passkey',
        credential_public_key: Buffer.from(new Uint8Array(credential.publicKey)),
        counter: credential.counter,
        transports,
        user_agent: body.user_agent,
      },
    });

    return { success: true, message: 'Passkey registered', data: { id: passkey.id, credential_id: passkey.credential_id, friendly_name: passkey.friendly_name } };
  }

  async generateLoginOptions(requestOrigin?: string) {
    await this.invalidateCache();

    await this.ensureTables();
    const { rpID } = rpConfig(this.config, requestOrigin);
    const opts: GenerateAuthenticationOptionsOpts = {
      rpID,
      allowCredentials: [],
      userVerification: 'required',
    };
    const options = await generateAuthenticationOptions(opts);
    await this.saveChallenge(null, options.challenge, 'login');
    return { success: true, data: options };
  }

  async verifyLogin(body: any, requestOrigin?: string) {
    await this.invalidateCache();

    await this.ensureTables();
    const { rpID, origin } = rpConfig(this.config, requestOrigin);
    const record = await this.consumeChallenge(challengeOrThrow(body), 'login');

    const credentialId = body.id;
    if (!credentialId) throw new BadRequestException('Credential id is required');

    const passkey = await this.prisma.passkeys.findUnique({ where: { credential_id: credentialId } });
    if (!passkey || passkey.deleted_at) throw new NotFoundException('Passkey not found');

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: record.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credential_id,
          publicKey: new Uint8Array(passkey.credential_public_key),
          counter: passkey.counter,
          transports: passkey.transports ? (passkey.transports.split(',') as any) : undefined,
        },
        requireUserVerification: true,
      });
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Passkey authentication failed');
    }

    if (!verification.verified) throw new UnauthorizedException('Passkey verification failed');

    const profile = await this.prisma.profiles.findUnique({ where: { id: passkey.user_id } });
    if (!profile || profile.deleted_at) throw new NotFoundException('User not found');

    await this.prisma.passkeys.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, last_used_at: new Date() },
    });

    const tokens = this.issueToken(profile as Profile);
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: profile,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      },
    };
  }

  async listPasskeys(user: Profile) {
    return this.cached(this.cacheKey('listPasskeys', user.id), async () => {

      await this.ensureTables();
      const rows = await this.prisma.passkeys.findMany({
        where: { user_id: user.id, deleted_at: null },
        orderBy: { created_at: 'desc' },
      });
      return {
        success: true,
        data: rows.map((p) => ({
          id: p.id,
          credential_id: p.credential_id,
          friendly_name: p.friendly_name,
          user_agent: p.user_agent,
          last_used_at: p.last_used_at,
          created_at: p.created_at,
        })),
      };


    });
}

  async deletePasskey(user: Profile, id: number) {
    await this.invalidateCache();

    await this.ensureTables();
    const passkey = await this.prisma.passkeys.findFirst({ where: { id, user_id: user.id, deleted_at: null } });
    if (!passkey) throw new NotFoundException('Passkey not found');
    await this.prisma.passkeys.update({ where: { id }, data: { deleted_at: new Date() } });
    return { success: true, message: 'Passkey removed' };
  }
}
