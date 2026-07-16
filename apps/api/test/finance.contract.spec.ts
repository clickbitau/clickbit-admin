import { InvoicesController } from '../src/finance/invoices.controller';
import { ExpensesController } from '../src/finance/expenses.controller';
import { PaymentsController } from '../src/finance/payments.controller';

describe('Finance legacy contract tests', () => {
  const buildRes = () => ({ set: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as any);

  describe('InvoicesController', () => {
    const listEnvelope = {
      packages: [{ id: 1, invoice_number: 'INV-2026-00001', status: 'draft' }],
      data: [{ id: 1, invoice_number: 'INV-2026-00001', status: 'draft' }],
      invoices: [{ id: 1, invoice_number: 'INV-2026-00001', status: 'draft' }],
      total: 1,
      page: 1,
      totalPages: 1,
      pagination: { total: 1, page: 1, pages: 1, limit: 10 },
    };

    const detailEnvelope = { success: true, data: { id: 1, invoice_number: 'INV-2026-00001', payments: [] } };

    it('GET /api/invoices returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new InvoicesController(service);
      const res = buildRes();
      await controller.findAll({}, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('GET /api/invoices/:id returns the legacy { success, data } envelope', async () => {
      const service = { findOne: jest.fn().mockResolvedValue(detailEnvelope) } as any;
      const controller = new InvoicesController(service);
      const res = buildRes();
      await controller.findOne(1, res);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(detailEnvelope);
    });

    it('POST /api/invoices/:id/record-payment returns { success, data, payment } envelope', async () => {
      const service = {
        recordPayment: jest.fn().mockResolvedValue({
          success: true,
          message: 'Payment recorded successfully',
          data: { id: 1 },
          payment: { id: 99 },
          creditBalance: 0,
        }),
      } as any;
      const controller = new InvoicesController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.recordPayment(1, { amount: 50 }, req, res);
      expect(service.recordPayment).toHaveBeenCalledWith(1, 1, { amount: 50 });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, payment: expect.any(Object) }));
    });
  });

  describe('ExpensesController', () => {
    const listEnvelope = {
      success: true,
      data: [{ id: 1, expense_number: 'EXP-00001' }],
      pagination: { total: 1, page: 1, pages: 1, limit: 10 },
    };

    it('GET /api/expenses returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new ExpensesController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('GET /api/expenses/:id returns { success, data }', async () => {
      const service = { findOne: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new ExpensesController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.findOne(1, req, res);
      expect(service.findOne).toHaveBeenCalledWith(1, req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('PaymentsController', () => {
    const listEnvelope = {
      payments: [{ id: 1, amount: 100 }],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 },
    };

    it('GET /api/payments returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new PaymentsController(service);
      const res = buildRes();
      await controller.findAll({}, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('POST /api/payments returns { message, payment } with 201 status', async () => {
      const service = { create: jest.fn().mockResolvedValue({ message: 'Payment created', payment: { id: 1 } }) } as any;
      const controller = new PaymentsController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.create({} as any, req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Payment created', payment: expect.any(Object) }));
    });

    it('DELETE /api/payments/:id returns { success, message }', async () => {
      const service = { remove: jest.fn().mockResolvedValue({ success: true, message: 'Payment deleted' }) } as any;
      const controller = new PaymentsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.remove('1', req, res);
      expect(service.remove).toHaveBeenCalledWith(req.user, '1');
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Payment deleted' });
    });
  });
});
