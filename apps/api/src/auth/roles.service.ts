import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AVAILABLE_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  ROLE_PERMISSIONS,
  type PermissionGroup,
} from './roles.config';

function allCatalogKeys(): string[] {
  return Object.values(AVAILABLE_PERMISSIONS).flatMap((g) => g.map((p) => p.key));
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((p): p is string => typeof p === 'string')
    : [];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserRole(userId: number): Promise<string | null> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return profile?.role ?? null;
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { permissions: true },
    });
    return asStringList(profile?.permissions);
  }

  /** Sync resolver — used by RolesGuard with the already-loaded profile. */
  resolveEffectivePermissions(
    role: string | null | undefined,
    customPermissions: unknown,
  ): string[] {
    const roleNorm = String(role || '').trim().toLowerCase();
    if (roleNorm === 'admin') return allCatalogKeys();

    const custom = asStringList(customPermissions);

    if (roleNorm === 'manager') {
      return custom.length > 0
        ? [...new Set(custom)]
        : [...DEFAULT_MANAGER_PERMISSIONS];
    }

    return [...(ROLE_PERMISSIONS[roleNorm] || [])];
  }

  /**
   * Effective ACL for API + UI.
   * - Admin: all catalog keys (bypass).
   * - Manager with empty custom list: DEFAULT_MANAGER_PERMISSIONS.
   * - Manager with custom list: that list replaces defaults.
   * - Other roles: ROLE_PERMISSIONS template only.
   */
  async getEffectivePermissions(userId: number): Promise<string[]> {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true },
    });
    if (!profile) return [];
    return this.resolveEffectivePermissions(profile.role, profile.permissions);
  }

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    if (role === 'admin') return true;
    const effective = await this.getEffectivePermissions(userId);
    return effective.includes(permission);
  }

  async hasAnyPermission(
    userId: number,
    permissions: string[],
  ): Promise<boolean> {
    if (!permissions.length) return true;
    const role = await this.getUserRole(userId);
    if (role === 'admin') return true;
    const effective = await this.getEffectivePermissions(userId);
    return permissions.some((p) => effective.includes(p));
  }

  /** Sync any-of check against a loaded profile (RolesGuard). */
  profileHasAnyPermission(
    profile: { role?: string | null; permissions?: unknown },
    permissions: string[],
  ): boolean {
    if (!permissions.length) return true;
    const roleNorm = String(profile.role || '').trim().toLowerCase();
    if (roleNorm === 'admin') return true;
    const effective = this.resolveEffectivePermissions(
      profile.role,
      profile.permissions,
    );
    return permissions.some((p) => effective.includes(p));
  }

  async hasRole(userId: number, roles: string[]): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role !== null && roles.includes(role);
  }

  getAvailablePermissions(): Record<string, PermissionGroup[]> {
    return AVAILABLE_PERMISSIONS;
  }

  getDefaultPermissionsForRole(role: string): string[] {
    if (role === 'manager') return [...DEFAULT_MANAGER_PERMISSIONS];
    return [...(ROLE_PERMISSIONS[role] || [])];
  }

  /**
   * Used when saving custom permissions.
   * Empty custom list means "use role defaults" for managers.
   */
  checkPermissionForUser(
    role: string,
    customPermissions: string[] | null | undefined,
    permission: string,
  ): boolean {
    return this.resolveEffectivePermissions(role, customPermissions).includes(
      permission,
    );
  }
}
