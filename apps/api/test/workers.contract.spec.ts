import { BlogSchedulerService } from '../src/workers/blog-scheduler.service';
import { ReminderSchedulerService } from '../src/workers/reminder-scheduler.service';
import { AnnouncementSchedulerService } from '../src/workers/announcement-scheduler.service';
import { WorkersController } from '../src/workers/workers.controller';

describe('Workers legacy contract tests', () => {
  const mockConfig = { get: jest.fn().mockReturnValue('true') };

  describe('BlogSchedulerService', () => {
    it('publishes scheduled posts and returns count', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 2 });
      const prisma = { blog_posts: { updateMany } } as any;
      const service = new BlogSchedulerService(prisma, mockConfig as any);
      const result = await service.publishScheduledPosts();
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'scheduled' }) }));
      expect(result).toBe(2);
    });
  });

  describe('ReminderSchedulerService', () => {
    it('processes due reminders and creates notifications', async () => {
      const reminder = { id: 1, title: 'Test', description: 'desc', trigger_type: 'regular', assigned_to: 5 };
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const profilesFindMany = jest.fn().mockResolvedValue([{ id: 5, email: 'a@b.com' }]);
      const create = jest.fn().mockResolvedValue({ id: 10 });
      const update = jest.fn().mockResolvedValue({});
      const prisma = { hr_reminders: { findMany, update }, notifications: { create }, profiles: { findMany: profilesFindMany } } as any;
      const service = new ReminderSchedulerService(prisma, mockConfig as any);
      const result = await service.checkReminders();
      expect(result).toBe(1);
      expect(create).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });
  });

  describe('AnnouncementSchedulerService', () => {
    it('publishes scheduled announcements and returns count', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { hr_announcements: { updateMany } } as any;
      const service = new AnnouncementSchedulerService(prisma, mockConfig as any);
      const result = await service.publishScheduledAnnouncements();
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'draft' }) }));
      expect(result).toBe(1);
    });
  });

  describe('WorkersController', () => {
    it('GET /api/workers/status returns enabled and cron job list', () => {
      const workersService = { getStatus: jest.fn().mockReturnValue({ enabled: true, cronJobs: ['blog'] }) } as any;
      const controller = new WorkersController(workersService);
      const result = controller.status();
      expect(result).toEqual(expect.objectContaining({ enabled: true }));
    });
  });
});
