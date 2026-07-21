import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Profile } from '@clickbit/shared';
import { stringValue, parseJson, numberValue } from './content-utils';
import { CacheService } from '../redis/cache.service';

const DEFAULTS: Record<string, any> = {
  'site_identity': { siteTitle: 'ClickBit - Web Solutions', metaDescription: 'ClickBit - Custom Web & Software Solutions', faviconUrl: '/favicon.ico' },
  'contact_info': {
    phone1: '+61 2 7229 9577', phone2: '+61 422 512 130', email: 'info@clickbit.com.au',
    address: '19 Drysdale Approach\nBaldivis WA 6171\nAustralia',
    businessHours: 'Monday - Friday: 9:00 AM - 6:00 PM\nWeekend: By appointment',
    googleMapsUrl: 'https://maps.google.com/maps?width=100%25&height=600&hl=en&q=19%20Drysdale%20Approach,%20Baldivis%20WA%206171,%20Australia+(ClickBit)&t=&z=14&ie=UTF8&iwloc=B&output=embed',
    socialLinks: [
      { platform: 'facebook', url: 'https://facebook.clickbit.com.au' },
      { platform: 'instagram', url: 'https://instagram.clickbit.com.au' },
      { platform: 'linkedin', url: 'https://linkedin.clickbit.com.au' },
      { platform: 'twitter', url: 'https://x.clickbit.com.au' },
      { platform: 'tiktok', url: 'https://tiktok.clickbit.com.au' },
      { platform: 'youtube', url: 'https://youtube.clickbit.com.au' },
      { platform: 'github', url: 'https://github.clickbit.com.au' }
    ]
  },
  'footer_content': { companyDescription: 'Empowering businesses with innovative digital solutions to connect, engage, and grow.' },
  'main_navigation': [
    { label: 'About', path: '/about', order: 1 },
    { label: 'Services', path: '/services', order: 2, hasDropdown: true },
    { label: 'Portfolio', path: '/portfolio', order: 3 },
    { label: 'Contact', path: '/contact', order: 4 }
  ],
  'faq_items': [
    { question: 'What services does ClickBit offer?', answer: 'ClickBit offers comprehensive digital solutions including Custom Web Applications, Website Development, Mobile App Development, Infrastructure Services, Specialized Tech, Business Systems, Design & Branding, and Marketing & Growth services.', category: 'General' },
    { question: 'How long does it take to build a website or application?', answer: 'Timelines vary by project complexity: Simple business websites (2-4 weeks), complex web applications (8-12 weeks), mobile apps (10-16 weeks), and enterprise solutions (12-20 weeks).', category: 'General' },
    { question: 'Do you provide ongoing support after project completion?', answer: 'Yes, we offer comprehensive support packages including website maintenance, security updates, performance monitoring, content updates, and technical support.', category: 'General' }
  ],
  'mission_points': [
    { icon: 'Users', title: 'Hosted on Our Own Infrastructure', description: 'Solutions tailored to your business stage, goals, and performance requirements.' },
    { icon: 'Handshake', title: 'Built as a True Partnership', description: 'Clear communication and shared decision-making throughout the project lifecycle.' },
    { icon: 'Gem', title: 'Quality You Control', description: 'Clean code, performance-first design, and solutions deployed on ClickBit-managed servers.' },
    { icon: 'Target', title: 'Focused on Real Results', description: 'Your results define our success, and every decision is aligned with measurable outcomes.' },
    { icon: 'BookCopy', title: 'Web, Servers & Growth Expertise', description: 'Web development, private server infrastructure, digital marketing, and design — all under one roof.' },
    { icon: 'ShieldAlert', title: 'Always-On Monitoring & Support', description: 'Continuous monitoring on our own servers to prevent issues before they impact your business.' },
    { icon: 'LifeBuoy', title: 'End-to-End Infrastructure Support', description: 'From server provisioning and setup to deployment, maintenance, and post-launch care.' },
    { icon: 'FileText', title: 'Clear & Honest Pricing', description: 'Straightforward pricing with no hidden costs — including transparent hosting and infrastructure.' }
  ],
  'marketing_integrations': { headerScripts: '', googleSearchConsoleTag: '', googleAnalyticsId: '', facebookPixelId: '', customMetaTags: '' },
  'process_phases': [
    { id: 1, mainIcon: 'ClipboardList', title: 'Planning', subtitle: '& Requirements', description: 'We define the project scope, goals, and foundational needs.', color: 'text-[#1FBBD2]', bgColor: 'hover:bg-cyan-50', darkBgColor: 'dark:hover:bg-cyan-900/20', deliverables: [{ text: 'Detailed Project Scope Document', icon: 'FileText' }] },
    { id: 2, mainIcon: 'Palette', title: 'Design', subtitle: '& Development', description: 'Transforming concepts into functional realities.', color: 'text-[#F39C12]', bgColor: 'hover:bg-amber-50', darkBgColor: 'dark:hover:bg-amber-900/20', deliverables: [{ text: 'System Architecture Design', icon: 'Network' }] }
  ]
};

const KEY_MAP: Record<string, string> = {
  site_identity: 'site-identity',
  contact_info: 'contact-info',
  footer_content: 'footer-content',
  main_navigation: 'navigation',
  faq_items: 'faq',
  mission_points: 'mission-points',
  marketing_integrations: 'marketing-integrations',
  process_phases: 'process-phases',
};

@Injectable()
export class PublicContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('public-content', ...parts) ?? `public-content:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  private getSettingKey(routeKey: string): string {
    const dbKey = Object.keys(KEY_MAP).find((k) => KEY_MAP[k] === routeKey);
    return dbKey || routeKey;
  }

  async getContent(key: string) {
    return this.cached(this.cacheKey('content', key), async () => {
    const dbKey = this.getSettingKey(key);
    const setting = await this.prisma.site_settings.findFirst({ where: { setting_key: dbKey } });
    const value = setting ? parseJson(setting.setting_value, DEFAULTS[dbKey]) : DEFAULTS[dbKey];
    return value || DEFAULTS[dbKey];
    });
  }

  async search(user: Profile | null, query: Record<string, unknown>) {
    return this.cached(this.cacheKey('search', user?.id ?? 'anon', JSON.stringify(query)), async () => {
    const term = stringValue(query.q || query.query).toLowerCase();
    const limit = Math.min(numberValue(query.limit, 20), 50);
    const isAdmin = user && (user.role === 'admin' || user.role === 'manager');

    if (!term) return {
      services: [], blogPosts: [], portfolioItems: [], teamMembers: [],
      contacts: [], orders: [], users: [], adminNav: [], all: [], total: 0, isAdmin: false,
    };

    const services = await this.prisma.services.findMany({
      where: { is_active: true, OR: [{ name: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }] },
      take: limit,
    });

    const blogWhere: any = { status: 'published', OR: [{ title: { contains: term, mode: 'insensitive' } }, { content: { contains: term, mode: 'insensitive' } }, { excerpt: { contains: term, mode: 'insensitive' } }] };
    const blogPosts = await this.prisma.blog_posts.findMany({ where: blogWhere, include: { profiles: { select: { id: true, first_name: true, last_name: true } } }, take: limit });

    const portfolioWhere: any = { status: 'published', OR: [{ title: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }, { client_name: { contains: term, mode: 'insensitive' } }] };
    const portfolioItems = await this.prisma.portfolio_items.findMany({ where: portfolioWhere, take: limit });

    const teamMembers = await this.prisma.teams.findMany({
      where: { is_active: true, OR: [{ name: { contains: term, mode: 'insensitive' } }, { role: { contains: term, mode: 'insensitive' } }, { bio: { contains: term, mode: 'insensitive' } }] },
      take: limit,
    });

    return {
      services: services.map((s: any) => ({ type: 'service', id: s.id, name: s.name, description: s.description, href: `/services/${s.slug}`, category: s.category })),
      blogPosts: blogPosts.map((p: any) => ({ type: 'blog', id: p.id, name: p.title, description: p.excerpt, href: `/blog/${p.slug}`, published_at: p.published_at })),
      portfolioItems: portfolioItems.map((p: any) => ({ type: 'portfolio', id: p.id, name: p.title, description: p.description, href: `/portfolio/${p.slug}`, client: p.client_name })),
      teamMembers: teamMembers.map((m: any) => ({ type: 'team', id: m.id, name: m.name, description: m.role + (m.bio ? ` - ${m.bio.substring(0, 100)}` : ''), href: '/about', role: m.role, email: m.email })),
      contacts: [], orders: [], users: [], adminNav: [], all: [],
      total: 0,
      isAdmin: isAdmin || false,
    };
    });
  }
}
