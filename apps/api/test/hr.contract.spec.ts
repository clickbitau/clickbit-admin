import { HrController } from '../src/hr/hr.controller';
import { EmployeesController } from '../src/hr/employees.controller';
import { TimeOffController } from '../src/hr/time-off.controller';
import { AnnouncementsController } from '../src/hr/announcements.controller';
import { RemindersController } from '../src/hr/reminders.controller';
import { PublicHolidaysController } from '../src/hr/public-holidays.controller';

describe('HR legacy contract tests', () => {
  const buildRes = () => ({ set: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as any);

  describe('HrController', () => {
    it('GET /api/hr/dashboard returns { success, data }', async () => {
      const envelope = { success: true, data: { stats: {}, recentAnnouncements: [] } };
      const service = { getDashboardStats: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new HrController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.dashboard(req, res);
      expect(service.getDashboardStats).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith(envelope);
    });

    it('GET /api/hr/employee-dashboard returns { success, data }', async () => {
      const envelope = { success: true, data: { employee: {} } };
      const service = { getEmployeeDashboard: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new HrController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'employee' } } as any;
      await controller.employeeDashboard(req, res);
      expect(service.getEmployeeDashboard).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith(envelope);
    });
  });

  describe('EmployeesController', () => {
    const listEnvelope = { success: true, data: [{ id: 1 }], pagination: { total: 1, page: 1, pages: 1, limit: 10 } };

    it('GET /api/hr/employees returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new EmployeesController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('GET /api/hr/employees/me returns { success, data }', async () => {
      const service = { findMe: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new EmployeesController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.findMe(req, res);
      expect(service.findMe).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('GET /api/hr/employees/:id returns { success, data }', async () => {
      const service = { findOne: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new EmployeesController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.findOne(1, req, res);
      expect(service.findOne).toHaveBeenCalledWith(1, req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/employees returns { success, data } with 201', async () => {
      const service = { create: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new EmployeesController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.create({ user_id: 1 }, req, res);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('TimeOffController', () => {
    const listEnvelope = { success: true, data: [{ id: 1 }], pagination: { total: 1, page: 1, pages: 1, limit: 10 } };

    it('GET /api/hr/time-off returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new TimeOffController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('POST /api/hr/time-off/:id/approve returns { success, message, data }', async () => {
      const service = { approve: jest.fn().mockResolvedValue({ success: true, message: 'Request approved', data: { id: 1 } }) } as any;
      const controller = new TimeOffController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.approve(1, {}, req, res);
      expect(service.approve).toHaveBeenCalledWith(1, expect.anything(), req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.any(String) }));
    });

    it('GET /api/hr/time-off/calendar returns { success, data }', async () => {
      const service = { calendar: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new TimeOffController(service);
      const res = buildRes();
      await controller.calendar({}, res);
      expect(service.calendar).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('AnnouncementsController', () => {
    const listEnvelope = { success: true, data: [{ id: 1 }], pagination: { total: 1, page: 1, pages: 1, limit: 10 } };

    it('GET /api/hr/announcements returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new AnnouncementsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('POST /api/hr/announcements returns { success, data } with 201', async () => {
      const service = { create: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new AnnouncementsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.create({ title: 'Hello', content: 'World' }, req, res);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('RemindersController', () => {
    const listEnvelope = { success: true, data: [{ id: 1 }], pagination: { total: 1, page: 1, pages: 1, limit: 10 } };

    it('GET /api/hr/reminders returns the legacy list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new RemindersController(service);
      const res = buildRes();
      await controller.findAll({}, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('POST /api/hr/reminders/:id/complete returns { success, message, data }', async () => {
      const service = { complete: jest.fn().mockResolvedValue({ success: true, message: 'Reminder marked as complete' }) } as any;
      const controller = new RemindersController(service);
      const res = buildRes();
      const req = { user: { id: 1 } } as any;
      await controller.complete(1, req, res);
      expect(service.complete).toHaveBeenCalledWith(1, req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.any(String) }));
    });
  });

  describe('PublicHolidaysController', () => {
    const listEnvelope = { success: true, data: [{ id: 1 }], count: 1 };

    it('GET /api/hr/public-holidays returns { success, data, count }', async () => {
      const service = { findAll: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new PublicHolidaysController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(listEnvelope);
    });

    it('POST /api/hr/public-holidays returns { success, data } with 201', async () => {
      const service = { create: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new PublicHolidaysController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.create({ name: 'Holiday', holiday_date: '2026-01-01' }, req, res);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
