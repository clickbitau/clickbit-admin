import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto, CreateCommentDto, ListContentQueryDto } from './dto/content.dto';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('admin/all')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminAll(@Query() query: ListContentQueryDto) {
    return this.blogService.findAllAdmin(query as unknown as Record<string, unknown>);
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminStats() {
    return this.blogService.stats();
  }

  @Get('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  adminOne(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.findOneAdmin(id);
  }

  @Post('admin')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  create(@Req() req: any, @Body() dto: CreateBlogPostDto) {
    return this.blogService.create(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto as unknown as Record<string, unknown>);
  }

  @Delete('admin/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.blogService.remove(id);
  }

  @Get('featured')
  @UseGuards(OptionalAuthGuard)
  featured(@Query() query: Record<string, unknown>) {
    return this.blogService.featured(query);
  }

  @Get(':slug/comments')
  @UseGuards(OptionalAuthGuard)
  comments(@Param('slug') slug: string) {
    return this.blogService.getComments(slug);
  }

  @Post(':slug/comments')
  @UseGuards(OptionalAuthGuard)
  addComment(@Param('slug') slug: string, @Body() dto: CreateCommentDto) {
    return this.blogService.createComment(slug, dto as unknown as Record<string, unknown>);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: Record<string, unknown>) {
    return this.blogService.listPublic(query);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  findBySlug(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }
}
