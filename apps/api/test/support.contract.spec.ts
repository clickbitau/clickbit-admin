import { TicketsController } from '../src/support/tickets.controller';
import { TicketAutomationController } from '../src/support/ticket-automation.controller';

describe('Support legacy contract tests', () => {
  const buildRes = () =>
    ({ setHeader: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() } as unknown as any);

  describe('TicketsController', () => {
    it('POST /api/tickets returns { message, ticket }', async () => {
      const envelope = { message: 'Ticket created successfully', ticket: { id: 1, ticket_number: 'TKT-1' } };
      const service = { create: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketsController(service);
      const req = { user: { id: 1, email: 'user@example.com', role: 'customer' } } as any;
      const result = await controller.create({ subject: 'Help', description: 'Issue' }, req);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(result).toEqual(envelope);
    });

    it('GET /api/tickets/admin returns { tickets, pagination }', async () => {
      const envelope = {
        tickets: [{ id: 1, ticket_number: 'TKT-1' }],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 20 },
      };
      const service = { findAllAdmin: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketsController(service);
      const req = { user: { id: 1, role: 'admin' } } as any;
      const result = await controller.findAllAdmin(req, { page: 1, limit: 20 });
      expect(service.findAllAdmin).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(envelope);
    });

    it('GET /api/tickets/admin/stats returns stats envelope', async () => {
      const envelope = {
        overview: { total: 0, open: 0, unassigned: 0, overdue: 0, newThisPeriod: 0, resolvedThisPeriod: 0 },
        byStatus: {},
        byPriority: {},
        byCategory: {},
        byAssignee: [],
        performance: { avgFirstResponseHours: null, avgResolutionHours: null, avgSatisfactionRating: null, totalRatings: 0 },
        period: 30,
      };
      const service = { getStats: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketsController(service);
      const result = await controller.getStats('30');
      expect(service.getStats).toHaveBeenCalledWith(30);
      expect(result).toEqual(envelope);
    });

    it('GET /api/tickets/admin/:id returns a ticket', async () => {
      const ticket = { id: 1, ticket_number: 'TKT-1', messages: [] };
      const service = { findOneAdmin: jest.fn().mockResolvedValue(ticket) } as any;
      const controller = new TicketsController(service);
      const result = await controller.findOneAdmin('1');
      expect(service.findOneAdmin).toHaveBeenCalledWith(1);
      expect(result).toEqual(ticket);
    });

    it('POST /api/tickets/admin/:id/reply returns { message, reply, ticket }', async () => {
      const envelope = { message: 'Reply added successfully', reply: { id: 1 }, ticket: { id: 1 } };
      const service = { replyAdmin: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketsController(service);
      const req = { user: { id: 1, role: 'admin' } } as any;
      const result = await controller.replyAdmin('1', req, { message: 'Thanks' });
      expect(service.replyAdmin).toHaveBeenCalledWith(1, req.user, expect.anything());
      expect(result).toEqual(envelope);
    });

    it('PUT /api/tickets/admin/:id returns { message, ticket }', async () => {
      const envelope = { message: 'Ticket updated successfully', ticket: { id: 1 } };
      const service = { updateAdmin: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketsController(service);
      const req = { user: { id: 1, role: 'admin' } } as any;
      const result = await controller.updateAdmin('1', req, { status: 'resolved' });
      expect(service.updateAdmin).toHaveBeenCalledWith(1, req.user, expect.anything());
      expect(result).toEqual(envelope);
    });

    it('GET /api/tickets/admin/export sends CSV headers', async () => {
      const service = { exportCsv: jest.fn().mockResolvedValue({ csv: 'a,b', filename: 'tickets.csv' }) } as any;
      const controller = new TicketsController(service);
      const res = buildRes();
      await controller.exportCsv({}, res);
      expect(service.exportCsv).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith('a,b');
    });
  });

  describe('TicketAutomationController', () => {
    it('GET /api/ticket-automation/customer-repositories returns { success, data }', async () => {
      const envelope = { success: true, data: [{ id: 1, repo_full_name: 'owner/repo' }] };
      const service = { getCustomerRepositories: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketAutomationController(service);
      const result = await controller.getCustomerRepositories();
      expect(service.getCustomerRepositories).toHaveBeenCalled();
      expect(result).toEqual(envelope);
    });

    it('GET /api/ticket-automation/quotas returns { success, data, defaults }', async () => {
      const envelope = { success: true, data: [], defaults: { free_limit: 5, period: 'monthly', price_cents: 5000, currency: 'AUD' } };
      const service = { getQuotas: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketAutomationController(service);
      const result = await controller.getQuotas();
      expect(service.getQuotas).toHaveBeenCalled();
      expect(result).toEqual(envelope);
    });

    it('POST /api/ticket-automation/customer-repositories returns { success, data }', async () => {
      const envelope = { success: true, data: { id: 1, repo_full_name: 'owner/repo' } };
      const service = { createCustomerRepository: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new TicketAutomationController(service);
      const result = await controller.createCustomerRepository({ repo_full_name: 'owner/repo' });
      expect(service.createCustomerRepository).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(envelope);
    });
  });
});
