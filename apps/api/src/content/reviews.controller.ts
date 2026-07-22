import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, ReviewStatusDto, ListContentQueryDto } from './dto/content.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: Record<string, unknown>) {
    return this.reviewsService.listPublic(query);
  }

  @Get('approved')
  @UseGuards(OptionalAuthGuard)
  approved(@Query() query: Record<string, unknown>) {
    return this.reviewsService.listPublic({ ...query, status: 'approved' });
  }

  @Get('featured')
  @UseGuards(OptionalAuthGuard)
  featured(@Query() query: Record<string, unknown>) {
    return this.reviewsService.listPublic({ ...query, featured: 'true' });
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.createPublic(dto as unknown as Record<string, unknown>);
  }
}

@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  findAll(@Query() query: ListContentQueryDto) {
    return this.reviewsService.findAllAdmin(query as unknown as Record<string, unknown>);
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findOneAdmin(id);
  }

  @Get('stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  stats() {
    return this.reviewsService.stats();
  }

  @Put(':id/status')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewStatusDto) {
    return this.reviewsService.updateStatus(id, dto.status);
  }

  @Put(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.remove(id);
  }
}

@Controller('reviews/admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ReviewsAdminLegacyController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll(@Query() query: ListContentQueryDto) {
    return this.reviewsService.findAllAdmin(query as unknown as Record<string, unknown>);
  }

  @Get('stats')
  stats() {
    return this.reviewsService.stats();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findOneAdmin(id);
  }

  @Put(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewStatusDto) {
    return this.reviewsService.updateStatus(id, dto.status);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.remove(id);
  }
}
