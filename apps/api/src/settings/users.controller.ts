import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
}
