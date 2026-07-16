import { MessagesController } from '../src/communication/messages.controller';
import { ChatController } from '../src/communication/chat.controller';
import { MailController } from '../src/communication/mail.controller';

describe('Communication legacy contract tests', () => {
  const req = { user: { id: 1, role: 'admin', email: 'admin@test.com', first_name: 'Admin', last_name: 'User' } };

  describe('MessagesController', () => {
    const listEnvelope = {
      success: true,
      messages: [{ id: 1, content: 'hello' }],
      pagination: { limit: 50, hasMore: false, hasPrevious: false, nextCursor: null, previousCursor: null },
    };

    it('GET /api/messages/channel/:channelId returns messages with cursor pagination', async () => {
      const service = { listChannelMessages: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new MessagesController(service);
      const result = await controller.listChannel(1, req, { limit: 50 });
      expect(service.listChannelMessages).toHaveBeenCalledWith(req.user, 1, expect.anything());
      expect(result).toEqual(listEnvelope);
    });

    it('GET /api/messages/direct-message/:dmId returns messages with cursor pagination', async () => {
      const service = { listDmMessages: jest.fn().mockResolvedValue(listEnvelope) } as any;
      const controller = new MessagesController(service);
      const result = await controller.listDm(2, req, { limit: 50 });
      expect(service.listDmMessages).toHaveBeenCalledWith(req.user, 2, expect.anything());
      expect(result).toEqual(listEnvelope);
    });

    it('POST /api/messages returns { success, data: message }', async () => {
      const envelope = { success: true, data: { id: 1, content: 'hello' } };
      const service = { create: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new MessagesController(service);
      const result = await controller.create(req, { channelId: 1, content: 'hello' });
      expect(service.create).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(envelope);
    });

    it('PUT /api/messages/:messageId returns { success, data: message }', async () => {
      const envelope = { success: true, data: { id: 1, content: 'updated' } };
      const service = { update: jest.fn().mockResolvedValue(envelope) } as any;
      const controller = new MessagesController(service);
      const result = await controller.update(1, req, { content: 'updated' });
      expect(service.update).toHaveBeenCalledWith(req.user, 1, expect.anything());
      expect(result).toEqual(envelope);
    });

    it('DELETE /api/messages/:messageId returns { success, message }', async () => {
      const service = { remove: jest.fn().mockResolvedValue({ success: true, message: 'Message deleted successfully' }) } as any;
      const controller = new MessagesController(service);
      const result = await controller.remove(1, req);
      expect(service.remove).toHaveBeenCalledWith(req.user, 1);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('POST /api/messages/:messageId/reactions returns { success, message }', async () => {
      const service = { addReaction: jest.fn().mockResolvedValue({ success: true, message: 'Reaction added' }) } as any;
      const controller = new MessagesController(service);
      const result = await controller.addReaction(1, req, { emoji: '👍' });
      expect(service.addReaction).toHaveBeenCalledWith(req.user, 1, '👍');
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/messages/search returns { success, data, pagination }', async () => {
      const service = { search: jest.fn().mockResolvedValue({ success: true, data: [], pagination: { count: 0, limit: 50, offset: 0 } }) } as any;
      const controller = new MessagesController(service);
      const result = await controller.search(req, { query: 'hello' });
      expect(service.search).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('ChatController', () => {
    it('GET /api/chat/participants returns { success, data }', async () => {
      const service = { participants: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new ChatController(service);
      const result = await controller.participants(req);
      expect(service.participants).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/chat/workspaces returns { success, data }', async () => {
      const service = { listWorkspaces: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new ChatController(service);
      const result = await controller.listWorkspaces(req);
      expect(service.listWorkspaces).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/chat/direct-messages returns { success, data, pagination }', async () => {
      const service = { listDirectMessages: jest.fn().mockResolvedValue({ success: true, data: [], pagination: { count: 0, limit: 50, offset: 0 } }) } as any;
      const controller = new ChatController(service);
      const result = await controller.listDirectMessages(req, { limit: 50, offset: 0 });
      expect(service.listDirectMessages).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/chat/channels returns { success, data }', async () => {
      const service = { listChannels: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new ChatController(service);
      const result = await controller.listChannels(req, { workspace_id: 1 });
      expect(service.listChannels).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('MailController', () => {
    it('GET /api/mail/presets returns { success, data }', () => {
      const service = { getPresets: jest.fn().mockReturnValue({ success: true, data: {} }) } as any;
      const controller = new MailController(service);
      const result = controller.getPresets();
      expect(service.getPresets).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/mail/accounts returns { success, data }', async () => {
      const service = { listAccounts: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new MailController(service);
      const result = await controller.listAccounts(req);
      expect(service.listAccounts).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('POST /api/mail/accounts returns { success, data }', async () => {
      const service = { createAccount: jest.fn().mockResolvedValue({ success: true, data: { id: 'abc' } }) } as any;
      const controller = new MailController(service);
      const result = await controller.createAccount(req, { email: 'a@b.com', username: 'a@b.com', password: 'x' } as any);
      expect(service.createAccount).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('GET /api/mail/templates returns { success, data }', async () => {
      const service = { listTemplates: jest.fn().mockResolvedValue({ success: true, data: [] }) } as any;
      const controller = new MailController(service);
      const result = await controller.listTemplates(req);
      expect(service.listTemplates).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });
});
