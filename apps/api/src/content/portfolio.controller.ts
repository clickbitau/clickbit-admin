import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto, UpdatePortfolioDto, ListContentQueryDto } from './dto/content.dto';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminAll(@Query() query: ListContentQueryDto) {
    return this.portfolioService.findAllAdmin(query as unknown as Record<string, unknown>);
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminStats() {
    return this.portfolioService.statsAdmin();
  }

  @Get('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminOne(@Param('id', ParseIntPipe) id: number) {
    return this.portfolioService.findOneAdmin(id);
  }

  @Post('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  create(@Body() dto: CreatePortfolioDto) {
    return this.portfolioService.create(dto as unknown as Record<string, unknown>);
  }

  @Put('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePortfolioDto) {
    return this.portfolioService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.portfolioService.remove(id);
  }

  @Get('featured')
  @UseGuards(OptionalAuthGuard)
  featured(@Query() query: Record<string, unknown>) {
    return this.portfolioService.featured(query);
  }

  @Get('categories')
  @UseGuards(OptionalAuthGuard)
  categories() {
    return this.portfolioService.categories();
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: Record<string, unknown>) {
    return this.portfolioService.listPublic(query);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  findBySlug(@Param('slug') slug: string) {
    return this.portfolioService.findBySlug(slug);
  }
}
