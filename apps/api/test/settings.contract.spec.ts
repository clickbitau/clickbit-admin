import { SettingsController } from '../src/settings/settings.controller';
import { UsersController } from '../src/settings/users.controller';
import { ProfileController } from '../src/settings/profile.controller';
import { AuditLogsController } from '../src/settings/audit-logs.controller';

describe('Settings legacy contract tests', () => {
  const req = { user: { id: 1, role: 'admin', first_name: 'Admin', last_name: 'User', email: 'admin@clickbit.com.au' } };

  describe('SettingsController', () => {
    it('GET /api/settings/public/billing-settings returns public billing object', async () => {
      const service = { getPublicBillingSettings: jest.fn().mockResolvedValue({ stripePublishableKey: '' }) } as any;
      const controller = new SettingsController(service);
      const result = await controller.getPublicBilling();
      expect(service.getPublicBillingSettings).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ stripePublishableKey: '' }));
    });

    it('GET /api/settings/admin/all returns settings list', async () => {
      const service = { findAllAdmin: jest.fn().mockResolvedValue([{ setting_key: 'x' }]) } as any;
      const controller = new SettingsController(service);
      const result = await controller.getAdminAll({});
      expect(service.findAllAdmin).toHaveBeenCalledWith(expect.anything());
      expect(Array.isArray(result)).toBe(true);
    });

    it('PUT /api/settings/admin/:key returns message + setting', async () => {
      const service = { upsert: jest.fn().mockResolvedValue({ message: 'Setting updated successfully', setting: { setting_key: 'x' } }) } as any;
      const controller = new SettingsController(service);
      const result = await controller.upsertSetting('x', { setting_key: 'x', setting_value: 'v' });
      expect(service.upsert).toHaveBeenCalledWith('x', expect.anything());
      expect(result).toEqual(expect.objectContaining({ message: 'Setting updated successfully' }));
    });

    it('GET /api/settings/marketing-integrations returns marketing object', async () => {
      const service = { getMarketingIntegrations: jest.fn().mockResolvedValue({ googleAnalyticsId: '' }) } as any;
      const controller = new SettingsController(service);
      const result = await controller.getMarketingIntegrations();
      expect(result).toEqual(expect.objectContaining({ googleAnalyticsId: '' }));
    });
  });

  describe('UsersController', () => {
    it('GET /api/users returns paginated list envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } }) } as any;
      const controller = new UsersController(service);
      const result = await controller.getUsers({}, req as any);
      expect(service.findAll).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(result).toEqual(expect.objectContaining({ data: [] }));
    });

    it('GET /api/users/team returns team members', async () => {
      const service = { findTeam: jest.fn().mockResolvedValue([{ id: 1 }]) } as any;
      const controller = new UsersController(service);
      const result = await controller.getTeam();
      expect(result).toEqual([{ id: 1 }]);
    });

    it('POST /api/users returns created user', async () => {
      const service = { create: jest.fn().mockResolvedValue({ id: 2 }) } as any;
      const controller = new UsersController(service);
      const result = await controller.createUser({ first_name: 'A', last_name: 'B', email: 'a@b.com', password: 'p', role: 'customer' }, req as any);
      expect(service.create).toHaveBeenCalledWith(expect.anything(), req.user);
      expect(result).toEqual({ id: 2 });
    });
  });

  describe('ProfileController', () => {
    it('GET /api/profile returns success + data wrapper', async () => {
      const service = { getProfile: jest.fn().mockResolvedValue({ success: true, data: { user: { id: 1 } } }) } as any;
      const controller = new ProfileController(service);
      const result = await controller.getProfile(req as any);
      expect(service.getProfile).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('PUT /api/profile returns updated profile', async () => {
      const service = { updateProfile: jest.fn().mockResolvedValue({ success: true, message: 'Profile updated successfully', data: { user: {} } }) } as any;
      const controller = new ProfileController(service);
      const result = await controller.updateProfile(req as any, { first_name: 'A' });
      expect(result).toEqual(expect.objectContaining({ success: true, message: 'Profile updated successfully' }));
    });
  });

  describe('AuditLogsController', () => {
    it('GET /api/admin/audit-logs returns success + pagination envelope', async () => {
      const service = { findAll: jest.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 0, page: 1, pages: 0, limit: 50 } }) } as any;
      const controller = new AuditLogsController(service);
      const result = await controller.findAll({});
      expect(result).toEqual(expect.objectContaining({ success: true, data: [] }));
    });

    it('GET /api/admin/audit-logs/stats returns success envelope', async () => {
      const service = { stats: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new AuditLogsController(service);
      const result = await controller.stats({});
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });
});
