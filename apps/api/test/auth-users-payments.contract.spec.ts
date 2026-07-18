import { AuthController } from '../src/auth/auth.controller';
import { UsersController } from '../src/settings/users.controller';
import { PublicPaymentsController } from '../src/finance/payments-public.controller';

describe('Auth / Users / Public Payments legacy contract tests', () => {
  const req = { user: { id: 1, role: 'admin', first_name: 'Admin', last_name: 'User', email: 'admin@clickbit.com.au' } };

  describe('AuthController', () => {
    it('POST /api/auth/register returns success message', async () => {
      const service = { register: jest.fn().mockResolvedValue({ success: true, message: 'registered' }) } as any;
      const controller = new AuthController(service);
      const result = await controller.register({ email: 'a@b.com', password: '12345678', first_name: 'Test', last_name: 'User' });
      expect(service.register).toHaveBeenCalledWith({ email: 'a@b.com', password: '12345678', first_name: 'Test', last_name: 'User' });
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('POST /api/auth/login returns token envelope', async () => {
      const service = { login: jest.fn().mockResolvedValue({ success: true, data: { accessToken: 'tok' } }) } as any;
      const controller = new AuthController(service);
      const result = await controller.login({ email: 'a@b.com', password: 'x' });
      expect(service.login).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/auth/me returns user profile', async () => {
      const service = { me: jest.fn().mockResolvedValue({ success: true, data: { user: { id: 1 } } }) } as any;
      const controller = new AuthController(service);
      const result = await controller.me(req as any);
      expect(service.me).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('POST /api/auth/forgot-password returns success message', async () => {
      const service = { forgotPassword: jest.fn().mockResolvedValue({ success: true, message: 'sent' }) } as any;
      const controller = new AuthController(service);
      const result = await controller.forgotPassword({ email: 'a@b.com' });
      expect(service.forgotPassword).toHaveBeenCalledWith({ email: 'a@b.com' });
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('POST /api/auth/refresh returns new tokens', async () => {
      const service = { refresh: jest.fn().mockResolvedValue({ success: true, data: { accessToken: 'a' } }) } as any;
      const controller = new AuthController(service);
      const result = await controller.refresh({ refreshToken: 'tok' });
      expect(service.refresh).toHaveBeenCalledWith({ refreshToken: 'tok' });
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('UsersController', () => {
    it('GET /api/users/:id/account-status returns status payload', async () => {
      const service = { accountStatus: jest.fn().mockResolvedValue({ user_id: 1, has_auth: false }) } as any;
      const controller = new UsersController(service);
      const result = await controller.accountStatus('1');
      expect(service.accountStatus).toHaveBeenCalledWith(1);
      expect(result).toEqual(expect.objectContaining({ user_id: 1 }));
    });

    it('POST /api/users/:id/reset-2fa returns success message', async () => {
      const service = { reset2fa: jest.fn().mockResolvedValue({ success: true, removedFactors: 0 }) } as any;
      const controller = new UsersController(service);
      const result = await controller.reset2fa('1');
      expect(service.reset2fa).toHaveBeenCalledWith(1);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/users/permissions/available returns definitions', () => {
      const service = { availablePermissions: jest.fn().mockReturnValue({ availablePermissions: { dashboard: [] }, defaultManagerPermissions: [] }) } as any;
      const controller = new UsersController(service);
      const result = controller.availablePermissions();
      expect(service.availablePermissions).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ availablePermissions: expect.any(Object) }));
    });

    it('GET /api/users/:id/permissions returns permissions envelope', async () => {
      const service = { getPermissions: jest.fn().mockResolvedValue({ user: { id: 1 }, effectivePermissions: [] }) } as any;
      const controller = new UsersController(service);
      const result = await controller.getPermissions('1');
      expect(service.getPermissions).toHaveBeenCalledWith(1);
      expect(result).toEqual(expect.objectContaining({ user: expect.any(Object) }));
    });

    it('PUT /api/users/:id/permissions returns updated permissions', async () => {
      const service = { updatePermissions: jest.fn().mockResolvedValue({ message: 'ok' }) } as any;
      const controller = new UsersController(service);
      const result = await controller.updatePermissions('1', { permissions: ['users:list'] });
      expect(service.updatePermissions).toHaveBeenCalledWith(1, ['users:list']);
      expect(result).toEqual(expect.objectContaining({ message: 'ok' }));
    });
  });

  describe('PublicPaymentsController', () => {
    it('GET /api/payments/status returns Stripe configuration status', () => {
      const service = { getStatus: jest.fn().mockReturnValue({ stripe: { configured: false, status: 'not configured' } }) } as any;
      const controller = new PublicPaymentsController(service);
      const result = controller.status();
      expect(service.getStatus).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ stripe: expect.any(Object) }));
    });

    it('POST /api/payments/create-payment-intent returns client secret', async () => {
      const service = { createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'sec', paymentIntentId: 'pi_1' }) } as any;
      const controller = new PublicPaymentsController(service);
      const result = await controller.createPaymentIntent({ amount: 100 });
      expect(service.createPaymentIntent).toHaveBeenCalledWith({ amount: 100 });
      expect(result).toEqual(expect.objectContaining({ clientSecret: 'sec' }));
    });

    it('POST /api/payments/create-checkout-session returns session url', async () => {
      const service = { createCheckoutSession: jest.fn().mockResolvedValue({ sessionId: 'cs_1', url: 'https://example.com', orderId: 1 }) } as any;
      const controller = new PublicPaymentsController(service);
      const result = await controller.createCheckoutSession({ items: [] }, { ip: '127.0.0.1' } as any);
      expect(service.createCheckoutSession).toHaveBeenCalledWith({ items: [] }, '127.0.0.1');
      expect(result).toEqual(expect.objectContaining({ sessionId: 'cs_1' }));
    });
  });
});
