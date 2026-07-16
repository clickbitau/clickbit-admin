import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClickdeployService } from './clickdeploy.service';

@Controller('clickdeploy')
export class ClickdeployController {
  constructor(private readonly clickdeployService: ClickdeployService) {}

  @Post('activate')
  async activate(@Body() body: any) {
    return this.clickdeployService.activate(body || {});
  }

  @Post('heartbeat')
  async heartbeat(@Body() body: any) {
    return this.clickdeployService.heartbeat(body || {});
  }

  @Get('admin/customers')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async listCustomers() {
    return this.clickdeployService.listCustomers();
  }

  @Post('admin/customers')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async createCustomer(@Body() body: any) {
    return this.clickdeployService.createCustomer(body || {});
  }

  @Patch('admin/customers/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async updateCustomer(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.clickdeployService.updateCustomer(id, body || {});
  }

  @Post('admin/codes')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async issueCode(@Body() body: any) {
    return this.clickdeployService.issueCode(body || {});
  }

  @Get('admin/codes/:id/reveal')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async revealCode(@Param('id', ParseIntPipe) id: number) {
    return this.clickdeployService.revealCode(id);
  }

  @Patch('admin/codes/:id/subscription')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async updateSubscription(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.clickdeployService.updateSubscription(id, body || {});
  }

  @Post('admin/codes/:id/revoke')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async revokeCode(@Param('id', ParseIntPipe) id: number) {
    return this.clickdeployService.revokeCode(id);
  }
}
