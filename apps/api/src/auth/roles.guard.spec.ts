import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import {
  CONTROLLER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
} from './roles.config';
import { PERMISSIONS_KEY, ROLES_KEY } from './roles.decorator';

describe('RolesService.resolveEffectivePermissions', () => {
  const service = new RolesService({} as any);

  it('admin gets the full catalog', () => {
    const perms = service.resolveEffectivePermissions('admin', []);
    expect(perms).toEqual(expect.arrayContaining(DEFAULT_MANAGER_PERMISSIONS));
    expect(perms.length).toBeGreaterThan(DEFAULT_MANAGER_PERMISSIONS.length);
  });

  it('manager with empty custom list gets defaults', () => {
    expect(service.resolveEffectivePermissions('manager', [])).toEqual(
      DEFAULT_MANAGER_PERMISSIONS,
    );
    expect(service.resolveEffectivePermissions('manager', null)).toEqual(
      DEFAULT_MANAGER_PERMISSIONS,
    );
  });

  it('manager with custom list replaces defaults', () => {
    const custom = ['crm:view', 'dashboard:view'];
    expect(service.resolveEffectivePermissions('manager', custom)).toEqual(
      custom,
    );
    expect(
      service.resolveEffectivePermissions('manager', custom),
    ).not.toContain('finance:view');
  });

  it('profileHasAnyPermission uses any-of semantics', () => {
    const profile = { role: 'manager', permissions: ['crm:view'] };
    expect(
      service.profileHasAnyPermission(profile, ['crm:view', 'crm:manage']),
    ).toBe(true);
    expect(
      service.profileHasAnyPermission(profile, ['finance:view', 'finance:manage']),
    ).toBe(false);
    expect(
      service.profileHasAnyPermission(
        { role: 'admin', permissions: [] },
        ['finance:view'],
      ),
    ).toBe(true);
  });
});

describe('RolesGuard manager ACL', () => {
  function makeContext(opts: {
    roles?: string[];
    permissions?: string[];
    controllerName: string;
    user: { id: number; role: string; permissions?: string[] };
  }) {
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === ROLES_KEY) return opts.roles;
        if (key === PERMISSIONS_KEY) return opts.permissions;
        return undefined;
      },
    } as unknown as Reflector;

    const rolesService = {
      hasAnyPermission: jest.fn(async (userId: number, required: string[]) => {
        const svc = new RolesService({} as any);
        // Simulate DB-backed check using the request user payload.
        return svc.profileHasAnyPermission(opts.user, required);
      }),
      profileHasAnyPermission: (profile: any, required: string[]) =>
        new RolesService({} as any).profileHasAnyPermission(profile, required),
    } as unknown as RolesService;

    const guard = new RolesGuard(reflector, rolesService);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({ name: opts.controllerName }),
      switchToHttp: () => ({
        getRequest: () => ({ user: opts.user }),
      }),
    } as any;

    return { guard, rolesService, context };
  }

  it('admin bypasses controller permission map', async () => {
    const { guard, context } = makeContext({
      roles: ['admin', 'manager'],
      controllerName: 'CompaniesController',
      user: { id: 1, role: 'admin', permissions: [] },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('manager with defaults can access CRM controllers', async () => {
    const { guard, context } = makeContext({
      roles: ['admin', 'manager'],
      controllerName: 'CompaniesController',
      user: { id: 2, role: 'manager', permissions: [] },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('manager without finance permission is denied InvoicesController', async () => {
    const { guard, context } = makeContext({
      roles: ['admin', 'manager'],
      controllerName: 'InvoicesController',
      user: {
        id: 3,
        role: 'manager',
        permissions: ['dashboard:view', 'crm:view'],
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('@RequirePermissions overrides CONTROLLER_PERMISSIONS', async () => {
    const { guard, context, rolesService } = makeContext({
      roles: ['admin', 'manager'],
      permissions: ['support:manage'],
      controllerName: 'CompaniesController',
      user: {
        id: 4,
        role: 'manager',
        permissions: ['crm:view', 'crm:manage'],
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rolesService.hasAnyPermission).toHaveBeenCalledWith(4, [
      'support:manage',
    ]);
  });

  it('wrong role is denied before permission check', async () => {
    const { guard, context, rolesService } = makeContext({
      roles: ['admin', 'manager'],
      controllerName: 'CompaniesController',
      user: { id: 5, role: 'employee', permissions: [] },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(/role/i);
    expect(rolesService.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('CONTROLLER_PERMISSIONS map covers CompaniesController', () => {
    expect(CONTROLLER_PERMISSIONS.CompaniesController).toEqual(
      expect.arrayContaining(['crm:view', 'crm:manage']),
    );
  });
});
