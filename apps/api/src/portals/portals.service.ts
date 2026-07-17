import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PublicInvoicesService } from '../finance/public-invoices.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicInvoices: PublicInvoicesService,
  ) {}

  private async resolveCustomer(user: UserLike) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: user.id } });
    const email = user.email?.toLowerCase();
    const emailContacts = email
      ? await this.prisma.contacts.findMany({
          where: { email: { equals: email, mode: 'insensitive' }, deleted_at: null },
          orderBy: { id: 'asc' },
        })
      : [];
    const profileContact = profile?.contact_id
      ? await this.prisma.contacts.findUnique({ where: { id: profile.contact_id } })
      : null;
    const contacts = [...emailContacts];
    if (profileContact && !contacts.some((c) => c.id === profileContact.id)) contacts.push(profileContact);
    const contactIds = cleanIds([...new Set(contacts.map((c) => c.id).filter(Boolean))]);
    const companyIds = cleanIds([...new Set([profile?.company_id, ...contacts.map((c) => c.company_id)].filter(Boolean))]);
    return { profile, contacts, contactIds, companyIds, emails: contacts.map((c) => c.email).filter(Boolean) };
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
    const ors: any[] = [{ source_id: { in: contactIds }, source_type: 'contact' }];
    if (companyIds.length) ors.push({ company_id: { in: companyIds } });
    return { OR: ors, deleted_at: null, document_type: 'invoice' } as any;
  }

  private projectScope(contactIds: number[], companyIds: number[]): any {
    const ors: any[] = [];
    if (contactIds.length) ors.push({ customer_id: { in: contactIds } });
    if (companyIds.length) ors.push({ company_id: { in: companyIds } });
    return { OR: ors, deleted_at: null, customer_visible: true } as any;
  }

  private ticketScopeByEmails(emails: string[], userIds: number[]): any {
    const ors: any[] = [];
    if (emails.length) ors.push({ contact_email: { in: emails } });
    if (userIds.length) ors.push({ user_id: { in: userIds } });
    return { OR: ors, deleted_at: null } as any;
  }

  // -------------------------------------------------------------------------
  // Agent portal
  // -------------------------------------------------------------------------
  async agentDashboard(user: UserLike) {
    const { agentContact, clients, contactIds, companyIds } = await this.resolveAgent(user);
    const invoiceWhere = this.invoiceScope(contactIds, companyIds);
    const projectWhere = this.projectScope(contactIds, companyIds);

    const [invoiceStats, overdueInvoices, projectCount, ticketCount, companyCount] = await Promise.all([
      this.prisma.invoices.aggregate({ where: invoiceWhere, _sum: { total_amount: true, amount_paid: true }, _count: true }),
      this.prisma.invoices.findMany({
        where: { ...invoiceWhere, due_date: { lt: new Date() } },
        select: { total_amount: true, amount_paid: true },
      }),
      this.prisma.crm_projects.count({ where: projectWhere }),
      this.prisma.tickets.count({ where: this.ticketScopeByEmails(clients.map((c) => c.email).filter(Boolean), contactIds) }),
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
    const { contactIds, companyIds } = await this.resolveAgent(user);
    const project = await this.prisma.crm_projects.findFirst({
      where: { id, ...this.projectScope(contactIds, companyIds) },
    });
    if (!project) throw new NotFoundException('Project not found');
    return { success: true, data: project };
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
    const { contactIds } = await this.resolveAgent(user);
    const contact = await this.prisma.contacts.findFirst({ where: { id: contactId, agent_id: { in: contactIds }, deleted_at: null } });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.prisma.contacts.update({ where: { id: contactId }, data: { company_id: companyId } });
    return { success: true, message: 'Contact assigned to company' };
  }

  async agentCreateCompanyUser(user: UserLike, companyId: number, body: any) {
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
    const { clients, contactIds, companyIds: _companyIds } = await this.resolveAgent(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, contactIds);
    const [rows, total] = await Promise.all([
      this.prisma.tickets.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.tickets.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async agentCreateTicket(user: UserLike, body: any) {
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
    const { clients, contactIds } = await this.resolveAgent(user);
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, contactIds);
    const ticket = await this.prisma.tickets.findFirst({
      where: { id, ...where },
      include: { ticket_messages: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { success: true, data: ticket };
  }

  async agentTicketReply(user: UserLike, id: number, body: any) {
    const { clients, contactIds } = await this.resolveAgent(user);
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, contactIds);
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
    const { clients, contactIds } = await this.resolveAgent(user);
    const emails = clients.map((c) => c.email).filter(Boolean);
    const where = this.ticketScopeByEmails(emails, contactIds);
    const count = await this.prisma.tickets.count({ where });
    return { success: true, data: { used: count, limit: 100, remaining: Math.max(0, 100 - count) } };
  }

  // -------------------------------------------------------------------------
  // Customer portal
  // -------------------------------------------------------------------------
  async customerDashboard(user: UserLike) {
    const { contactIds, companyIds, profile, emails } = await this.resolveCustomer(user);
    const invoiceWhere = this.invoiceScope(contactIds, companyIds);
    const projectWhere = this.projectScope(contactIds, companyIds);
    const ticketWhere = this.ticketScopeByEmails(emails, [user.id]);
    const [invoiceStats, invoiceCount, projectCount, taskCount, documentCount, paymentCount, orderCount, ticketCount] = await Promise.all([
      this.prisma.invoices.aggregate({ where: invoiceWhere, _sum: { total_amount: true, amount_paid: true } }),
      this.prisma.invoices.count({ where: invoiceWhere }),
      this.prisma.crm_projects.count({ where: projectWhere }),
      this.prisma.project_tasks.count({ where: { customer_id: { in: contactIds }, deleted_at: null } as any }),
      this.prisma.documents.count({ where: { OR: [{ related_entity_id: { in: companyIds }, related_entity_type: 'company' }, { related_entity_id: { in: contactIds }, related_entity_type: 'contact' }], status: 'active' } as any }),
      this.prisma.payments.count({ where: { user_id: user.id, deleted_at: null } }),
      this.prisma.orders.count({ where: { OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }], deleted_at: null } as any }),
      this.prisma.tickets.count({ where: ticketWhere }),
    ]);
    const total = toNum0(invoiceStats._sum?.total_amount);
    const paid = toNum0(invoiceStats._sum?.amount_paid);
    return {
      success: true,
      data: {
        name: profile ? `${profile.first_name} ${profile.last_name}` : null,
        outstanding_balance: total - paid,
        total_invoiced: total,
        total_paid: paid,
        invoice_count: invoiceCount,
        project_count: projectCount,
        task_count: taskCount,
        document_count: documentCount,
        payment_count: paymentCount,
        order_count: orderCount,
        ticket_count: ticketCount,
      },
    };
  }

  async customerOrders(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where: any = { deleted_at: null, OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }] };
    const [rows, total] = await Promise.all([
      this.prisma.orders.findMany({ where, include: { order_items: true }, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.orders.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerOrderDetail(user: UserLike, id: number) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const order = await this.prisma.orders.findFirst({
      where: { id, deleted_at: null, OR: [{ user_id: user.id }, { contact_id: { in: contactIds } }, { company_id: { in: companyIds } }] } as any,
      include: { order_items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { success: true, data: order };
  }

  async customerInvoices(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where = this.invoiceScope(contactIds, companyIds);
    const [rows, total] = await Promise.all([
      this.prisma.invoices.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: (page - 1) * limit }),
      this.prisma.invoices.count({ where }),
    ]);
    return { success: true, data: rows, pagination: { currentPage: page, totalPages: Math.ceil(total / limit) || 1, totalItems: total, itemsPerPage: limit } };
  }

  async customerInvoiceDetail(user: UserLike, id: number) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const invoice = await this.prisma.invoices.findFirst({ where: { id, ...this.invoiceScope(contactIds, companyIds) } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return { success: true, data: invoice };
  }

  async customerProjects(user: UserLike, query: any) {
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const where = this.projectScope(contactIds, companyIds);
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
    const invoice = await this.customerInvoiceDetail(user, id);
    const token = await this.ensureInvoiceToken(invoice.data);
    return this.publicInvoices.createCheckoutSession(invoice.data.package_code, body, token);
  }

  async customerVerifyPayment(user: UserLike, id: number, body: any) {
    const invoice = await this.customerInvoiceDetail(user, id);
    const sessionId = body?.session_id || body?.sessionId;
    if (!sessionId) throw new BadRequestException('session_id is required');
    const result = await this.publicInvoices.confirmPayment(invoice.data.package_code, sessionId, invoice.data.token || undefined);
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
    const { contactIds, companyIds } = await this.resolveCustomer(user);
    const ors: any[] = [];
    if (companyIds.length) ors.push({ related_entity_id: { in: companyIds }, related_entity_type: 'company' });
    if (contactIds.length) ors.push({ related_entity_id: { in: contactIds }, related_entity_type: 'contact' });
    const doc = await this.prisma.documents.findFirst({ where: { id, OR: ors, status: 'active' } as any });
    if (!doc) throw new NotFoundException('Document not found');
    return { success: true, data: doc };
  }

  async customerDocumentDownload(user: UserLike, id: number) {
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
    const { contactIds } = await this.resolveCustomer(user);
    const task = await this.prisma.project_tasks.findFirst({ where: { id, deleted_at: null, customer_id: { in: contactIds } } as any });
    if (!task) throw new NotFoundException('Task not found');
    return { success: true, data: task };
  }

  async customerAddTaskComment(user: UserLike, id: number, body: any) {
    await this.customerTaskDetail(user, id);
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: id,
        author_id: user.id,
        content: body.content,
        is_internal: false,
      } as any,
    });
    return { success: true, data: comment };
  }
}
