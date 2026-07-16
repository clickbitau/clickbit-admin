import { PublicContentController } from '../src/content/public-content.controller';
import { ServicesController } from '../src/content/services.controller';
import { PortfolioController } from '../src/content/portfolio.controller';
import { TeamController } from '../src/content/team.controller';
import { ReviewsController, ReviewsAdminController } from '../src/content/reviews.controller';
import { BlogController } from '../src/content/blog.controller';
import { MarketingController } from '../src/content/marketing.controller';

describe('Content legacy contract tests', () => {
  const req = { user: { id: 1, role: 'admin' } };

  describe('PublicContentController', () => {
    it('GET /api/public/site-identity returns site identity object', async () => {
      const service = { getContent: jest.fn().mockResolvedValue({ siteTitle: 'ClickBit' }) } as any;
      const controller = new PublicContentController(service);
      const result = await controller.siteIdentity();
      expect(service.getContent).toHaveBeenCalledWith('site-identity');
      expect(result).toEqual(expect.objectContaining({ siteTitle: 'ClickBit' }));
    });

    it('GET /api/public/search returns search result object', async () => {
      const service = { search: jest.fn().mockResolvedValue({ services: [], total: 0, isAdmin: false }) } as any;
      const controller = new PublicContentController(service);
      const result = await controller.search(req, { q: 'web' });
      expect(service.search).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ total: 0 }));
    });
  });

  describe('ServicesController', () => {
    it('GET /api/services returns array of services', async () => {
      const service = { listPublic: jest.fn().mockResolvedValue([{ id: 1, name: 'Web' }]) } as any;
      const controller = new ServicesController(service);
      const result = await controller.list({}, 'light');
      expect(service.listPublic).toHaveBeenCalledWith(expect.anything(), 'light');
      expect(result).toEqual([{ id: 1, name: 'Web' }]);
    });

    it('GET /api/services/admin/all returns items with pagination', async () => {
      const service = { findAllAdmin: jest.fn().mockResolvedValue({ items: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }) } as any;
      const controller = new ServicesController(service);
      const result = await controller.adminAll({ limit: 50, offset: 0 });
      expect(service.findAllAdmin).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(expect.objectContaining({ items: [] }));
    });

    it('POST /api/services/admin returns message + item', async () => {
      const service = { create: jest.fn().mockResolvedValue({ message: 'created', item: { id: 1 } }) } as any;
      const controller = new ServicesController(service);
      const result = await controller.create({ name: 'Web' });
      expect(service.create).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(expect.objectContaining({ message: 'created' }));
    });
  });

  describe('PortfolioController', () => {
    it('GET /api/portfolio returns items with pagination', async () => {
      const service = { listPublic: jest.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }) } as any;
      const controller = new PortfolioController(service);
      const result = await controller.list({});
      expect(result).toEqual(expect.objectContaining({ items: [] }));
    });

    it('POST /api/portfolio/admin returns message + item', async () => {
      const service = { create: jest.fn().mockResolvedValue({ message: 'created', item: { id: 1 } }) } as any;
      const controller = new PortfolioController(service);
      const result = await controller.create({ title: 'Project' });
      expect(result).toEqual(expect.objectContaining({ message: 'created' }));
    });
  });

  describe('TeamController', () => {
    it('GET /api/team returns team members', async () => {
      const service = { listPublic: jest.fn().mockResolvedValue([{ id: 1, name: 'Alice' }]) } as any;
      const controller = new TeamController(service);
      const result = await controller.list();
      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('POST /api/team returns created member', async () => {
      const service = { create: jest.fn().mockResolvedValue({ id: 1, name: 'Alice' }) } as any;
      const controller = new TeamController(service);
      const result = await controller.create({ name: 'Alice', role: 'dev' });
      expect(service.create).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual(expect.objectContaining({ name: 'Alice' }));
    });
  });

  describe('Reviews', () => {
    it('GET /api/reviews returns approved reviews', async () => {
      const service = { listPublic: jest.fn().mockResolvedValue([{ id: 1, rating: 5 }]) } as any;
      const controller = new ReviewsController(service);
      const result = await controller.list({});
      expect(result).toEqual([{ id: 1, rating: 5 }]);
    });

    it('GET /api/admin/reviews returns reviews + pagination + stats', async () => {
      const service = { findAllAdmin: jest.fn().mockResolvedValue({ reviews: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20 }, stats: {} }) } as any;
      const controller = new ReviewsAdminController(service);
      const result = await controller.findAll({});
      expect(result).toEqual(expect.objectContaining({ reviews: [] }));
    });
  });

  describe('BlogController', () => {
    it('GET /api/blog returns posts with pagination', async () => {
      const service = { listPublic: jest.fn().mockResolvedValue({ posts: [], pagination: { total: 0 } }) } as any;
      const controller = new BlogController(service);
      const result = await controller.list({});
      expect(result).toEqual(expect.objectContaining({ posts: [] }));
    });

    it('GET /api/blog/:slug/comments returns comments envelope', async () => {
      const service = { getComments: jest.fn().mockResolvedValue({ comments: [], commentsDisabled: false, totalCount: 0 }) } as any;
      const controller = new BlogController(service);
      const result = await controller.comments('hello');
      expect(result).toEqual(expect.objectContaining({ comments: [] }));
    });

    it('POST /api/blog/admin returns message + post', async () => {
      const service = { create: jest.fn().mockResolvedValue({ message: 'created', post: { id: 1 } }) } as any;
      const controller = new BlogController(service);
      const result = await controller.create(req, { title: 'Post' });
      expect(service.create).toHaveBeenCalledWith(req.user, expect.anything());
      expect(result).toEqual(expect.objectContaining({ message: 'created' }));
    });
  });

  describe('MarketingController', () => {
    it('GET /api/marketing-posts/admin returns posts + total', async () => {
      const service = { findAllAdmin: jest.fn().mockResolvedValue({ posts: [], total: 0 }) } as any;
      const controller = new MarketingController(service);
      const result = await controller.adminAll({});
      expect(result).toEqual(expect.objectContaining({ posts: [] }));
    });
  });
});
