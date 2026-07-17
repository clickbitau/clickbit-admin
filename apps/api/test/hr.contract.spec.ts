import { HrController } from '../src/hr/hr.controller';
import { EmployeesController } from '../src/hr/employees.controller';
import { TimeOffController } from '../src/hr/time-off.controller';
import { AnnouncementsController } from '../src/hr/announcements.controller';
import { RemindersController } from '../src/hr/reminders.controller';
import { PublicHolidaysController } from '../src/hr/public-holidays.controller';
import { TimeClockController } from '../src/hr/time-clock.controller';
import { TimesheetsController } from '../src/hr/timesheets.controller';
import { ShiftsController } from '../src/hr/shifts.controller';

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

  describe('TimeClockController', () => {
    it('GET /api/hr/time-clock/status returns { success, data }', async () => {
      const service = { status: jest.fn().mockResolvedValue({ success: true, data: {} }) } as any;
      const controller = new TimeClockController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'employee' } } as any;
      await controller.status(req, res);
      expect(service.status).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('GET /api/hr/time-clock/active returns { success, data }', async () => {
      const service = { activeEntries: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new TimeClockController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.active(req, res);
      expect(service.activeEntries).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/time-clock/clock-in returns { success, message, data }', async () => {
      const service = { clockIn: jest.fn().mockResolvedValue({ success: true, message: 'Clocked in', data: { id: 1 } }) } as any;
      const controller = new TimeClockController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'employee' }, headers: {}, ip: '127.0.0.1' } as any;
      await controller.clockIn({}, req, res);
      expect(service.clockIn).toHaveBeenCalledWith(req.user, {}, req);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('TimesheetsController', () => {
    it('GET /api/hr/timesheets returns { success, data }', async () => {
      const service = { findAll: jest.fn().mockResolvedValue({ success: true, data: [], summary: {}, pagination: { total: 0, page: 1, pages: 1, limit: 50 } }) } as any;
      const controller = new TimesheetsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/timesheets/:id/approve returns { success, message, data }', async () => {
      const service = { approve: jest.fn().mockResolvedValue({ success: true, message: 'Time entry approved', data: { id: 1 } }) } as any;
      const controller = new TimesheetsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.approve('1', req, res);
      expect(service.approve).toHaveBeenCalledWith(1, req.user, req);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/timesheets/manual returns { success, message, data } with 201', async () => {
      const service = { manual: jest.fn().mockResolvedValue({ success: true, message: 'Manual time entry created', data: { id: 1 } }) } as any;
      const controller = new TimesheetsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' }, headers: {}, ip: '127.0.0.1' } as any;
      await controller.manual({ clock_in_time: '2026-07-15T09:00:00Z', reason: 'Test' }, req, res);
      expect(service.manual).toHaveBeenCalledWith(expect.anything(), req.user, req);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('ShiftsController', () => {
    it('GET /api/hr/shifts returns { success, data }', async () => {
      const service = { findAll: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new ShiftsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.findAll({}, req, res);
      expect(service.findAll).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/shifts returns { success, data } with 201', async () => {
      const service = { create: jest.fn().mockResolvedValue({ success: true, data: { id: 1 } }) } as any;
      const controller = new ShiftsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.create({ employee_id: '1', shift_date: '2026-07-15', start_time: '09:00', end_time: '17:00' }, req, res);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user, req);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('POST /api/hr/shifts/copy-week returns { success, message, data }', async () => {
      const service = { copyWeek: jest.fn().mockResolvedValue({ success: true, message: '1 shifts copied', data: [] }) } as any;
      const controller = new ShiftsController(service);
      const res = buildRes();
      const req = { user: { id: 1, role: 'admin' } } as any;
      await controller.copyWeek({ source_week_start: '2026-07-14', target_week_start: '2026-07-21' }, req, res);
      expect(service.copyWeek).toHaveBeenCalledWith(expect.anything(), req.user, req);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
