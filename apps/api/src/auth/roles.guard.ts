import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { RolesService } from './roles.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Profile not found for authorization');
    }

    const roleNorm = String(user.role || '').trim().toLowerCase();
    if (roleNorm === 'admin') {
      return true;
    }

    if (
      requiredRoles.some(
        (role) => role.toLowerCase() === roleNorm,
      )
    ) {
      return true;
    }

    if (this.rolesService.userHasAnyPermission(user, requiredRoles)) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. Your role ('${user.role}') is not authorized to perform this action.`,
    );
  }
}
