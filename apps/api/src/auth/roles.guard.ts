import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY, ROLES_KEY } from './roles.decorator';
import { CONTROLLER_PERMISSIONS } from './roles.config';
import { RolesService } from './roles.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const decoratorPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const controllerName = context.getClass().name;
    const mappedPermissions = CONTROLLER_PERMISSIONS[controllerName];
    const requiredPermissions =
      decoratorPermissions?.length
        ? decoratorPermissions
        : mappedPermissions?.length
          ? mappedPermissions
          : [];

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as
      | { id?: number; role?: string; permissions?: unknown }
      | undefined;

    if (!user) {
      throw new ForbiddenException('Profile not found for authorization');
    }

    const roleNorm = String(user.role || '').trim().toLowerCase();
    if (roleNorm === 'admin') {
      return true;
    }

    if (requiredRoles?.length) {
      const roleOk = requiredRoles.some(
        (role) => role.toLowerCase() === roleNorm,
      );
      if (!roleOk) {
        throw new ForbiddenException(
          `Access denied. Your role ('${user.role}') is not authorized to perform this action.`,
        );
      }
    }

    // Manager ACL: load fresh permissions from DB (auth guard profile cache can be stale).
    if (roleNorm === 'manager' && requiredPermissions.length > 0) {
      const userId = Number(user.id);
      if (!Number.isFinite(userId)) {
        throw new ForbiddenException('Profile not found for authorization');
      }
      const allowed = await this.rolesService.hasAnyPermission(
        userId,
        requiredPermissions,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Access denied. You do not have permission to perform this action.',
        );
      }
    }

    return true;
  }
}
