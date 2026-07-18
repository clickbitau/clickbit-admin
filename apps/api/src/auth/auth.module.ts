import { Global, Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasskeysService } from './passkeys.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasskeysService, RolesService, SupabaseAuthGuard, RolesGuard],
  exports: [AuthService, PasskeysService, RolesService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
