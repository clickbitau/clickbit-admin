import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('data')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminData(@Req() req: Request) {
    const user = req.user as any;
    return { success: true, message: 'You have accessed the admin-only route!', user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role } };
  }

  @Get('dashboard/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  dashboardStats(@Req() req: Request) { return this.adminService.dashboardStats((req.user as any).id); }

  @Get('content-management')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getContentManagement() { return this.adminService.getContentManagement(); }

  @Put('content-management')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateContentManagement(@Body() _body: any) { return this.adminService.updateContentManagement(); }

  @Get('posts')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminPosts(@Query() query: Record<string, unknown>) { return this.adminService.adminPosts(query); }

  @Get('posts/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminPostById(@Param('id') id: string) { return this.adminService.adminPostById(Number(id)); }

  @Get('categories')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminCategories() { return this.adminService.adminCategories(); }

  @Get('portfolio')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminPortfolio(@Query() query: Record<string, unknown>) { return this.adminService.adminPortfolio(query); }

  @Get('portfolio/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminPortfolioById(@Param('id') id: string) { return this.adminService.adminPortfolioById(Number(id)); }

  @Get('services')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminServices(@Query() query: Record<string, unknown>) { return this.adminService.adminServices(query); }

  @Get('services/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminServiceById(@Param('id') id: string) { return this.adminService.adminServiceById(Number(id)); }

  @Get('services/:slug/detail')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminServiceDetail(@Param('slug') slug: string) { return this.adminService.adminServiceDetail(slug); }

  @Put('services/:slug/detail')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateAdminServiceDetail(@Param('slug') slug: string, @Body() _body: any) { return this.adminService.updateAdminServiceDetail(slug); }

  @Get('team')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminTeam() { return this.adminService.adminTeam(); }

  @Get('team/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminTeamById(@Param('id') id: string) { return this.adminService.adminTeamById(Number(id)); }

  @Get('reviews')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminReviews(@Query() query: Record<string, unknown>) { return this.adminService.adminReviews(query); }
}
