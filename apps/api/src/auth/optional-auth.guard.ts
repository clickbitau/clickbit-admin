import { Injectable, ExecutionContext } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Injectable()
export class OptionalAuthGuard extends SupabaseAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const hasToken =
      (authHeader && authHeader.startsWith('Bearer ')) ||
      (typeof request.query?.token === 'string' && request.query.token.length > 0);
    if (!hasToken) {
      return true;
    }
    try {
      return await super.canActivate(context);
    } catch {
      // Invalid or expired token on an optional-auth route: allow the request
      // through as an anonymous user. Public endpoints should not break just
      // because a stale client token is still attached.
      return true;
    }
  }
}
