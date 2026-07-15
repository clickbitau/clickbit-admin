import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';

function isSupabaseToken(token: string): boolean {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && typeof decoded === 'object' && decoded.payload) {
      const payload = decoded.payload as JwtPayload;
      return (
        typeof payload.iss === 'string' &&
        payload.iss.includes('supabase.co') &&
        payload.role === 'authenticated'
      );
    }
  } catch {
    // If decode fails, assume it's not a Supabase token
  }
  return false;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    let token: string | undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof request.query?.token === 'string') {
      token = request.query.token;
    }

    if (!token) {
      throw new UnauthorizedException({
        success: false,
        message: 'Not authorized, no token',
      });
    }

    // Service tokens (cb_*) are reserved for future service-to-service auth.
    if (token.startsWith('cb_')) {
      throw new UnauthorizedException({
        success: false,
        message: 'Service token authentication not yet migrated',
      });
    }

    if (isSupabaseToken(token)) {
      return this.authenticateSupabaseToken(request, token);
    }

    return this.authenticateCustomJwt(request, token);
  }

  private async authenticateSupabaseToken(
    request: Request,
    token: string,
  ): Promise<boolean> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.config.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new InternalServerErrorException({
        message: 'Supabase Auth is not configured',
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: WebSocket as any,
      },
    });

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        throw new UnauthorizedException({
          success: false,
          message: 'Not authorized, token failed',
        });
      }

      const supabaseUser = data.user;

      let profile = await this.prisma.profiles.findFirst({
        where: { auth_uid: supabaseUser.id },
      });

      if (!profile && supabaseUser.email) {
        profile = await this.prisma.profiles.findFirst({
          where: { email: supabaseUser.email.trim() },
        });
        if (profile) {
          profile = await this.prisma.profiles.update({
            where: { id: profile.id },
            data: { auth_uid: supabaseUser.id },
          });
        }
      }

      if (!profile) {
        throw new UnauthorizedException({
          success: false,
          message: 'Not authorized, user not found',
        });
      }

      request.user = profile as Profile;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      console.error('Supabase token verification failed:', err);
      throw new UnauthorizedException({
        success: false,
        message: 'Not authorized, token failed',
      });
    }
  }

  private async authenticateCustomJwt(
    request: Request,
    token: string,
  ): Promise<boolean> {
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new InternalServerErrorException({
        message: 'JWT secret is not configured',
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { id: number | string };
      const profile = await this.prisma.profiles.findUnique({
        where: { id: Number(decoded.id) },
      });

      if (!profile) {
        throw new UnauthorizedException({
          success: false,
          message: 'Not authorized, user not found',
        });
      }

      request.user = profile as Profile;
      return true;
    } catch (err) {
      console.error('Custom JWT verification failed:', err);
      throw new UnauthorizedException({
        success: false,
        message: 'Not authorized, token failed',
      });
    }
  }
}
