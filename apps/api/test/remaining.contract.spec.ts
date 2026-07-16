import { VerifyController } from '../src/verify/verify.controller';
import { CredentialsController } from '../src/credentials/credentials.controller';
import { ClickdeployController } from '../src/clickdeploy/clickdeploy.controller';
import { PdfTemplatesController } from '../src/settings/pdf-templates.controller';

describe('Remaining legacy contract tests', () => {
  describe('VerifyController', () => {
    it('GET /api/verify/:code returns validation result', async () => {
      const service = { verify: jest.fn().mockResolvedValue({ valid: true }) } as any;
      const controller = new VerifyController(service);
      const req: any = { headers: {}, ip: '127.0.0.1' };
      const result = await controller.verify('ABC123', req);
      expect(service.verify).toHaveBeenCalledWith('ABC123', '127.0.0.1');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('CredentialsController', () => {
    it('GET /api/credentials returns grouped credentials', async () => {
      const service = { getAll: jest.fn().mockResolvedValue({ categories: {} }) } as any;
      const controller = new CredentialsController(service);
      const result = await controller.getAll();
      expect(service.getAll).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ categories: {} }));
    });

    it('PUT /api/credentials/:key updates a credential', async () => {
      const service = { set: jest.fn().mockResolvedValue({ message: 'ok' }) } as any;
      const controller = new CredentialsController(service);
      const result = await controller.update('SMTP_HOST', { value: 'smtp.example.com' });
      expect(service.set).toHaveBeenCalledWith('SMTP_HOST', 'smtp.example.com');
      expect(result).toEqual(expect.objectContaining({ message: 'ok' }));
    });
  });

  describe('ClickdeployController', () => {
    it('POST /api/clickdeploy/activate returns validity', async () => {
      const service = { activate: jest.fn().mockResolvedValue({ valid: true }) } as any;
      const controller = new ClickdeployController(service);
      const result = await controller.activate({ code: 'X' });
      expect(service.activate).toHaveBeenCalledWith({ code: 'X' });
      expect(result).toEqual(expect.objectContaining({ valid: true }));
    });

    it('POST /api/clickdeploy/heartbeat returns validity', async () => {
      const service = { heartbeat: jest.fn().mockResolvedValue({ valid: true }) } as any;
      const controller = new ClickdeployController(service);
      const result = await controller.heartbeat({ code: 'X' });
      expect(service.heartbeat).toHaveBeenCalledWith({ code: 'X' });
      expect(result).toEqual(expect.objectContaining({ valid: true }));
    });
  });

  describe('PdfTemplatesController', () => {
    it('GET /api/settings/pdf-templates returns templates', async () => {
      const service = { findAll: jest.fn().mockResolvedValue({ templates: [] }) } as any;
      const controller = new PdfTemplatesController(service);
      const result = await controller.findAll();
      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ templates: [] }));
    });
  });
});
