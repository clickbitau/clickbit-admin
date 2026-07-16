import { AdminController } from '../src/admin/admin.controller';

describe('Admin legacy contract tests', () => {
  const req = { user: { id: 1, role: 'admin', first_name: 'Admin', last_name: 'User', email: 'admin@clickbit.com.au' } };

  it('GET /api/admin/data returns admin-only message', () => {
    const service = { getData: jest.fn().mockReturnValue({ success: true, message: 'ok' }) } as any;
    const controller = new AdminController(service);
    const result = controller.getData(req as any);
    expect(service.getData).toHaveBeenCalledWith(req.user);
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('GET /api/admin/dashboard/stats returns stats envelope', async () => {
    const service = { getDashboardStats: jest.fn().mockResolvedValue({ success: true, data: { contacts: 0 } }) } as any;
    const controller = new AdminController(service);
    const result = await controller.dashboardStats();
    expect(service.getDashboardStats).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('GET /api/admin/posts returns paginated posts', async () => {
    const service = { listPosts: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
    const controller = new AdminController(service);
    const result = await controller.listPosts({});
    expect(service.listPosts).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('GET /api/admin/contacts returns paginated contacts', async () => {
    const service = { listContacts: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
    const controller = new AdminController(service);
    const result = await controller.listContacts({});
    expect(service.listContacts).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('GET /api/admin/orders returns paginated orders', async () => {
    const service = { listOrders: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
    const controller = new AdminController(service);
    const result = await controller.listOrders({});
    expect(service.listOrders).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('GET /api/admin/finance/dashboard returns finance stats', async () => {
    const service = { financeDashboard: jest.fn().mockResolvedValue({ success: true, data: { revenue: 0 } }) } as any;
    const controller = new AdminController(service);
    const result = await controller.financeDashboard();
    expect(service.financeDashboard).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });
});
