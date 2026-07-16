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
    return super.canActivate(context);
  }
}
