import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/settings.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('team')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'employee', 'agent')
  getTeam() { return this.usersService.findTeam(); }

  @Get('managers')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  getManagers() { return this.usersService.findManagers(); }

  @Get('permissions/available')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  availablePermissions() { return this.usersService.availablePermissions(); }

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getUsers(@Query() query: Record<string, unknown>, @Req() req: Request) { return this.usersService.findAll(query, req.user as any); }

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  createUser(@Body() dto: CreateUserDto, @Req() req: Request) { return this.usersService.create(dto as any, req.user as any); }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  getUser(@Param('id') id: string, @Req() req: Request) { return this.usersService.findById(Number(id), req.user as any); }

  @Put(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) { return this.usersService.update(Number(id), dto as any, req.user as any); }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  deleteUser(@Param('id') id: string, @Req() req: Request) { return this.usersService.remove(Number(id), req.user as any); }

  @Get(':id/account-status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  accountStatus(@Param('id') id: string) { return this.usersService.accountStatus(Number(id)); }

  @Post(':id/resend-welcome')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  resendWelcome(@Param('id') id: string) { return this.usersService.resendWelcome(Number(id)); }

  @Post(':id/reset-2fa')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  reset2fa(@Param('id') id: string) { return this.usersService.reset2fa(Number(id)); }

  @Post(':id/avatar')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.usersService.uploadAvatar(Number(id), file, req.user as any);
  }

  @Delete(':id/avatar')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  deleteAvatar(@Param('id') id: string, @Req() req: Request) { return this.usersService.deleteAvatar(Number(id), req.user as any); }

  @Get(':id/permissions')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  getPermissions(@Param('id') id: string) { return this.usersService.getPermissions(Number(id)); }

  @Put(':id/permissions')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  updatePermissions(@Param('id') id: string, @Body() body: { permissions?: string[] }) { return this.usersService.updatePermissions(Number(id), body.permissions || []); }

  @Delete(':id/permissions')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  resetPermissions(@Param('id') id: string) { return this.usersService.resetPermissions(Number(id)); }
}
