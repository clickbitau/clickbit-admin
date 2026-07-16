import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamService } from './team.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/content.dto';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list() {
    return this.teamService.listPublic();
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.findById(id);
  }

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminAll() {
    return this.teamService.findAllAdmin();
  }

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  create(@Body() dto: CreateTeamDto) {
    return this.teamService.create(dto as unknown as Record<string, unknown>);
  }

  @Put(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.remove(id);
  }
}
