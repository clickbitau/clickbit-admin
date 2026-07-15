import { Injectable } from '@nestjs/common';
import { Profile } from '@clickbit/shared';
import {
  ROLE_PERMISSIONS,
  ROLE_TOKENS,
  TASK_STAFF_TEMPLATE_KEYS,
} from './roles.config';

function normalizeRole(role: unknown): string {
  if (typeof role === 'string') return role.trim().toLowerCase();
  if (typeof role === 'number') return String(role).trim().toLowerCase();
  return '';
}

function normalizeCustomPermissions(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.permissions) &&
        parsed.permissions.length > 0
      ) {
        return parsed.permissions;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const inner =
      (raw as { permissions?: string[]; grants?: string[] }).permissions ??
      (raw as { permissions?: string[]; grants?: string[] }).grants;
    if (Array.isArray(inner) && inner.length > 0) return inner;
  }
  return null;
}

@Injectable()
export class RolesService {
  hasPermission(role: string, permission: string): boolean {
    if (!ROLE_PERMISSIONS[role]) return false;
    if (role === 'admin') return true;
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  checkPermissionForUser(user: Profile, permission: string): boolean {
    const roleNorm = normalizeRole(user.role);
    if (roleNorm === 'admin') return true;

    if (ROLE_TOKENS.includes(permission)) {
      return roleNorm === permission;
    }

    const custom = normalizeCustomPermissions(user.permissions);
    if (custom) {
      if (custom.includes(permission)) return true;
      if (
        roleNorm === 'employee' &&
        this.hasPermission('employee', permission)
      ) {
        return true;
      }
      if (
        ['manager', 'agent'].includes(roleNorm) &&
        TASK_STAFF_TEMPLATE_KEYS.includes(permission) &&
        this.hasPermission(roleNorm, permission)
      ) {
        return true;
      }
      return false;
    }

    return this.hasPermission(roleNorm, permission);
  }

  userHasAnyPermission(user: Profile, permissions: string[]): boolean {
    return permissions.some((p) => this.checkPermissionForUser(user, p));
  }
}
