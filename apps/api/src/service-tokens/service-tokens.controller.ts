import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { ServiceTokensService } from './service-tokens.service';
import { CreateServiceTokenDto } from './dto/service-tokens.dto';

@Controller('service-tokens')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class ServiceTokensController {
  constructor(private readonly serviceTokensService: ServiceTokensService) {}

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.serviceTokensService.findAll(req.user);
  }

  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateServiceTokenDto,
  ) {
    return this.serviceTokensService.create(req.user, dto as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  revoke(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.serviceTokensService.revoke(req.user, id);
  }
}
