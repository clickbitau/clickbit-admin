import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, ListContentQueryDto } from './dto/content.dto';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminAll(@Query() query: ListContentQueryDto) {
    return this.servicesService.findAllAdmin(query as unknown as Record<string, unknown>);
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminStats() {
    return this.servicesService.statsAdmin();
  }

  @Get('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminOne(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.findOneAdmin(id);
  }

  @Post('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto as unknown as Record<string, unknown>);
  }

  @Put('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.remove(id);
  }

  @Get('by-category')
  @UseGuards(OptionalAuthGuard)
  byCategory() {
    return this.servicesService.byCategory();
  }

  @Get('for-project-form')
  @UseGuards(OptionalAuthGuard)
  forProjectForm() {
    return this.servicesService.forProjectForm();
  }

  @Get('product-mapping')
  @UseGuards(OptionalAuthGuard)
  productMapping() {
    return this.servicesService.productMapping();
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: Record<string, unknown>, @Query('mode') mode?: string) {
    return this.servicesService.listPublic(query, mode);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  findBySlug(@Param('slug') slug: string) {
    return this.servicesService.findBySlug(slug);
  }
}
