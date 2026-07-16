import { Controller, Get, Put, Post, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CredentialsService } from './credentials.service';

@Controller('credentials')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Get()
  async getAll() {
    return this.credentialsService.getAll();
  }

  @Get('definitions/all')
  getDefinitions() {
    return this.credentialsService.getDefinitions();
  }

  @Get(':category')
  async getByCategory(@Param('category') category: string) {
    return this.credentialsService.getByCategory(category);
  }

  @Put()
  async bulkUpdate(@Body() body: { updates?: { key: string; value: string }[] }) {
    const updates = body?.updates || [];
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('updates array is required');
    }
    return this.credentialsService.bulkSet(updates);
  }

  @Put(':key')
  async update(@Param('key') key: string, @Body() body: { value?: string }) {
    if (!body || typeof body.value !== 'string') {
      throw new BadRequestException('value is required');
    }
    return this.credentialsService.set(key, body.value);
  }

  @Post('seed')
  async seed() {
    return this.credentialsService.seedFromEnv();
  }

  @Post('test/smtp')
  async testSmtp() {
    return this.credentialsService.testSmtp();
  }
}
