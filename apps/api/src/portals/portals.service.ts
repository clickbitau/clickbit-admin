import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PublicInvoicesService } from '../finance/public-invoices.service';
import Stripe from 'stripe';

interface UserLike {
  id: number;
  email?: string;
  role: string;
}

function toNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function toNum0(value: unknown): number {
  return toNum(value) ?? 0;
}

function cleanIds(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
}

@Injectable()
export class PortalsService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicInvoices: PublicInvoicesService,
    private readonly config: ConfigService,
    private readonly cache?: CacheService,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secret) {
      this.stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' as any });
    }
  }

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('portals', ...parts) ?? `portals:` + parts.filter((p) => p !== undefined && p !== null).join(':');
  }

  private async invalidateCache(): Promise<void> {
    await this.cache?.delPrefix(this.cacheKey());
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }


  private async resolveCustomer(user: UserLike) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const [profileContact, userContacts] = await Promise.all([
      profile?.contact_id ? this.prisma.contacts.findUnique({ where: { id: profile.contact_id } }) : Promise.resolve(null),
      this.prisma.contacts.findMany({
        where: { user_id: user.id, deleted_at: null },
        orderBy: { id: 'asc' },
      }),
    ]);
    const contactsMap = new Map<number, any>();
    for (const c of userContacts) contactsMap.set(c.id, c);
    if (profileContact && !contactsMap.has(profileContact.id)) contactsMap.set(profileContact.id, profileContact);
    const contacts = Array.from(contactsMap.values());
    const contactIds = cleanIds(contacts.map((c) => c.id));
    const companyIds = cleanIds([...new Set([profile?.company_id, ...contacts.map((c) => c.company_id)].filter(Boolean))]);
    const emails = contacts.map((c) => c.email).filter(Boolean) as string[];
    if (!emails.length && user.email) emails.push(user.email);
    return { profile, contacts, contactIds, companyIds, emails };
  }

  private async resolveAgent(user: UserLike) {
    let agentContact = await this.prisma.contacts.findFirst({
      where: { user_id: user.id, lifecycle_stage: 'agent', deleted_at: null },
    });
    if (!agentContact && user.role === 'agent') {
      agentContact = await this.prisma.contacts.findFirst({
        where: { user_id: user.id, deleted_at: null },
        orderBy: { updated_at: 'desc' },
      });
    }
    if (!agentContact) throw new ForbiddenException('No agent profile found');

    const clients = await this.prisma.contacts.findMany({
      where: { agent_id: agentContact.id, deleted_at: null },
      include: { companies_contacts_company_idTocompanies: { select: { id: true, name: true } } },
    });
    const companies = await this.prisma.companies.findMany({
      where: { agent_id: agentContact.id, deleted_at: null },
    });
    const contactIds = cleanIds([agentContact.id, ...clients.map((c) => c.id)]);
    const companyIds = cleanIds([...new Set([agentContact.company_id, ...companies.map((c) => c.id), ...clients.map((c) => c.company_id)].filter(Boolean))]);
    const clientEmails = clients.map((c) => c.email).filter(Boolean);
    const clientUserIds = cleanIds(clients.map((c) => c.user_id));
    return { agentContact, clients, companies, contactIds, companyIds, clientEmails, clientUserIds };
  }

  private invoiceScope(contactIds: number[], companyIds: number[]): any {
    const ors: any[] = [];
    if (contactIds.length) {
      ors.push({ contact_id: { in: contactIds } });
      ors.push({ source_id: { in: contactIds }, source_type: { in: ['contact', null] } });
    }
    if (companyIds.length) {
      ors.push({ company_id: { in: companyIds } });
      ors.push({ source_id: { in: companyIds }, source_type: 'company' });
    }
    if (ors.length === 0) return { id: -1, deleted_at: null, document_type: 'invoice' } as any;
    return { OR: ors, deleted_at: null, document_type: 'invoice' } as any;
  }

  private projectScope(contactIds: number[], companyIds: number[]): any {
    const ors: any[] = [];
    if (contactIds.length) ors.push({ customer_id: { in: contactIds } });
    if (companyIds.length) ors.push({ company_id: { in: companyIds } });
    if (ors.length === 0) return { id: -1, deleted_at: null, customer_visible: true } as any;
    return { OR: ors, deleted_at: null, customer_visible: true } as any;
  }

  private ticketScopeByEmails(emails: string[], userIds: number[]): any {
    const ors: any[] = [];
    if (emails.length) ors.push({ contact_email: { in: emails } });
    if (userIds.length) ors.push({ user_id: { in: userIds } });
    if (ors.length === 0) return { id: -1, deleted_at: null } as any;
    return { OR: ors, deleted_at: null } as any;
  }

  // -------------------------------------------------------------------------
  // Agent portal
  // -------------------------------------------------------------------------
  async agentDashboard(user: UserLike) {
    return this.cached(this.cacheKey('agentDashboard', user.id), async () => {

      const { agentContact, clients, contactIds, companyIds, clientUserIds } = await this.resolveAgent(user);
      const invoiceWhere = this.invoiceScope(contactIds, companyIds);
      const projectWhere = this.projectScope(contactIds, companyIds);

      const [invoiceStats, overdueInvoices, projectCount, ticketCount, companyCount] = await Promise.all([
        this.prisma.invoices.aggregate({ where: invoiceWhere, _sum: { total_amount: true, amount_paid: true }, _count: true }),
        this.prisma.invoices.findMany({
          where: { ...invoiceWhere, due_date: { lt: new Date() } },
          select: { total_amount: true, amount_paid: true },
        }),
        this.prisma.crm_projects.count({ where: projectWhere }),
        this.prisma.tickets.count({ where: this.ticketScopeByEmails(clients.map((c) => c.email).filter(Boolean), clientUserIds) }),
        this.prisma.companies.count({ where: { id: { in: companyIds }, deleted_at: null } }),
      ]);

      const total = toNum0(invoiceStats._sum?.total_amount);
      const paid = toNum0(invoiceStats._sum?.amount_paid);
      const outstanding = total - paid;
      const overdueAmount = overdueInvoices.reduce(
        (sum, inv) => (toNum0(inv.total_amount) > toNum0(inv.amount_paid) ? sum + toNum0(inv.total_amount) - toNum0(inv.amount_paid) : sum),
        0,
      );
      const clientCount = clients.length;
      const clientRevenue = total;
      const commissionRate = toNum0(agentContact.commission_rate);
      const commissionDue = agentContact.commission_type === 'percentage' ? (clientRevenue * commissionRate) / 100 : clientCount * commissionRate;

      const agentCompany = agentContact.company_id
        ? await this.prisma.companies.findUnique({ where: { id: agentContact.company_id }, select: { name: true } })
        : null;

      const topClients = clients.slice(0, 8).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.companies_contacts_company_idTocompanies?.name || null,
        total_revenue: toNum0(c.total_revenue),
        lifecycle_stage: c.lifecycle_stage,
        created_at: c.created_at,
        last_contacted_at: c.last_contacted_at,
      }));

      return {
        success: true,
        data: {
          agent: {
            id: agentContact.id,
            name: agentContact.name,
            email: agentContact.email,
            company: agentCompany?.name || null,
            commission_type: agentContact.commission_type,
            commission_rate: commissionRate,
          },
          stats: {
            total_clients: clientCount,
            client_revenue: clientRevenue,
            own_revenue: commissionDue,
            total_invoices: toNum0(invoiceStats._count),
            paid_amount: paid,
            outstanding_amount: outstanding,
            overdue_amount: overdueAmount,
            active_projects: projectCount,
            commission_due: commissionDue,
            companies: companyCount,
            open_tickets: ticketCount,
          },
          clients: topClients,
        },
      };


    });
}

  async agentClients(user: UserLike) {
    const { agentContact, clients } = await this.resolveAgent(user);
    const mapped = clients.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.companies_contacts_company_idTocompanies?.name || null,
      total_revenue: toNum0(c.total_revenue),
      lifecycle_stage: c.lifecycle_stage,
      created_at: c.created_at,
      last_contacted_at: c.last_contacted_at,
    }));
    return { success: true, data: { agent_id: agentContact.id, clients: mapped } };
  }

  async agentInvoices(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveAgent(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where = this.invoiceScope(contactIds, companyIds);
    const [rows, total] = await Promise.all([
      this.prisma.invoices.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.invoices.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async agentProjects(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveAgent(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where = this.projectScope(contactIds, companyIds);
    const [rows, total] = await Promise.all([
      this.prisma.crm_projects.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.crm_projects.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async agentProjectDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('agentProjectDetail', user.id, id), async () => {

      const { contactIds, companyIds } = await this.resolveAgent(user);
      const project = await this.prisma.crm_projects.findFirst({
        where: { id, ...this.projectScope(contactIds, companyIds) },
      });
      if (!project) throw new NotFoundException('Project not found');
      return { success: true, data: project };


    });
}

  async agentCompanies(user: UserLike) {
    const { companyIds } = await this.resolveAgent(user);
    const rows = await this.prisma.companies.findMany({
      where: { id: { in: companyIds }, deleted_at: null },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: rows };
  }

  async agentAssignContactToCompany(user: UserLike, companyId: number, contactId: number) {
    await this.invalidateCache();

    const { contactIds } = await this.resolveAgent(user);
    const contact = await this.prisma.contacts.findFirst({ where: { id: contactId, agent_id: { in: contactIds }, deleted_at: null } });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.prisma.contacts.update({ where: { id: contactId }, data: { company_id: companyId } });
    return { success: true, message: 'Contact assigned to company' };
  }

  async agentCreateCompanyUser(user: UserLike, companyId: number, body: any) {
    await this.invalidateCache();

    const { agentContact, companyIds } = await this.resolveAgent(user);
    if (!companyIds.includes(companyId)) throw new ForbiddenException('Company not assigned to this agent');

    const company = await this.prisma.companies.findUnique({ where: { id: companyId, deleted_at: null } });
    if (!company) throw new NotFoundException('Company not found');

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    if (!email) throw new BadRequestException('email is required');
    if (!name) throw new BadRequestException('name is required');

    const existing = await this.prisma.profiles.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const parts = name.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const password = randomBytes(16).toString('hex');

    const profile = await this.prisma.profiles.create({
      data: {
        email,
        first_name: firstName,
        last_name: lastName,
        phone: body.phone || null,
        password,
        role: body.role || 'customer',
        status: 'active',
      } as any,
    });

    const contact = await this.prisma.contacts.create({
      data: {
        name,
        email,
        phone: body.phone || null,
        company_id: companyId,
        agent_id: agentContact.id,
        lifecycle_stage: body.lifecycle_stage || 'customer',
        user_id: profile.id,
        source: 'agent_portal',
      } as any,
    });

    return { success: true, data: { profile, contact }, message: 'Company user created' };
  }

  async agentTickets(user: UserLike, query: any) {
    const { clients, clientUserIds, companyIds: _companyIds } = await this.resolveAgent(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, clientUserIds);
    const [rows, total] = await Promise.all([
      this.prisma.tickets.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.tickets.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async agentCreateTicket(user: UserLike, body: any) {
    await this.invalidateCache();

    const { agentContact: _agentContact, contactIds } = await this.resolveAgent(user);
    const contactId = Number(body.contact_id);
    if (!contactIds.includes(contactId)) throw new ForbiddenException('Invalid contact');
    const client = await this.prisma.contacts.findUnique({ where: { id: contactId } });
    const ticket = await this.prisma.tickets.create({
      data: {
        ticket_number: `T-${Date.now()}`,
        subject: body.title || body.subject,
        description: body.description,
        contact_email: client?.email || '',
        user_id: client?.user_id,
        status: 'open',
        priority: body.priority || 'medium',
        source: 'agent',
      } as any,
    });
    return { success: true, data: ticket };
  }

  async agentTicketDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('agentTicketDetail', user.id, id), async () => {

      const { clients, clientUserIds } = await this.resolveAgent(user);
      const emails = clients.map((c) => c.email).filter(Boolean);
      const where = this.ticketScopeByEmails(emails, clientUserIds);
      const ticket = await this.prisma.tickets.findFirst({
        where: { id, ...where },
        include: { ticket_messages: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      return { success: true, data: ticket };


    });
}

  async agentTicketReply(user: UserLike, id: number, body: any) {
    await this.invalidateCache();

    const { clients, clientUserIds } = await this.resolveAgent(user);
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, clientUserIds);
    const ticket = await this.prisma.tickets.findFirst({ where: { id, ...where } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const message = await this.prisma.ticket_messages.create({
      data: {
        ticket_id: id,
        sender_id: user.id,
        sender_type: 'agent',
        message: body.message,
        is_internal: body.is_internal === true,
      } as any,
    });
    return { success: true, data: message };
  }

  async agentTicketQuota(user: UserLike) {
    return this.cached(this.cacheKey('agentTicketQuota', user.id), async () => {

      const { clients, clientUserIds } = await this.resolveAgent(user);
      const emails = clients.map((c) => c.email).filter(Boolean);
      const where = this.ticketScopeByEmails(emails, clientUserIds);
      const count = await this.prisma.tickets.count({ where });
      return { success: true, data: { used: count, limit: 100, remaining: Math.max(0, 100 - count) } };


    });
}

  // -------------------------------------------------------------------------
  // Customer portal
  // -------------------------------------------------------------------------
  async customerDashboard(user: UserLike, query?: any) {
    const includeRecent = query?.includeRecent !== 'false' && query?.includeRecent !== false;
    return this.cached(this.cacheKey('customerDashboard', user.id, includeRecent ? 'recent' : 'norecent'), async () => {

      const { contactIds, companyIds, profile, emails } = await this.resolveCustomer(user);
      const invoiceWhere = this.invoiceScope(contactIds, companyIds);
      const projectWhere = this.projectScope(contactIds, companyIds);
      const ticketWhere = this.ticketScopeByEmails(emails, [user.id]);
      const orderWhere: any = { OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }] };
      const [
        invoiceStats, invoiceCount, projectCount, taskCount, documentCount, paymentCount, orderCount, ticketCount,
        paidInvoiceCount, activeProjectCount, openTicketCount, resolvedTicketCount, orderStatusCounts,
        recentOrders, recentTickets,
      ] = await Promise.all([
        this.prisma.invoices.aggregate({ where: invoiceWhere, _sum: { total_amount: true, amount_paid: true } }),
        this.prisma.invoices.count({ where: invoiceWhere }),
        this.prisma.crm_projects.count({ where: projectWhere }),
        this.prisma.project_tasks.count({ where: { customer_id: { in: contactIds }, deleted_at: null } as any }),
        this.prisma.documents.count({ where: { OR: [{ related_entity_id: { in: companyIds }, related_entity_type: 'company' }, { related_entity_id: { in: contactIds }, related_entity_type: 'contact' }], status: 'active' } as any }),
        this.prisma.payments.count({ where: { user_id: user.id, deleted_at: null } }),
        this.prisma.orders.count({ where: orderWhere }),
        this.prisma.tickets.count({ where: ticketWhere }),
        this.prisma.invoices.count({ where: { ...invoiceWhere, status: 'paid' } }),
        this.prisma.crm_projects.count({ where: { ...projectWhere, status: { notIn: ['completed', 'cancelled', 'on_hold'] } } }),
        this.prisma.tickets.count({ where: { ...ticketWhere, status: { in: ['open', 'in_progress', 'waiting_customer', 'waiting_staff'] } } }),
        this.prisma.tickets.count({ where: { ...ticketWhere, status: { in: ['resolved', 'closed'] } } }),
        this.prisma.orders.groupBy({ by: ['status'], where: orderWhere, _count: { id: true } }),
        includeRecent
          ? this.prisma.orders.findMany({
              where: orderWhere,
              orderBy: { created_at: 'desc' },
              take: 5,
              select: { id: true, order_number: true, total_amount: true, status: true, created_at: true },
            })
          : Promise.resolve([] as any[]),
        includeRecent
          ? this.prisma.tickets.findMany({
              where: ticketWhere,
              orderBy: { created_at: 'desc' },
              take: 5,
              select: { id: true, ticket_number: true, subject: true, status: true, priority: true, created_at: true },
            })
          : Promise.resolve([] as any[]),
      ]);
      const total = toNum0(invoiceStats._sum?.total_amount);
      const paid = toNum0(invoiceStats._sum?.amount_paid);
      const outstanding = total - paid;

      const orderStatusMap = (orderStatusCounts as any[]).reduce<Record<string, number>>((acc, s) => {
        acc[s.status as string] = (s._count)?.id ?? 0;
        return acc;
      }, {});
      const pendingOrders = orderStatusMap['pending'] || 0;
      const processingOrders = orderStatusMap['processing'] || 0;
      const completedOrders =
        (orderStatusMap['shipped'] || 0) +
        (orderStatusMap['delivered'] || 0) +
        (orderStatusMap['refunded'] || 0) +
        (orderStatusMap['partially_refunded'] || 0);

      return {
        success: true,
        data: {
          name: profile ? `${profile.first_name} ${profile.last_name}` : null,
          outstanding_balance: outstanding,
          total_invoiced: total,
          total_paid: paid,
          invoice_count: invoiceCount,
          project_count: projectCount,
          task_count: taskCount,
          document_count: documentCount,
          payment_count: paymentCount,
          order_count: orderCount,
          ticket_count: ticketCount,
          orders: {
            total: orderCount,
            pending: pendingOrders,
            processing: processingOrders,
            completed: completedOrders,
          },
          tickets: {
            total: ticketCount,
            open: openTicketCount,
            awaiting_response: 0,
            resolved: resolvedTicketCount,
          },
          invoices: {
            total: invoiceCount,
            paid: paidInvoiceCount,
            unpaid: invoiceCount - paidInvoiceCount,
          },
          projects: {
            total: projectCount,
            active: activeProjectCount,
          },
          payments: {
            totalPaid: paid,
            pendingPayments: outstanding,
          },
          recentOrders: (recentOrders).map((o) => ({ ...o, total_amount: toNum0(o.total_amount) })),
          recentTickets,
        },
      };


    });
}

  async customerCompany(user: UserLike) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const companyId = companyIds[0];
    if (!companyId) {
      const contactCompanyId = contactIds.length
        ? (await this.prisma.contacts.findFirst({ where: { id: { in: contactIds } }, select: { company_id: true } }))?.company_id
        : undefined;
      if (contactCompanyId) companyIds.push(contactCompanyId);
    }
    const company = await this.prisma.companies.findFirst({
      where: { id: { in: companyIds }, deleted_at: null },
      include: { contacts_contacts_company_idTocompanies: { take: 1, orderBy: { created_at: 'asc' }, select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!company) return { success: true, data: null };
    const primaryContact = (company as any).contacts_contacts_company_idTocompanies?.[0] || null;
    return {
      success: true,
      data: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        company_size: company.company_size,
        email: company.email,
        phone: company.phone,
        address: company.address_line1,
        address_line2: company.address_line2,
        city: company.city,
        state: company.state,
        country: company.country,
        postal_code: company.postal_code,
        logo_url: company.logo_url,
        website: company.domain,
        description: company.description,
        created_at: company.created_at,
        primary_contact: primaryContact,
      },
    };
  }

  async customerOrders(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where: any = { OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }] };
    const [rows, total] = await Promise.all([
      this.prisma.orders.findMany({ where, include: { order_items: true }, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.orders.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerOrderDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('customerOrderDetail', user.id, id), async () => {

      const { contactIds, companyIds } = await this.resolveCustomer(user);
      const order = await this.prisma.orders.findFirst({
        where: { id, OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }] } as any,
        include: { order_items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      return { success: true, data: order };


    });
}

  async customerInvoices(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const filters: any[] = [this.invoiceScope(contactIds, companyIds)];
    if (query.status && query.status !== 'all') filters.push({ status: query.status });
    if (query.document_type && query.document_type !== 'all') filters.push({ document_type: query.document_type });
    if (query.search) {
      filters.push({
        OR: [
          { invoice_number: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
          { client_name: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    const where = filters.length === 1 ? filters[0] : { AND: filters };
    const [rows, total] = await Promise.all([
      this.prisma.invoices.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.invoices.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerInvoiceDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('customerInvoiceDetail', user.id, id), async () => {

      const { contactIds, companyIds } = await this.resolveCustomer(user);
      const invoice = await this.prisma.invoices.findFirst({ where: { id, ...this.invoiceScope(contactIds, companyIds) } });
      if (!invoice) throw new NotFoundException('Invoice not found');
      return { success: true, data: invoice };


    });
}

  async customerProjects(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const filters: any[] = [this.projectScope(contactIds, companyIds)];
    if (query.status && query.status !== 'all') filters.push({ status: query.status });
    if (query.search) {
      filters.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { project_number: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    const where = filters.length === 1 ? filters[0] : { AND: filters };
    const [rows, total] = await Promise.all([
      this.prisma.crm_projects.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.crm_projects.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerPayments(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where: any = { deleted_at: null, OR: [{ user_id: user.id }, { invoices: { contact_id: { in: contactIds } } }, { invoices: { company_id: { in: companyIds } } }] };
    const [rows, total] = await Promise.all([
      this.prisma.payments.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.payments.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  customerSubmissions(_user: UserLike, _query: any) {
    return { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 25 } };
  }

  async customerInvoicePdf(user: UserLike, id: number) {
    await this.invalidateCache();

    const invoice = await this.customerInvoiceDetail(user, id);
    return this.publicInvoices.generatePdf(invoice.data.id);
  }

  private async ensureInvoiceToken(invoice: any) {
    if (invoice.token) return invoice.token;
    const token = randomUUID();
    await this.prisma.invoices.update({ where: { id: invoice.id }, data: { token } });
    return token;
  }

  async customerPayInvoice(user: UserLike, id: number, body: any) {
    await this.invalidateCache();

    const invoice = await this.customerInvoiceDetail(user, id);
    const token = await this.ensureInvoiceToken(invoice.data);
    const code = invoice.data.package_code || String(invoice.data.id);
    return this.publicInvoices.createCheckoutSession(code, body, token);
  }

  async customerVerifyPayment(user: UserLike, id: number, body: any) {
    await this.invalidateCache();

    const invoice = await this.customerInvoiceDetail(user, id);
    const sessionId = body?.session_id || body?.sessionId;
    if (!sessionId) throw new BadRequestException('session_id is required');
    const code = invoice.data.package_code || String(invoice.data.id);
    const result = await this.publicInvoices.confirmPayment(code, sessionId, invoice.data.token || undefined);
    return { success: result.success, data: result.package };
  }

  async customerDocuments(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const ors: any[] = [];
    if (companyIds.length) ors.push({ related_entity_id: { in: companyIds }, related_entity_type: 'company' });
    if (contactIds.length) ors.push({ related_entity_id: { in: contactIds }, related_entity_type: 'contact' });
    const where: any = { OR: ors, status: 'active' };
    const [rows, total] = await Promise.all([
      this.prisma.documents.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.documents.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerDocumentDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('customerDocumentDetail', user.id, id), async () => {

      const { contactIds, companyIds } = await this.resolveCustomer(user);
      const ors: any[] = [];
      if (companyIds.length) ors.push({ related_entity_id: { in: companyIds }, related_entity_type: 'company' });
      if (contactIds.length) ors.push({ related_entity_id: { in: contactIds }, related_entity_type: 'contact' });
      const doc = await this.prisma.documents.findFirst({ where: { id, OR: ors, status: 'active' } as any });
      if (!doc) throw new NotFoundException('Document not found');
      return { success: true, data: doc };


    });
}

  async customerDocumentDownload(user: UserLike, id: number) {
    await this.invalidateCache();

    const doc = await this.customerDocumentDetail(user, id);
    await this.prisma.documents.update({
      where: { id },
      data: { download_count: { increment: 1 }, last_accessed_at: new Date(), last_accessed_by: user.id },
    });
    return { success: true, data: doc.data };
  }

  async customerTasks(user: UserLike, query: any) {
    const { contactIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where: any = { deleted_at: null, customer_id: { in: contactIds } };
    const [rows, total] = await Promise.all([
      this.prisma.project_tasks.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.project_tasks.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerTaskDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('customerTaskDetail', user.id, id), async () => {

      const { contactIds } = await this.resolveCustomer(user);
      const task = await this.prisma.project_tasks.findFirst({
        where: { id, deleted_at: null, customer_id: { in: contactIds } } as any,
        include: {
          crm_projects: { select: { id: true, name: true, project_number: true } },
          profiles_project_tasks_assigned_toToprofiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } },
          task_comments: {
            where: { is_internal: false },
            orderBy: { created_at: 'asc' as const },
            include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } },
          },
        },
      });
      if (!task) throw new NotFoundException('Task not found');
      return { success: true, data: task };


    });
}

  async customerAddTaskComment(user: UserLike, id: number, body: any) {
    await this.invalidateCache();

    await this.customerTaskDetail(user, id);
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: id,
        author_id: user.id,
        content: body.content,
        is_internal: false,
      } as any,
      include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true, avatar: true } } },
    });
    return { success: true, data: comment };
  }

  // -------------------------------------------------------------------------
  // Customer addresses
  // -------------------------------------------------------------------------

  private parsePreferences(profile: any) {
    try {
      return JSON.parse(profile?.preferences || '{}');
    } catch {
      return {};
    }
  }

  private async savePreferences(userId: number, preferences: Record<string, any>) {
    await this.prisma.profiles.update({ where: { id: userId }, data: { preferences: JSON.stringify(preferences) } });
  }

  private normalizeAddress(body: any, existing: any = {}) {
    const address = { ...existing };
    for (const field of ['label', 'type', 'full_name', 'phone', 'line1', 'line2', 'city', 'state', 'postal_code', 'country', 'is_default']) {
      if (body[field] !== undefined) address[field] = body[field];
    }
    if (!['billing', 'shipping', 'both'].includes(address.type)) address.type = 'both';
    address.is_default = Boolean(address.is_default);
    return address;
  }

  async customerAddresses(user: UserLike) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const prefs = this.parsePreferences(profile);
    return { addresses: Array.isArray(prefs.customer_addresses) ? prefs.customer_addresses : [] };
  }

  async addCustomerAddress(user: UserLike, body: any) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const prefs = this.parsePreferences(profile);
    const addresses = Array.isArray(prefs.customer_addresses) ? prefs.customer_addresses : [];
    const address = this.normalizeAddress(body);
    address.id = randomUUID();
    if (address.is_default || addresses.length === 0) {
      addresses.forEach((a: any) => { a.is_default = false; });
      address.is_default = true;
    }
    addresses.push(address);
    prefs.customer_addresses = addresses;
    await this.savePreferences(user.id, prefs);
    return { address };
  }

  async updateCustomerAddress(user: UserLike, id: string, body: any) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const prefs = this.parsePreferences(profile);
    const addresses = Array.isArray(prefs.customer_addresses) ? prefs.customer_addresses : [];
    const index = addresses.findIndex((a: any) => a.id === id);
    if (index === -1) throw new NotFoundException({ success: false, message: 'Address not found' });
    const address = this.normalizeAddress(body, addresses[index]);
    if (address.is_default) {
      addresses.forEach((a: any, i: number) => { a.is_default = i === index; });
    } else if (addresses[index].is_default && body.is_default === false) {
      address.is_default = false;
    }
    addresses[index] = address;
    if (!addresses.some((a: any) => a.is_default) && addresses.length > 0) addresses[0].is_default = true;
    prefs.customer_addresses = addresses;
    await this.savePreferences(user.id, prefs);
    return { address };
  }

  async deleteCustomerAddress(user: UserLike, id: string) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const prefs = this.parsePreferences(profile);
    const addresses = Array.isArray(prefs.customer_addresses) ? prefs.customer_addresses : [];
    const index = addresses.findIndex((a: any) => a.id === id);
    if (index === -1) throw new NotFoundException({ success: false, message: 'Address not found' });
    const wasDefault = addresses[index].is_default;
    addresses.splice(index, 1);
    if (wasDefault && addresses.length > 0) addresses[0].is_default = true;
    prefs.customer_addresses = addresses;
    await this.savePreferences(user.id, prefs);
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Customer payment methods (Stripe)
  // -------------------------------------------------------------------------

  private async ensureStripeCustomer(profile: any) {
    if (!this.stripe) return null;
    if (profile.stripe_customer_id) {
      try {
        await this.stripe.customers.retrieve(profile.stripe_customer_id);
        return profile.stripe_customer_id;
      } catch { /* fall through and create new */ }
    }
    const customer = await this.stripe.customers.create({
      email: profile.email,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
    });
    await this.prisma.profiles.update({ where: { id: profile.id }, data: { stripe_customer_id: customer.id } });
    return customer.id;
  }

  private requireStripe() {
    if (!this.stripe) throw new BadRequestException({ success: false, message: 'Payments are not configured' });
  }

  async customerPaymentMethods(user: UserLike) {
    this.requireStripe();
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const customerId = await this.ensureStripeCustomer(profile);
    if (!customerId) throw new BadRequestException({ success: false, message: 'Payments are not configured' });

    const [paymentMethods, customer] = await Promise.all([
      this.stripe!.paymentMethods.list({ customer: customerId, type: 'card' }),
      this.stripe!.customers.retrieve(customerId),
    ]);

    return {
      paymentMethods: paymentMethods.data.map((method: any) => ({
        id: method.id,
        brand: method.card?.brand || 'card',
        last4: method.card?.last4 || '',
        exp_month: method.card?.exp_month,
        exp_year: method.card?.exp_year,
      })),
      defaultPaymentMethodId: (customer as any).deleted
        ? null
        : (customer as any).invoice_settings?.default_payment_method || null,
    };
  }

  async createSetupSession(user: UserLike, origin?: string) {
    this.requireStripe();
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const customerId = await this.ensureStripeCustomer(profile);
    if (!customerId) throw new BadRequestException({ success: false, message: 'Payments are not configured' });

    const frontendUrl = origin || this.config.get<string>('FRONTEND_URL') || 'https://clickbit.com.au';
    const session = await this.stripe!.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: customerId,
      success_url: `${frontendUrl}/payment-method-saved`,
      cancel_url: `${frontendUrl}/payment-method-cancelled`,
    });
    return { url: session.url };
  }

  private async getOwnedPaymentMethod(user: UserLike, paymentMethodId: string) {
    this.requireStripe();
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const customerId = await this.ensureStripeCustomer(profile);
    if (!customerId) throw new BadRequestException({ success: false, message: 'Payments are not configured' });

    const paymentMethod = await this.stripe!.paymentMethods.retrieve(paymentMethodId);
    if ((paymentMethod as any).customer !== customerId) throw new NotFoundException({ success: false, message: 'Payment method not found' });
    return { customerId, paymentMethod };
  }

  async deleteCustomerPaymentMethod(user: UserLike, paymentMethodId: string) {
    const { paymentMethod } = await this.getOwnedPaymentMethod(user, paymentMethodId);
    await this.stripe!.paymentMethods.detach(paymentMethod.id);
    return { success: true };
  }

  async setDefaultPaymentMethod(user: UserLike, paymentMethodId: string) {
    const { customerId } = await this.getOwnedPaymentMethod(user, paymentMethodId);
    await this.stripe!.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    return { success: true, defaultPaymentMethodId: paymentMethodId };
  }

  // -------------------------------------------------------------------------
  // Customer quotes
  // -------------------------------------------------------------------------

  async createQuote(user: UserLike, body: any) {
    const { service_id, service_name, message, additional_details } = body;
    if (!service_name) throw new BadRequestException({ success: false, message: 'Service name is required' });

    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');
    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;

    let contact = profile.contact_id
      ? await this.prisma.contacts.findUnique({ where: { id: profile.contact_id, deleted_at: null } })
      : null;
    if (!contact) {
      contact = await this.prisma.contacts.findFirst({
        where: { email: { equals: profile.email, mode: 'insensitive' }, deleted_at: null },
        orderBy: { id: 'asc' },
      });
    }

    if (contact) {
      const update: any = {};
      if (!contact.user_id) update.user_id = user.id;
      if (!contact.company_id && profile.company_id) update.company_id = profile.company_id;
      if (Object.keys(update).length) {
        await this.prisma.contacts.update({ where: { id: contact.id }, data: update });
      }
    } else {
      contact = await this.prisma.contacts.create({
        data: {
          name,
          email: profile.email,
          subject: `Quote Request: ${service_name}`,
          message: message || `Customer ${name} requested a quote for ${service_name}.`,
          contact_type: 'sales',
          priority: 'high',
          status: 'new',
          source: 'Mobile App Quote Request',
          user_id: user.id,
          company_id: profile.company_id || null,
          lifecycle_stage: 'lead',
          lead_status: 'new',
          custom_fields: JSON.stringify({ service_id, service_name, additional_details, submitted_via: 'mobile_app' }),
        } as any,
      });
    }

    const pipeline = await this.prisma.crm_pipelines.findFirst({
      where: { is_default: true, is_active: true },
      orderBy: { id: 'asc' },
    }) || await this.prisma.crm_pipelines.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } });

    let lead = null;
    if (pipeline) {
      const firstStage = await this.prisma.crm_pipeline_stages.findFirst({
        where: { pipeline_id: pipeline.id, is_won: false, is_lost: false, is_active: true },
        orderBy: { position: 'asc' },
      });
      if (firstStage) {
        const description = [
          `Quote request for ${service_name}.`,
          message ? `\n\n${message}` : '',
          additional_details ? `\n\nAdditional details: ${additional_details}` : '',
        ].join('');
        lead = await this.prisma.crm_leads.create({
          data: {
            name,
            email: profile.email,
            description,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            contact_id: contact.id,
            company_id: profile.company_id || null,
            lead_source: 'Mobile App',
            status: 'open',
            priority: 'high',
            estimated_value: 0,
          } as any,
        });
      }
    }

    // Notify admins
    try {
      const admins = await this.prisma.profiles.findMany({
        where: { role: { in: ['admin', 'manager'] } },
        select: { id: true },
      });
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        title: 'New Quote Request',
        message: `${name} requested a quote for ${service_name}.`,
        type: 'info',
        source: 'crm',
        metadata: JSON.stringify({ type: 'quote_request', lead_id: lead?.id, contact_id: contact.id }),
      }));
      if (notifications.length) {
        await this.prisma.notifications.createMany({ data: notifications as any, skipDuplicates: true });
      }
    } catch { /* best-effort */ }

    return { success: true, contact, lead };
  }

  private async resolveEmployee(user: UserLike) {
    if (this.cache) {
      const cacheKey = this.cache.key('portals', 'employee', user.id);
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
      const employee = await this.prisma.employees.findUnique({
        where: { user_id: user.id },
        include: { profiles: { select: { first_name: true, last_name: true, email: true, phone: true, avatar: true } } },
      });
      if (!employee) throw new NotFoundException('Employee record not found');
      await this.cache.set(cacheKey, employee, 15);
      return employee;
    }
    const employee = await this.prisma.employees.findUnique({
      where: { user_id: user.id },
      include: { profiles: { select: { first_name: true, last_name: true, email: true, phone: true, avatar: true } } },
    });
    if (!employee) throw new NotFoundException('Employee record not found');
    return employee;
  }

  async employeeMe(user: UserLike) {
    return this.cached(this.cacheKey('employeeMe', user.id), async () => {

      const employee = await this.resolveEmployee(user);
      return { success: true, data: this.mapEmployee(employee) };


    });
}

  async employeeDashboard(user: UserLike) {
    return this.cached(this.cacheKey('employeeDashboard', user.id), async () => {

      const employee = await this.resolveEmployee(user);
      const employeeId = employee.id;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        activeEntry,
        upcomingShifts,
        recentTimeOff,
        recentPayslips,
        openTasks,
        contractCount,
        pendingTimeOffCount,
      ] = await Promise.all([
        this.prisma.hr_time_entries.findFirst({
          where: { employee_id: employeeId, clock_out_time: null, status: 'active' },
          orderBy: { clock_in_time: 'desc' },
        }),
        this.prisma.hr_shifts.findMany({
          where: { employee_id: employeeId, shift_date: { gte: todayStart }, status: { not: 'cancelled' } },
          orderBy: { shift_date: 'asc' },
          take: 5,
        }),
        this.prisma.hr_time_off_requests.findMany({
          where: { employee_id: employeeId },
          orderBy: { created_at: 'desc' },
          take: 5,
        }),
        this.prisma.payslips.findMany({
          where: { employee_id: employeeId },
          orderBy: { payment_date: 'desc' },
          take: 5,
        }),
        this.prisma.project_tasks.findMany({
          where: { assigned_to: user.id, deleted_at: null, status: { not: 'completed' } } as any,
          orderBy: { due_date: 'asc' },
          take: 5,
          include: { crm_projects: { select: { id: true, name: true, project_number: true } } },
        }),
        this.prisma.hr_contracts.count({ where: { employee_id: employeeId } }),
        this.prisma.hr_time_off_requests.count({ where: { employee_id: employeeId, status: 'pending' } }),
      ]);

      return {
        success: true,
        data: {
          employee: this.mapEmployee(employee),
          activeEntry: activeEntry ? this.mapTimeEntry(activeEntry) : null,
          stats: {
            openTasks: openTasks.length,
            pendingTimeOff: pendingTimeOffCount,
            upcomingShifts: upcomingShifts.length,
            contracts: contractCount,
            payslips: recentPayslips.length,
            annualLeave: toNum0(employee.annual_leave_balance),
            sickLeave: toNum0(employee.sick_leave_balance),
            personalLeave: toNum0(employee.personal_leave_balance),
          },
          upcomingShifts,
          recentTimeOff,
          recentPayslips,
          openTasks,
        },
      };


    });
}

  async employeeContracts(user: UserLike, query: any) {
    const employee = await this.resolveEmployee(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const [rows, total] = await Promise.all([
      this.prisma.hr_contracts.findMany({
        where: { employee_id: employee.id },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.hr_contracts.count({ where: { employee_id: employee.id } }),
    ]);
    const managerIds = [...new Set(rows.map((c) => c.manager_id).filter(Boolean))] as number[];
    const managers = managerIds.length
      ? await this.prisma.employees.findMany({
          where: { id: { in: managerIds } },
          include: { profiles: { select: { first_name: true, last_name: true, email: true } } },
        })
      : [];
    const managerMap = new Map(managers.map((m) => [m.id, m]));
    return {
      success: true,
      data: rows.map((c) => this.mapContract(c as any, managerMap.get(c.manager_id as number))),
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async employeeContractDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('employeeContractDetail', user.id, id), async () => {

      const employee = await this.resolveEmployee(user);
      const contract = await this.prisma.hr_contracts.findFirst({ where: { id, employee_id: employee.id } });
      if (!contract) throw new NotFoundException('Contract not found');
      let manager: any = null;
      if (contract.manager_id) {
        manager = await this.prisma.employees.findUnique({
          where: { id: contract.manager_id },
          include: { profiles: { select: { first_name: true, last_name: true, email: true } } },
        });
      }
      return { success: true, data: this.mapContract(contract as any, manager) };


    });
}

  async employeePayslips(user: UserLike, query: any) {
    const employee = await this.resolveEmployee(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const year = query.year ? Number(query.year) : undefined;
    const where: Prisma.payslipsWhereInput = { employee_id: employee.id };
    if (year) {
      where.payment_date = { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.payslips.findMany({
        where,
        orderBy: { payment_date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { employees: { select: { employee_number: true } } },
      }),
      this.prisma.payslips.count({ where }),
    ]);
    return {
      success: true,
      data: rows.map((p) => this.mapPayslip(p as any)),
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async employeePayslipDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('employeePayslipDetail', user.id, id), async () => {

      const employee = await this.resolveEmployee(user);
      const payslip = await this.prisma.payslips.findFirst({
        where: { id, employee_id: employee.id },
        include: { employees: { select: { employee_number: true } } },
      });
      if (!payslip) throw new NotFoundException('Payslip not found');
      return { success: true, data: this.mapPayslip(payslip as any) };


    });
}

  async employeeTimeOff(user: UserLike, query: any) {
    const employee = await this.resolveEmployee(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const year = query.year ? Number(query.year) : undefined;
    const where: Prisma.hr_time_off_requestsWhereInput = { employee_id: employee.id };
    if (query.status) where.status = query.status;
    if (year) {
      where.start_date = { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.hr_time_off_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { profiles: { select: { first_name: true, last_name: true, email: true } } },
      }),
      this.prisma.hr_time_off_requests.count({ where }),
    ]);
    return {
      success: true,
      data: rows.map((r) => this.mapTimeOff(r as any)),
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async employeeTasks(user: UserLike, query: any) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where: any = { assigned_to: user.id, deleted_at: null };
    if (query.priority) where.priority = query.priority;
    if (query.project_id) where.crm_project_id = Number(query.project_id);
    if (query.include_completed === 'true' || query.include_completed === true || query.status === 'completed') {
      if (query.status) where.status = query.status;
    } else if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: 'completed' };
    }
    const [rows, total] = await Promise.all([
      this.prisma.project_tasks.findMany({
        where,
        orderBy: { due_date: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { crm_projects: { select: { id: true, name: true, project_number: true } } },
      }),
      this.prisma.project_tasks.count({ where }),
    ]);
    return {
      success: true,
      data: rows,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit },
    };
  }

  async employeeTaskDetail(user: UserLike, id: number) {
    return this.cached(this.cacheKey('employeeTaskDetail', user.id, id), async () => {

      const task = await this.prisma.project_tasks.findFirst({
        where: { id, assigned_to: user.id, deleted_at: null } as any,
        include: { crm_projects: { select: { id: true, name: true, project_number: true } }, contacts: { select: { id: true, name: true, email: true } } },
      });
      if (!task) throw new NotFoundException('Task not found');
      return { success: true, data: task };


    });
}

  async employeeItSupportTicket(user: UserLike, body: any) {
    await this.invalidateCache();

    const employee = await this.resolveEmployee(user);
    const ticket = await this.prisma.tickets.create({
      data: {
        ticket_number: `EMP-${Date.now()}`,
        subject: body.subject,
        description: body.description,
        priority: body.priority || 'medium',
        category: 'IT Support',
        source: 'employee_portal',
        status: 'open',
        contact_email: user.email ? user.email.toLowerCase() : employee.profiles?.email,
        contact_name: employee.profiles ? `${employee.profiles.first_name || ''} ${employee.profiles.last_name || ''}`.trim() : undefined,
        created_by: user.id,
      } as any,
    });
    return { success: true, data: ticket };
  }

  private mapEmployee(employee: any) {
    const profile = employee.profiles || {};
    return {
      id: employee.id,
      user_id: employee.user_id,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || employee.employee_number || `Employee ${employee.id}`,
      email: profile.email || null,
      phone: profile.phone || null,
      avatar_url: profile.avatar || null,
      employee_number: employee.employee_number || null,
      department: employee.department || null,
      position: employee.position || null,
      employment_status: employee.employment_status || null,
      employment_type: employee.employment_type || null,
      hire_date: employee.hire_date,
      annual_leave_balance: toNum0(employee.annual_leave_balance),
      sick_leave_balance: toNum0(employee.sick_leave_balance),
      personal_leave_balance: toNum0(employee.personal_leave_balance),
      default_weekly_hours: toNum0(employee.default_weekly_hours),
      pay_frequency: employee.pay_frequency || null,
      salary: toNum0(employee.salary),
      hourly_rate: toNum0(employee.hourly_rate),
      work_address: employee.work_address || null,
      work_city: employee.work_city || null,
      work_state: employee.work_state || null,
      work_country: employee.work_country || null,
      work_postcode: employee.work_postcode || null,
      emergency_contact_name: employee.emergency_contact_name || null,
      emergency_contact_phone: employee.emergency_contact_phone || null,
      emergency_contact_relationship: employee.emergency_contact_relationship || null,
      timezone: employee.timezone || null,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }

  private mapContract(contract: any, manager: any) {
    const managerProfile = manager?.profiles || {};
    return {
      id: contract.id,
      contract_number: contract.contract_number || null,
      employment_type: contract.employment_type || null,
      position: contract.position || null,
      department: contract.department || null,
      start_date: contract.start_date,
      end_date: contract.end_date || null,
      renewal_date: contract.renewal_date || null,
      status: contract.status || null,
      hourly_rate: toNum0(contract.hourly_rate),
      salary: toNum0(contract.salary),
      pay_frequency: contract.pay_frequency || null,
      currency: contract.currency || 'AUD',
      default_weekly_hours: toNum0(contract.default_weekly_hours),
      work_schedule: contract.work_schedule,
      terms_summary: contract.terms_summary || null,
      notes: contract.notes || null,
      work_address: contract.work_address || null,
      work_city: contract.work_city || null,
      work_state: contract.work_state || null,
      work_country: contract.work_country || null,
      work_postcode: contract.work_postcode || null,
      employee_accepted_at: contract.employee_accepted_at || null,
      manager: manager ? { id: manager.id, name: `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim() || manager.employee_number || null, email: managerProfile.email || null } : null,
    };
  }

  private mapPayslip(payslip: any) {
    return {
      id: payslip.id,
      employee_id: payslip.employee_id,
      pay_period_start: payslip.pay_period_start,
      pay_period_end: payslip.pay_period_end,
      payment_date: payslip.payment_date,
      pay_frequency: payslip.pay_frequency || null,
      currency: payslip.currency || 'AUD',
      gross_pay: toNum0(payslip.gross_pay),
      tax_withheld: toNum0(payslip.tax_withheld),
      superannuation: toNum0(payslip.superannuation),
      net_pay: toNum0(payslip.net_pay),
      ytd_gross: toNum0(payslip.ytd_gross),
      ytd_tax: toNum0(payslip.ytd_tax),
      ytd_super: toNum0(payslip.ytd_super),
      status: payslip.status || null,
      pdf_url: payslip.pdf_url || null,
      line_items: payslip.line_items,
      leave_data: payslip.leave_data,
      notes: payslip.notes || null,
      created_at: payslip.created_at,
      updated_at: payslip.updated_at,
    };
  }

  private mapTimeOff(request: any) {
    const reviewer = request.profiles || {};
    return {
      id: request.id,
      request_number: request.request_number || null,
      leave_type: request.leave_type,
      start_date: request.start_date,
      end_date: request.end_date,
      is_partial_day: request.is_partial_day || false,
      partial_day_type: request.partial_day_type || null,
      partial_start_time: request.partial_start_time || null,
      partial_end_time: request.partial_end_time || null,
      total_days: toNum0(request.total_days),
      total_hours: toNum0(request.total_hours),
      status: request.status || null,
      reason: request.reason || null,
      notes: request.notes || null,
      reviewed_by: request.reviewed_by || null,
      reviewed_at: request.reviewed_at || null,
      review_notes: request.review_notes || null,
      balance_at_request: toNum0(request.balance_at_request),
      created_at: request.created_at,
      updated_at: request.updated_at,
      reviewer: reviewer.first_name ? { name: `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim(), email: reviewer.email || null } : null,
    };
  }

  private mapTimeEntry(entry: any) {
    return {
      id: entry.id,
      clock_in_time: entry.clock_in_time,
      clock_out_time: entry.clock_out_time || null,
      clock_in_address: entry.clock_in_address || null,
      clock_out_address: entry.clock_out_address || null,
      notes: entry.notes || null,
      break_minutes: entry.break_minutes || 0,
      total_minutes: entry.total_minutes || null,
      overtime_minutes: entry.overtime_minutes || 0,
      status: entry.status || null,
      approved_by: entry.approved_by || null,
      approved_at: entry.approved_at || null,
      approved_by_name: entry.approved_by_name || null,
      created_at: entry.created_at,
    };
  }
}
