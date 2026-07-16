import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

function toDec(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  return new Decimal(value as any);
}

function paginate(query: any) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

function pick(body: any, fields: string[]) {
  const data: any = {};
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  return data;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private profileSelect = { id: true, first_name: true, last_name: true, email: true, role: true };

  getData(user: any) {
    return {
      success: true,
      message: 'You have accessed the admin-only route!',
      user: {
        id: user?.id,
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null,
        email: user?.email,
        role: user?.role,
      },
    };
  }

  async getDashboardStats() {
    const [contacts, companies, leads, deals, projects, tickets, invoices, orders] = await Promise.all([
      this.prisma.contacts.count({ where: { deleted_at: null } }),
      this.prisma.companies.count({ where: { deleted_at: null } }),
      this.prisma.crm_leads.count(),
      this.prisma.deals.count(),
      this.prisma.crm_projects.count({ where: { deleted_at: null } }),
      this.prisma.tickets.count(),
      this.prisma.invoices.count({ where: { deleted_at: null } }),
      this.prisma.orders.count(),
    ]);
    const revenue = await this.prisma.payments.aggregate({ _sum: { amount: true } });
    return {
      success: true,
      data: {
        contacts,
        companies,
        leads,
        deals,
        projects,
        tickets,
        invoices,
        orders,
        totalRevenue: revenue._sum?.amount ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  async pendingComments() {
    const rows = await this.prisma.comments.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async listComments(query: any) {
    const { page, limit, skip } = paginate(query);
    const status = query.status && query.status !== 'all' ? query.status : undefined;
    const where: any = {};
    if (status) where.status = status;
    const [count, comments] = await Promise.all([
      this.prisma.comments.count({ where }),
      this.prisma.comments.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    const stats = await this.prisma.comments.groupBy({ by: ['status'], _count: { id: true } });
    const statsMap: any = { total: count, pending: 0, approved: 0, rejected: 0 };
    for (const s of stats) statsMap[s.status] = s._count.id;
    return {
      comments,
      stats: statsMap,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  }

  async updateCommentStatus(id: number, status: string) {
    if (!['approved', 'rejected'].includes(status)) throw new BadRequestException('Invalid status');
    const existing = await this.prisma.comments.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comment not found');
    const comment = await this.prisma.comments.update({ where: { id }, data: { status } as any });
    return { success: true, message: `Comment ${status}`, comment };
  }

  async deleteComment(id: number) {
    const comment = await this.prisma.comments.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comments.deleteMany({ where: { parent_id: id } });
    await this.prisma.comments.delete({ where: { id } });
    return { success: true, message: 'Comment deleted successfully' };
  }

  // -------------------------------------------------------------------------
  // Blog posts
  // -------------------------------------------------------------------------
  async listPosts(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.category) where.categories = { contains: String(query.category) };
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search) } },
        { content: { contains: String(query.search) } },
      ];
    }
    const [count, rows] = await Promise.all([
      this.prisma.blog_posts.count({ where }),
      this.prisma.blog_posts.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    return {
      success: true,
      data: rows,
      pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) },
    };
  }

  async getPost(id: number) {
    const row = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Post not found');
    return { success: true, data: row };
  }

  async createPost(body: any, userId: number) {
    const data = pick(body, [
      'title', 'slug', 'content', 'excerpt', 'featured_image', 'status', 'meta_title',
      'meta_description', 'meta_keywords', 'tags', 'categories', 'featured', 'allow_comments',
    ]);
    data.author_id = body.author_id ? Number(body.author_id) : userId;
    if (body.published_at) data.published_at = new Date(body.published_at);
    if (body.scheduled_at) data.scheduled_at = new Date(body.scheduled_at);
    const row = await this.prisma.blog_posts.create({ data });
    return { success: true, data: row };
  }

  async updatePost(id: number, body: any) {
    const existing = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post not found');
    const data = pick(body, [
      'title', 'slug', 'content', 'excerpt', 'featured_image', 'status', 'meta_title',
      'meta_description', 'meta_keywords', 'tags', 'categories', 'featured', 'allow_comments',
    ]);
    if (body.published_at !== undefined) data.published_at = body.published_at ? new Date(body.published_at) : null;
    if (body.scheduled_at !== undefined) data.scheduled_at = body.scheduled_at ? new Date(body.scheduled_at) : null;
    const row = await this.prisma.blog_posts.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async patchPost(id: number, body: any) {
    return this.updatePost(id, body);
  }

  async deletePost(id: number) {
    const existing = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post not found');
    await this.prisma.blog_posts.update({ where: { id }, data: { deleted_at: new Date() } as any });
    return { success: true, message: 'Post deleted' };
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------
  async listCategories() {
    const rows = await this.prisma.categories.findMany({ where: { deleted_at: null }, orderBy: { sort_order: 'asc' } });
    return { success: true, data: rows };
  }

  // -------------------------------------------------------------------------
  // Portfolio
  // -------------------------------------------------------------------------
  async listPortfolio(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = { deleted_at: null };
    if (query.status) where.status = query.status;
    const [count, rows] = await Promise.all([
      this.prisma.portfolio_items.count({ where }),
      this.prisma.portfolio_items.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    return { success: true, data: rows, pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } };
  }

  async getPortfolio(id: number) {
    const row = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Portfolio item not found');
    return { success: true, data: row };
  }

  async createPortfolio(body: any) {
    const data = pick(body, [
      'title', 'slug', 'description', 'short_description', 'featured_image', 'gallery_images',
      'client_name', 'project_url', 'project_date', 'technologies', 'services_provided',
      'status', 'featured', 'category', 'sort_order', 'meta_title', 'meta_description',
    ]);
    if (body.project_date) data.project_date = new Date(body.project_date);
    const row = await this.prisma.portfolio_items.create({ data });
    return { success: true, data: row };
  }

  async updatePortfolio(id: number, body: any) {
    const existing = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Portfolio item not found');
    const data = pick(body, [
      'title', 'slug', 'description', 'short_description', 'featured_image', 'gallery_images',
      'client_name', 'project_url', 'project_date', 'technologies', 'services_provided',
      'status', 'featured', 'category', 'sort_order', 'meta_title', 'meta_description',
    ]);
    if (body.project_date !== undefined) data.project_date = body.project_date ? new Date(body.project_date) : null;
    const row = await this.prisma.portfolio_items.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async patchPortfolio(id: number, body: any) {
    return this.updatePortfolio(id, body);
  }

  async deletePortfolio(id: number) {
    const existing = await this.prisma.portfolio_items.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Portfolio item not found');
    await this.prisma.portfolio_items.update({ where: { id }, data: { deleted_at: new Date() } as any });
    return { success: true, message: 'Portfolio item deleted' };
  }

  // -------------------------------------------------------------------------
  // Services
  // -------------------------------------------------------------------------
  async listServices(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = { deleted_at: null };
    if (query.category) where.category = query.category;
    if (query.status !== undefined) where.is_active = query.status === 'active';
    const [count, rows] = await Promise.all([
      this.prisma.services.count({ where }),
      this.prisma.services.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    return { success: true, data: rows, pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } };
  }

  async getService(id: number) {
    const row = await this.prisma.services.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Service not found');
    return { success: true, data: row };
  }

  async createService(body: any) {
    const data = pick(body, ['name', 'slug', 'description', 'category', 'header_image', 'features', 'pricing', 'sections', 'is_popular', 'is_active']);
    const row = await this.prisma.services.create({ data });
    return { success: true, data: row };
  }

  async updateService(id: number, body: any) {
    const existing = await this.prisma.services.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    const data = pick(body, ['name', 'slug', 'description', 'category', 'header_image', 'features', 'pricing', 'sections', 'is_popular', 'is_active']);
    const row = await this.prisma.services.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async patchService(id: number, body: any) {
    return this.updateService(id, body);
  }

  async deleteService(id: number) {
    const existing = await this.prisma.services.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    await this.prisma.services.update({ where: { id }, data: { deleted_at: new Date() } as any });
    return { success: true, message: 'Service deleted' };
  }

  async updateServiceStatus(id: number, isActive: boolean) {
    await this.getService(id);
    const row = await this.prisma.services.update({ where: { id }, data: { is_active: isActive } });
    return { success: true, data: row };
  }

  async updateServicePopular(id: number, isPopular: boolean) {
    await this.getService(id);
    const row = await this.prisma.services.update({ where: { id }, data: { is_popular: isPopular } });
    return { success: true, data: row };
  }

  async getServiceBySlug(slug: string) {
    const row = await this.prisma.services.findFirst({ where: { slug, deleted_at: null } });
    if (!row) throw new NotFoundException('Service not found');
    return { success: true, data: row };
  }

  async updateServiceBySlug(slug: string, body: any) {
    const existing = await this.prisma.services.findFirst({ where: { slug, deleted_at: null } });
    if (!existing) throw new NotFoundException('Service not found');
    const data = pick(body, ['name', 'description', 'category', 'header_image', 'features', 'pricing', 'sections', 'is_popular', 'is_active']);
    const row = await this.prisma.services.update({ where: { id: existing.id }, data });
    return { success: true, data: row };
  }

  // -------------------------------------------------------------------------
  // Team
  // -------------------------------------------------------------------------
  async listTeam() {
    const rows = await this.prisma.teams.findMany({ orderBy: { display_order: 'asc' }, include: { profiles: { select: this.profileSelect } } });
    return { success: true, data: rows };
  }

  async getTeam(id: number) {
    const row = await this.prisma.teams.findUnique({ where: { id }, include: { profiles: { select: this.profileSelect } } });
    if (!row) throw new NotFoundException('Team member not found');
    return { success: true, data: row };
  }

  async createTeam(body: any) {
    const data = pick(body, ['name', 'role', 'role_label', 'image', 'email', 'phone', 'bio', 'linkedin', 'display_order', 'is_active', 'user_id']);
    const row = await this.prisma.teams.create({ data });
    return { success: true, data: row };
  }

  async updateTeam(id: number, body: any) {
    const existing = await this.prisma.teams.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Team member not found');
    const data = pick(body, ['name', 'role', 'role_label', 'image', 'email', 'phone', 'bio', 'linkedin', 'display_order', 'is_active', 'user_id']);
    const row = await this.prisma.teams.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteTeam(id: number) {
    const existing = await this.prisma.teams.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Team member not found');
    await this.prisma.teams.delete({ where: { id } });
    return { success: true, message: 'Team member deleted' };
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------
  async listReviews(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = { deleted_at: null };
    if (query.status) where.status = query.status;
    const [count, rows] = await Promise.all([
      this.prisma.reviews.count({ where }),
      this.prisma.reviews.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    return { success: true, data: rows, pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } };
  }

  async updateReviewStatus(id: number, status: string) {
    if (!['approved', 'pending', 'rejected'].includes(status)) throw new BadRequestException('Invalid status');
    const existing = await this.prisma.reviews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    const data: any = { status };
    if (status === 'approved') data.approved_at = new Date();
    const row = await this.prisma.reviews.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async deleteReview(id: number) {
    const existing = await this.prisma.reviews.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    await this.prisma.reviews.update({ where: { id }, data: { deleted_at: new Date() } as any });
    return { success: true, message: 'Review deleted' };
  }

  // -------------------------------------------------------------------------
  // Content management / site settings
  // -------------------------------------------------------------------------
  async getContentManagement() {
    const rows = await this.prisma.site_settings.findMany({ orderBy: { setting_key: 'asc' } });
    const map: any = {};
    for (const r of rows) map[r.setting_key] = r.setting_value;
    return { success: true, data: map };
  }

  async updateContentManagement(body: any) {
    const entries = Object.entries(body);
    for (const [key, value] of entries) {
      const existing = await this.prisma.site_settings.findFirst({ where: { setting_key: key } });
      if (existing) {
        await this.prisma.site_settings.update({ where: { id: existing.id }, data: { setting_value: String(value) } });
      } else {
        await this.prisma.site_settings.create({ data: { setting_key: key, setting_value: String(value) } as any });
      }
    }
    return this.getContentManagement();
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  async listOrders(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { order_number: { contains: String(query.search) } },
        { guest_email: { contains: String(query.search) } },
      ];
    }
    const [count, rows] = await Promise.all([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip, include: { order_items: true } }),
    ]);
    return { success: true, data: rows, pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } };
  }

  async getOrder(id: number) {
    const row = await this.prisma.orders.findUnique({ where: { id }, include: { order_items: { include: { products: true } } } });
    if (!row) throw new NotFoundException('Order not found');
    return { success: true, data: row };
  }

  async updateOrderStatus(id: number, status: string) {
    const existing = await this.prisma.orders.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Order not found');
    const row = await this.prisma.orders.update({ where: { id }, data: { status } as any });
    return { success: true, data: row };
  }

  async deleteOrder(id: number) {
    const existing = await this.prisma.orders.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Order not found');
    await this.prisma.orders.delete({ where: { id } });
    return { success: true, message: 'Order deleted' };
  }

  async deleteOrders(query: any) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.older_than_days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(query.older_than_days));
      where.created_at = { lt: cutoff };
    }
    const count = await this.prisma.orders.count({ where });
    await this.prisma.orders.deleteMany({ where });
    return { success: true, message: `${count} order(s) deleted` };
  }

  // -------------------------------------------------------------------------
  // Scheduled posts
  // -------------------------------------------------------------------------
  async listScheduledPosts() {
    const now = new Date();
    const rows = await this.prisma.blog_posts.findMany({
      where: { scheduled_at: { gt: now }, deleted_at: null, status: { not: 'published' } },
      orderBy: { scheduled_at: 'asc' },
    });
    return { success: true, data: rows };
  }

  async publishScheduledPost(id: number) {
    const existing = await this.prisma.blog_posts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post not found');
    const row = await this.prisma.blog_posts.update({
      where: { id },
      data: { status: 'published', published_at: new Date(), scheduled_at: null } as any,
    });
    return { success: true, data: row };
  }

  // -------------------------------------------------------------------------
  // Scheduler / cleanup / finance / agent requests
  // -------------------------------------------------------------------------
  schedulerStatus() {
    return { success: true, data: { running: true, last_run: new Date().toISOString() } };
  }

  async cleanupStats() {
    const [analyticsCount, notificationsCount] = await Promise.all([
      this.prisma.analytics.count(),
      this.prisma.notifications.count(),
    ]);
    return { success: true, data: { analytics: analyticsCount, notifications: notificationsCount } };
  }

  async cleanupAnalytics(body: any) {
    const days = Number(body.days || 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.prisma.analytics.deleteMany({ where: { created_at: { lt: cutoff } } });
    return { success: true, message: `${result.count} analytics record(s) cleaned` };
  }

  async cleanupNotifications(body: any) {
    const days = Number(body.days || 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.prisma.notifications.deleteMany({ where: { created_at: { lt: cutoff }, is_read: true } });
    return { success: true, message: `${result.count} notification(s) cleaned` };
  }

  async cleanupFilteredAnalytics(body: any) {
    const days = Number(body.days || 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const where: any = { created_at: { lt: cutoff } };
    if (body.event_type) where.event_type = body.event_type;
    if (body.source) where.source = body.source;
    const result = await this.prisma.analytics.deleteMany({ where });
    return { success: true, message: `${result.count} analytics record(s) cleaned` };
  }

  async runCleanup() {
    const analytics = await this.cleanupAnalytics({ days: 90 });
    const notifications = await this.cleanupNotifications({ days: 30 });
    return { success: true, data: { analytics, notifications } };
  }

  async financeDashboard() {
    const [revenue, expenses, pending, paid] = await Promise.all([
      this.prisma.payments.aggregate({ _sum: { amount: true } }),
      this.prisma.expenses.aggregate({ _sum: { amount: true } }),
      this.prisma.invoices.count({ where: { status: { not: 'paid' } } }),
      this.prisma.invoices.count({ where: { status: 'paid' } }),
    ]);
    return {
      success: true,
      data: {
        revenue: revenue._sum?.amount ?? 0,
        expenses: expenses._sum?.amount ?? 0,
        pendingInvoices: pending,
        paidInvoices: paid,
      },
    };
  }

  async listAgentRequests() {
    const rows = await this.prisma.contacts.findMany({
      where: { contact_type: 'agent_request', deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async approveAgentRequest(id: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request not found');
    await this.prisma.contacts.update({ where: { id }, data: { contact_type: 'agent', status: 'approved' } as any });
    return { success: true, message: 'Agent request approved' };
  }

  async dismissAgentRequest(id: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request not found');
    await this.prisma.contacts.update({ where: { id }, data: { contact_type: 'dismissed_agent', status: 'dismissed' } as any });
    return { success: true, message: 'Agent request dismissed' };
  }

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------
  async listContacts(query: any) {
    const { page, limit, skip } = paginate(query);
    const where: any = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.contact_type) where.contact_type = query.contact_type;
    if (query.priority) where.priority = query.priority;
    if (query.lifecycle_stage) where.lifecycle_stage = query.lifecycle_stage;
    if (query.assigned_to) where.assigned_to = Number(query.assigned_to);
    if (query.search) {
      where.OR = [
        { name: { contains: String(query.search) } },
        { email: { contains: String(query.search) } },
        { company: { contains: String(query.search) } },
      ];
    }
    const [count, rows] = await Promise.all([
      this.prisma.contacts.count({ where }),
      this.prisma.contacts.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip }),
    ]);
    return { success: true, data: rows, pagination: { page, limit, totalItems: count, totalPages: Math.ceil(count / limit) } };
  }

  async createContact(body: any, userId: number) {
    const data = pick(body, [
      'name', 'email', 'phone', 'subject', 'message', 'rating', 'contact_type', 'priority', 'status',
      'company', 'website', 'location', 'source', 'referrer', 'ip_address', 'user_agent', 'tags',
      'lead_score', 'lifecycle_stage', 'lead_status', 'job_title', 'department', 'linkedin_url',
      'twitter_url', 'owner_id', 'company_id', 'commission_type', 'commission_rate', 'avatar_url',
    ]);
    data.owner_id = body.owner_id ? Number(body.owner_id) : userId;
    const row = await this.prisma.contacts.create({ data });
    return { success: true, data: row };
  }

  async searchContacts(query: any) {
    const search = String(query.q || query.search || '');
    const rows = await this.prisma.contacts.findMany({
      where: {
        deleted_at: null,
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { company: { contains: search } },
        ],
      },
      take: 20,
    });
    return { success: true, data: rows };
  }

  async getContact(id: number) {
    const row = await this.prisma.contacts.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');
    return { success: true, data: row };
  }

  async updateContactStatus(id: number, status: string) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const data: any = { status };
    if (['closed', 'resolved'].includes(status)) data.resolved_at = new Date();
    const row = await this.prisma.contacts.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async updateContactPriority(id: number, priority: string) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const row = await this.prisma.contacts.update({ where: { id }, data: { priority } as any });
    return { success: true, data: row };
  }

  async assignContact(id: number, userId: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const row = await this.prisma.contacts.update({ where: { id }, data: { assigned_to: userId } });
    return { success: true, data: row };
  }

  async updateContact(id: number, body: any) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const data = pick(body, [
      'name', 'email', 'phone', 'subject', 'message', 'rating', 'contact_type', 'priority', 'status',
      'company', 'website', 'location', 'source', 'referrer', 'tags', 'lead_score', 'lifecycle_stage',
      'lead_status', 'job_title', 'department', 'linkedin_url', 'twitter_url', 'owner_id', 'company_id',
      'commission_type', 'commission_rate', 'avatar_url', 'admin_notes',
    ]);
    const row = await this.prisma.contacts.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async updateContactNotes(id: number, notes: string) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const row = await this.prisma.contacts.update({ where: { id }, data: { admin_notes: notes } });
    return { success: true, data: row };
  }

  async contactStats() {
    const [total, newCount, contacted, qualified, customer] = await Promise.all([
      this.prisma.contacts.count({ where: { deleted_at: null } }),
      this.prisma.contacts.count({ where: { deleted_at: null, status: 'new' } }),
      this.prisma.contacts.count({ where: { deleted_at: null, status: 'contacted' } }),
      this.prisma.contacts.count({ where: { deleted_at: null, lifecycle_stage: 'qualified' } }),
      this.prisma.contacts.count({ where: { deleted_at: null, lifecycle_stage: 'customer' } }),
    ]);
    return { success: true, data: { total, new: newCount, contacted, qualified, customer } };
  }

  async customerStats() {
    const [total, active, churned, revenue] = await Promise.all([
      this.prisma.contacts.count({ where: { deleted_at: null, lifecycle_stage: 'customer' } }),
      this.prisma.contacts.count({ where: { deleted_at: null, lifecycle_stage: 'customer', status: 'active' } }),
      this.prisma.contacts.count({ where: { deleted_at: null, lifecycle_stage: 'customer', status: 'churned' } }),
      this.prisma.invoices.aggregate({ where: { status: 'paid' }, _sum: { total_amount: true } }),
    ]);
    return { success: true, data: { total, active, churned, revenue: revenue._sum?.total_amount ?? 0 } };
  }

  async listAgents() {
    const rows = await this.prisma.contacts.findMany({
      where: { deleted_at: null, contact_type: { contains: 'agent' } },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async getContactClients(id: number) {
    const rows = await this.prisma.companies.findMany({
      where: { agent_id: id, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async promoteToAgent(id: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const row = await this.prisma.contacts.update({ where: { id }, data: { contact_type: 'agent' } as any });
    return { success: true, data: row };
  }

  async logContact(id: number, body: any, userId: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    await this.prisma.crm_activities.create({
      data: {
        activity_type: 'note',
        subject: body.subject || 'Contact log',
        description: body.notes || '',
        contact_id: id,
        created_by: userId,
      } as any,
    });
    const row = await this.prisma.contacts.update({ where: { id }, data: { last_contacted_at: new Date() } });
    return { success: true, data: row };
  }

  async getContactInteractions(id: number) {
    const rows = await this.prisma.crm_activities.findMany({
      where: { contact_id: id },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async updateContactCommission(id: number, body: any) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const data: any = {};
    if (body.commission_type) data.commission_type = body.commission_type;
    if (body.commission_rate !== undefined) data.commission_rate = toDec(body.commission_rate);
    const row = await this.prisma.contacts.update({ where: { id }, data });
    return { success: true, data: row };
  }

  async exportContacts() {
    const rows = await this.prisma.contacts.findMany({ where: { deleted_at: null } });
    return { success: true, data: rows };
  }

  async updateContactAvatar(id: number, avatarUrl: string) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    const row = await this.prisma.contacts.update({ where: { id }, data: { avatar_url: avatarUrl } });
    return { success: true, data: row };
  }

  async deleteContact(id: number) {
    const existing = await this.prisma.contacts.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    await this.prisma.contacts.update({ where: { id }, data: { deleted_at: new Date() } as any });
    return { success: true, message: 'Contact deleted' };
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------
  async assignAgentToCompany(companyId: number, contactId: number) {
    const company = await this.prisma.companies.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    const contact = await this.prisma.contacts.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.prisma.companies.update({ where: { id: companyId }, data: { agent_id: contactId } });
    return { success: true, message: 'Agent assigned to company' };
  }

  // -------------------------------------------------------------------------
  // Contact documents
  // -------------------------------------------------------------------------
  async listContactDocuments(contactId: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const rows = await this.prisma.documents.findMany({
      where: { related_entity_type: 'contact', related_entity_id: contactId },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: rows };
  }

  async createContactDocument(contactId: number, body: any, userId: number) {
    const contact = await this.prisma.contacts.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const data = pick(body, ['title', 'file_url', 'file_name', 'file_size', 'file_type', 'category']);
    data.related_entity_type = 'contact';
    data.related_entity_id = contactId;
    data.uploaded_by = userId;
    data.filename = body.file_name || body.title || 'document';
    data.original_filename = body.file_name || body.title || 'document';
    data.file_path = body.file_url || '';
    data.mime_type = body.file_type || 'application/octet-stream';
    data.file_size = Number(body.file_size || 0);
    data.bucket = 'documents';
    data.storage_key = body.file_url || '';
    const row = await this.prisma.documents.create({ data });
    return { success: true, data: row };
  }

  async deleteContactDocument(contactId: number, docId: number) {
    const doc = await this.prisma.documents.findFirst({ where: { id: docId, related_entity_type: 'contact', related_entity_id: contactId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.documents.delete({ where: { id: docId } });
    return { success: true, message: 'Document deleted' };
  }
}
