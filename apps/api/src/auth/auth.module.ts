import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, RolesService, SupabaseAuthGuard, RolesGuard],
  exports: [AuthService, RolesService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
