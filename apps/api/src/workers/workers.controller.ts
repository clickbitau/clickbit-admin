import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkersService } from './workers.service';

@Controller('workers')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('status')
  status() {
    return this.workersService.getStatus();
  }

  @Post('run')
  async run() {
    const results = await this.workersService.runAll();
    return { success: true, results };
  }
}
