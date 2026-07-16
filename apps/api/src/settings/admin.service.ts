import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlogService, ServicesService, PortfolioService, TeamService, ReviewsService } from '../content';
import { parseJson } from './settings-utils';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blog: BlogService,
    private readonly services: ServicesService,
    private readonly portfolio: PortfolioService,
    private readonly team: TeamService,
    private readonly reviews: ReviewsService,
  ) {}

  async dashboardStats(userId: number) {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalBlogPosts,
      publishedPosts,
      totalPortfolioItems,
      pendingComments,
      totalContacts,
      totalServices,
      totalOrders,
      totalRevenue,
      monthlyRevenue,
      totalDue,
      newContactsThisWeek,
      newContactsThisMonth,
      userGrowth,
      contactGrowth,
      topBlogPosts,
      recentContacts,
    ] = await Promise.all([
      this.prisma.profiles.count({ where: { deleted_at: null } }),
      this.prisma.blog_posts.count({ where: { deleted_at: null } }),
      this.prisma.blog_posts.count({ where: { status: 'published', deleted_at: null } }),
      this.prisma.portfolio_items.count({ where: { deleted_at: null } }),
      this.prisma.comments.count({ where: { status: 'pending' } }),
      this.prisma.contacts.count({ where: { deleted_at: null } }),
      this.prisma.services.count({ where: { deleted_at: null } }),
      this.prisma.orders.count(),
      this.prisma.payments.aggregate({ _sum: { amount: true }, where: { status: { in: ['completed', 'partially_refunded'] } } }).then(r => Number(r._sum.amount || 0)),
      this.prisma.payments.aggregate({ _sum: { amount: true }, where: { status: { in: ['completed', 'partially_refunded'] }, payment_date: { gte: startOfMonth } } }).then(r => Number(r._sum.amount || 0)),
      this.prisma.invoices.aggregate({ _sum: { total_amount: true }, where: { status: { notIn: ['paid', 'cancelled', 'draft'] } } }).then(r => Number(r._sum.total_amount || 0)),
      this.prisma.contacts.count({ where: { created_at: { gte: startOfWeek } } }),
      this.prisma.contacts.count({ where: { created_at: { gte: startOfMonth } } }),
      this.prisma.profiles.count({ where: { created_at: { gte: startOfMonth } } }),
      this.prisma.contacts.count({ where: { created_at: { gte: startOfMonth } } }),
      this.prisma.blog_posts.findMany({ where: { status: 'published', deleted_at: null }, orderBy: { view_count: 'desc' }, take: 5, select: { id: true, title: true, slug: true, view_count: true } }),
      this.prisma.contacts.findMany({ where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 5 }),
    ]);

    const myTasks = await this.prisma.project_tasks.findMany({ where: { assigned_to: userId }, select: { status: true, due_date: true } });
    const myTaskStats = { total: myTasks.length, todo: 0, inProgress: 0, overdue: 0 };
    for (const t of myTasks) {
      if (t.status === 'todo') myTaskStats.todo++;
      if (t.status === 'in_progress') myTaskStats.inProgress++;
      if (t.due_date && new Date(t.due_date) < now && !['done', 'completed'].includes(t.status || '')) myTaskStats.overdue++;
    }

    return { totalUsers, totalBlogPosts, publishedPosts, totalPortfolioItems, pendingComments, totalContacts, totalServices, totalOrders, totalRevenue, monthlyRevenue, totalDue, newContactsThisWeek, newContactsThisMonth, userGrowth, contactGrowth, topBlogPosts, recentContacts, myTaskStats };
  }

  getContentManagement() { return [{ name: 'Home Page', sections: [{ id: 'hero-title', type: 'text', section: 'hero', key: 'title', label: 'Hero Title', value: 'Innovative Digital Solutions for Modern Businesses', description: 'Main heading on the homepage', page: 'home' }, { id: 'hero-subtitle', type: 'rich_text', section: 'hero', key: 'subtitle', label: 'Hero Subtitle', value: 'We transform ideas into powerful digital experiences that drive growth and success.', description: 'Subtitle text below the main heading', page: 'home' }] }]; }
  updateContentManagement() { return { message: 'Content updated successfully' }; }

  // Admin content aliases with legacy envelope transforms
  async adminPosts(query: Record<string, unknown>) {
    const result = await this.blog.findAllAdmin(query);
    return result.posts.map((p: any) => this.mapLegacyPost(p));
  }
  async adminPostById(id: number) { const { post } = await this.blog.findOneAdmin(id); return this.mapLegacyPost(post); }
  async adminCategories() { return (await this.blog.findAllAdmin({})).posts.flatMap((p: any) => p.categories || []).filter((v, i, a) => a.indexOf(v) === i); }
  async adminPortfolio(query: Record<string, unknown>) { const result = await this.portfolio.findAllAdmin(query); return result.items; }
  async adminPortfolioById(id: number) { return this.portfolio.findOneAdmin(id); }
  async adminServices(query: Record<string, unknown>) { const result = await this.services.findAllAdmin(query); return result.items; }
  async adminServiceById(id: number) { return this.services.findOneAdmin(id); }
  async adminTeam() { return this.team.findAllAdmin(); }
  async adminTeamById(id: number) { return this.team.findById(id); }
  async adminReviews(query: Record<string, unknown>) { const result = await this.reviews.findAllAdmin(query); return result; }

  adminServiceDetail(slug: string) {
    return {
      slug,
      title: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      headerImage: '/images/work/project1.jpg',
      pricing: { superTitle: '/ pricing /', title: 'Simple and flexible pricing.', tiers: [{ name: 'Basic', subtitle: 'Perfect for small businesses', price: '$99', priceSuffix: '/month', features: ['Feature 1', 'Feature 2', 'Feature 3'], cta: 'Get started', ctaHref: '/contact', isPopular: false }] },
    };
  }
  updateAdminServiceDetail(_slug: string) { return { message: 'Service detail updated successfully' }; }

  private mapLegacyPost(post: any) {
    const categories = parseJson(post.categories, []);
    const authorName = post.author ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() : 'Unknown';
    return { id: post.id, title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, status: post.status, author: authorName, category: categories.length ? categories[0] : 'General', cover_image: post.featured_image, featured_image: post.featured_image, created_at: post.created_at, updated_at: post.updated_at, published_at: post.published_at };
  }
}
