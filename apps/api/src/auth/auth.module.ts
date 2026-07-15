import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';

@Module({
  providers: [RolesService, SupabaseAuthGuard, RolesGuard],
  exports: [RolesService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
