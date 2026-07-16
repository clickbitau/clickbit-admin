import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { asJson, buildMessageEnvelope, numberValue, parseJson, slugify, stringValue } from './content-utils';

const profileSelect = { id: true, first_name: true, last_name: true };

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: Record<string, unknown>) {
    const where: any = { status: 'published', deleted_at: null };
    const search = stringValue(query.search);
    const category = stringValue(query.category);
    const tag = stringValue(query.tag);
    if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { content: { contains: search, mode: 'insensitive' } }, { excerpt: { contains: search, mode: 'insensitive' } }];
    if (category) where.categories = { contains: category, mode: 'insensitive' };
    if (tag) where.tags = { contains: tag, mode: 'insensitive' };
    const limit = numberValue(query.limit, 0);
    const offset = numberValue(query.offset, 0);
    const [total, posts] = await this.prisma.$transaction([
      this.prisma.blog_posts.count({ where }),
      this.prisma.blog_posts.findMany({ where, include: { profiles: { select: profileSelect } }, orderBy: { published_at: 'desc' }, ...(limit ? { skip: offset, take: limit } : {}) }),
    ]);
    return { posts: posts.map((p: any) => this.mapBlog(p)), pagination: { total, limit: limit || null, offset, hasMore: limit ? offset + posts.length < total : false } };
  }

  async featured(query: Record<string, unknown>) {
    const limit = numberValue(query.limit, 3);
    const posts = await this.prisma.blog_posts.findMany({ where: { status: 'published', featured: true, deleted_at: null }, include: { profiles: { select: profileSelect } }, orderBy: { published_at: 'desc' }, take: limit });
    return posts.map((p: any) => this.mapBlog(p));
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.blog_posts.findFirst({ where: { slug, status: 'published', deleted_at: null }, include: { profiles: { select: profileSelect } } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    await this.prisma.blog_posts.update({ where: { id: post.id }, data: { view_count: { increment: 1 } } });
    return this.mapBlog(post as any);
  }

  async getComments(slug: string) {
    const post = await this.prisma.blog_posts.findFirst({ where: { slug, status: 'published', deleted_at: null }, select: { id: true, allow_comments: true } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    if (!post.allow_comments) return { comments: [], commentsDisabled: true, totalCount: 0 };
    const comments = await this.prisma.comments.findMany({ where: { post_id: post.id, status: 'approved', parent_id: null }, orderBy: { created_at: 'desc' } });
    return { comments, commentsDisabled: false, totalCount: comments.length };
  }

  async createComment(slug: string, dto: Record<string, unknown>) {
    const authorName = stringValue(dto.author_name).trim();
    const authorEmail = stringValue(dto.author_email).trim().toLowerCase();
    const content = stringValue(dto.content).trim();
    const parentId = dto.parent_id ? numberValue(dto.parent_id) : null;
    if (!authorName || !authorEmail || !content) throw new BadRequestException({ message: 'Name, email, and comment content are required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authorEmail)) throw new BadRequestException({ message: 'Invalid email address' });
    if (content.length < 3) throw new BadRequestException({ message: 'Comment is too short' });
    if (content.length > 2000) throw new BadRequestException({ message: 'Comment is too long (max 2000 characters)' });

    const post = await this.prisma.blog_posts.findFirst({ where: { slug, status: 'published', deleted_at: null }, select: { id: true, allow_comments: true } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    if (!post.allow_comments) throw new BadRequestException({ message: 'Comments are disabled for this post' });
    if (parentId) {
      const parent = await this.prisma.comments.findFirst({ where: { id: parentId, post_id: post.id, status: 'approved' } });
      if (!parent) throw new NotFoundException({ message: 'Parent comment not found' });
    }

    const comment = await this.prisma.comments.create({
      data: { content, author_name: authorName, author_email: authorEmail, post_id: post.id, parent_id: parentId || null, status: 'pending', created_at: new Date(), updated_at: new Date() },
    });
    return { message: 'Your comment has been submitted and is awaiting moderation', comment: { id: comment.id, author_name: comment.author_name, content: comment.content, created_at: comment.created_at, status: comment.status } };
  }

  async findAllAdmin(query: Record<string, unknown>) {
    const where: any = { deleted_at: null };
    const status = stringValue(query.status);
    const author = numberValue(query.author, 0) || undefined;
    const search = stringValue(query.search);
    if (status && status !== 'all') where.status = status;
    if (author) where.author_id = author;
    if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { content: { contains: search, mode: 'insensitive' } }, { excerpt: { contains: search, mode: 'insensitive' } }];
    const limit = numberValue(query.limit, 50);
    const offset = numberValue(query.offset, 0);
    const [total, posts] = await this.prisma.$transaction([
      this.prisma.blog_posts.count({ where }),
      this.prisma.blog_posts.findMany({ where, include: { profiles: { select: profileSelect } }, orderBy: { created_at: 'desc' }, skip: offset, take: limit }),
    ]);
    return { posts: posts.map((p: any) => this.mapBlog(p)), pagination: { total, limit, offset, hasMore: offset + posts.length < total } };
  }

  async findOneAdmin(id: number) {
    const post = await this.prisma.blog_posts.findUnique({ where: { id }, include: { profiles: { select: profileSelect } } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    return { post: this.mapBlog(post as any) };
  }

  async create(user: Profile, dto: Record<string, unknown>) {
    const data: any = this.buildBlogData(dto, user.id);
    const created = await this.prisma.blog_posts.create({ data });
    const post = await this.prisma.blog_posts.findUnique({ where: { id: created.id }, include: { profiles: { select: profileSelect } } });
    return { message: 'Blog post created successfully', post: this.mapBlog(post as any) };
  }

  async update(id: number, dto: Record<string, unknown>) {
    const post = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    const data: any = this.buildBlogData(dto, undefined, true);
    if (data.status === 'published' && post.status !== 'published' && !data.published_at) data.published_at = new Date();
    await this.prisma.blog_posts.update({ where: { id }, data });
    const refreshed = await this.prisma.blog_posts.findUnique({ where: { id }, include: { profiles: { select: profileSelect } } });
    return { message: 'Blog post updated successfully', post: this.mapBlog(refreshed as any) };
  }

  async remove(id: number) {
    const post = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!post) throw new NotFoundException({ message: 'Blog post not found' });
    await this.prisma.blog_posts.update({ where: { id }, data: { deleted_at: new Date() } });
    return buildMessageEnvelope('Blog post deleted successfully');
  }

  async stats() {
    const [total, published, draft, featured] = await this.prisma.$transaction([
      this.prisma.blog_posts.count({ where: { deleted_at: null } }),
      this.prisma.blog_posts.count({ where: { deleted_at: null, status: 'published' } }),
      this.prisma.blog_posts.count({ where: { deleted_at: null, status: 'draft' } }),
      this.prisma.blog_posts.count({ where: { deleted_at: null, featured: true } }),
    ]);
    return { total, published, draft, featured };
  }

  private buildBlogData(dto: Record<string, unknown>, authorId?: number, partial = false) {
    const title = stringValue(dto.title);
    const slug = stringValue(dto.slug) || (title ? slugify(title) : undefined);
    const status = stringValue(dto.status, 'draft');
    const data: any = {
      title: partial ? (dto.title !== undefined ? title : undefined) : (title || undefined),
      slug: partial ? (dto.slug !== undefined ? stringValue(dto.slug) : undefined) : slug,
      content: dto.content !== undefined ? stringValue(dto.content) : undefined,
      excerpt: dto.excerpt !== undefined ? stringValue(dto.excerpt) : undefined,
      featured_image: dto.featured_image !== undefined ? stringValue(dto.featured_image) : undefined,
      status: dto.status !== undefined ? status : undefined,
      published_at: dto.published_at ? new Date(stringValue(dto.published_at)) : undefined,
      scheduled_at: dto.scheduled_at ? new Date(stringValue(dto.scheduled_at)) : undefined,
      meta_title: dto.meta_title !== undefined ? stringValue(dto.meta_title) : undefined,
      meta_description: dto.meta_description !== undefined ? stringValue(dto.meta_description) : undefined,
      meta_keywords: dto.meta_keywords !== undefined ? stringValue(dto.meta_keywords) : undefined,
      tags: dto.tags !== undefined ? asJson(dto.tags, []) : undefined,
      categories: dto.categories !== undefined ? asJson(dto.categories, []) : undefined,
      featured: dto.featured !== undefined ? (dto.featured === true) : undefined,
      allow_comments: dto.allow_comments !== undefined ? (dto.allow_comments !== false) : undefined,
      updated_at: new Date(),
    };
    if (!partial) {
      data.author_id = authorId || null;
      data.created_at = new Date();
      if (status === 'published' && !data.published_at) data.published_at = new Date();
    }
    if (partial) Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    return data;
  }

  private mapBlog(post: any) {
    const result: any = { ...post, author: post.profiles };
    result.tags = parseJson(post.tags, []);
    result.categories = parseJson(post.categories, []);
    delete result.profiles;
    return result;
  }
}
