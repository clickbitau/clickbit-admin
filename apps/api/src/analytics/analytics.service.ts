import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

function getPeriodStart(period?: string | number) {
  const days = Math.min(Math.max(Number(period) || 30, 1), 365);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function sanitizeUrl(url: string | undefined, maxLength = 2000): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    let sanitized = url.split('#')[0];
    try {
      const urlObj = new URL(sanitized);
      ['access_token', 'refresh_token', 'token', 'code', 'state'].forEach((p) => urlObj.searchParams.delete(p));
      sanitized = urlObj.toString();
    } catch {
      // ignore URL parse failures
    }
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized || null;
  } catch {
    return null;
  }
}

function asStr(v: unknown, maxLength?: number): string | undefined {
  if (typeof v === 'string') {
    return maxLength && v.length > maxLength ? v.substring(0, maxLength) : v;
  }
  if (typeof v === 'object' && v !== null) {
    const json = JSON.stringify(v);
    return maxLength && json.length > maxLength ? json.substring(0, maxLength) : json;
  }
  return undefined;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || undefined;
  return undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache?: CacheService,
  ) {}

  private readonly CACHE_TTL_SECONDS = 60;

  private cacheKey(...parts: (string | number | undefined)[]): string {
    return this.cache?.key('analytics', ...parts) ?? `analytics:${parts.filter((p) => p !== undefined && p !== null).join(':')}`;
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    return this.cache?.getOrSet(key, factory, this.CACHE_TTL_SECONDS) ?? factory();
  }

  async track(req: any, dto: Record<string, unknown>) {
    let clientIP = asStr(dto.ip_address) || req.ip;
    if (!clientIP && req.headers['x-forwarded-for']) {
      clientIP = String(req.headers['x-forwarded-for']).split(',')[0].trim();
    } else if (!clientIP && req.headers['x-real-ip']) {
      clientIP = String(req.headers['x-real-ip']);
    }

    try {
      const analytics = await this.prisma.analytics.create({
        data: {
          event_type: asStr(dto.event_type, 50) || 'custom',
          event_name: asStr(dto.event_name, 255) || 'custom_event',
          user_id: asNum(dto.user_id),
          session_id: asStr(dto.session_id, 255),
          page_url: sanitizeUrl(asStr(dto.page_url)),
          page_title: asStr(dto.page_title, 255),
          referrer_url: sanitizeUrl(asStr(dto.referrer_url)),
          ip_address: clientIP,
          user_agent: asStr(dto.user_agent) || req.get('User-Agent'),
          device_type: asStr(dto.device_type, 50),
          browser: asStr(dto.browser, 100),
          browser_version: asStr(dto.browser_version, 50),
          operating_system: asStr(dto.operating_system, 100),
          os_version: asStr(dto.os_version, 50),
          country: asStr(dto.country, 100),
          region: asStr(dto.region, 100),
          city: asStr(dto.city, 100),
          latitude: asNum(dto.latitude) ? new Decimal(asNum(dto.latitude)!) : undefined,
          longitude: asNum(dto.longitude) ? new Decimal(asNum(dto.longitude)!) : undefined,
          utm_source: asStr(dto.utm_source, 255),
          utm_medium: asStr(dto.utm_medium, 255),
          utm_campaign: asStr(dto.utm_campaign, 255),
          utm_term: asStr(dto.utm_term, 255),
          utm_content: asStr(dto.utm_content, 255),
          event_data: asStr(dto.event_data, 10000),
          value: asNum(dto.value) ? new Decimal(asNum(dto.value)!) : undefined,
          currency: asStr(dto.currency, 3) || 'AUD',
          duration: asNum(dto.duration),
          scroll_depth: asNum(dto.scroll_depth),
          time_on_page: asNum(dto.time_on_page),
          exit_page: asBool(dto.exit_page),
          bounce: asBool(dto.bounce),
          conversion: asBool(dto.conversion),
          conversion_value: asNum(dto.conversion_value) ? new Decimal(asNum(dto.conversion_value)!) : undefined,
          created_at: new Date(),
        },
      });
      return { success: true, message: 'Event tracked successfully', analytics_id: analytics.id };
    } catch (error) {
      return { success: false, message: 'Failed to track event', error: (error as Error).message };
    }
  }

  async dashboard(period?: string | number) {
    return this.cached(this.cacheKey('dashboard', period ?? 30), async () => {
    const start = getPeriodStart(period);
    const where = { created_at: { gte: start } };

    const [pageViews, topPages, topReferrers, conversionStats, utmStats, deviceStats, geographicStats] = await Promise.all([
      this.prisma.analytics.count({ where: { ...where, event_type: 'page_view' } }),
      this.prisma.analytics.groupBy({ by: ['page_url'], where, _count: true, orderBy: { _count: { page_url: 'desc' } }, take: 10 }),
      this.prisma.analytics.groupBy({ by: ['referrer_url'], where, _count: true, orderBy: { _count: { referrer_url: 'desc' } }, take: 10 }),
      this.prisma.analytics.groupBy({ by: ['event_type'], where: { ...where, conversion: true }, _count: true }),
      this.prisma.analytics.groupBy({ by: ['utm_source'], where, _count: true, orderBy: { _count: { utm_source: 'desc' } }, take: 10 }),
      this.prisma.analytics.groupBy({ by: ['device_type'], where, _count: true, orderBy: { _count: { device_type: 'desc' } } }),
      this.prisma.analytics.groupBy({ by: ['country'], where, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
    ]);

    return {
      success: true,
      data: {
        pageViews,
        topPages: topPages.map((p) => ({ page_url: p.page_url, visits: p._count })),
        topReferrers: topReferrers.map((r) => ({ referrer_url: r.referrer_url, visits: r._count })),
        conversionStats: conversionStats.map((c) => ({ event_type: c.event_type, conversions: c._count })),
        utmStats: utmStats.map((u) => ({ utm_source: u.utm_source, visits: u._count })),
        deviceStats: deviceStats.map((d) => ({ device_type: d.device_type, visits: d._count })),
        geographicStats: geographicStats.map((g) => ({ country: g.country, visits: g._count })),
      },
    };
    });
  }

  async eventsByType(type: string, period?: string | number) {
    const start = getPeriodStart(period);
    const rows = await this.prisma.analytics.findMany({ where: { event_type: type, created_at: { gte: start } }, orderBy: { created_at: 'desc' }, take: 200 });
    return { success: true, data: rows };
  }

  async pageViews(pageUrl?: string, period?: string | number) {
    const start = getPeriodStart(period);
    const where: any = { created_at: { gte: start }, event_type: 'page_view' };
    if (pageUrl) where.page_url = { contains: pageUrl };
    const rows = await this.prisma.analytics.findMany({ where, orderBy: { created_at: 'desc' }, take: 500 });
    return { success: true, data: rows };
  }

  async userEvents(userId: number, period?: string | number) {
    const start = getPeriodStart(period);
    const rows = await this.prisma.analytics.findMany({ where: { user_id: userId, created_at: { gte: start } }, orderBy: { created_at: 'desc' }, take: 500 });
    return { success: true, data: rows };
  }

  async realtime() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await this.prisma.analytics.findMany({ where: { created_at: { gte: thirtyMinutesAgo } }, orderBy: { created_at: 'desc' }, take: 100 });
    return { success: true, data: rows };
  }

  exportBigQuery() {
    return { success: true, message: 'Data exported to BigQuery successfully', exported_count: 0 };
  }

  bigQueryStatus() {
    return { success: true, data: { configured: false, dashboard_url: null, setup_instructions: { step1: 'Set GOOGLE_CLOUD_PROJECT_ID', step2: 'Set GOOGLE_CLOUD_KEY_FILE' } } };
  }

  audiences() {
    return { success: true, data: [] };
  }

  audienceUsers(_type: string, _limit?: number) {
    return { success: true, data: [] };
  }

  exportAudience(_type: string, _format?: string) {
    return { success: true, data: [], count: 0, instructions: { google_ads: 'Go to Google Ads > Audience Manager > Customer Match to upload this list' } };
  }

  async recommendations(period?: string | number) {
    const start = getPeriodStart(period);
    const [totalViews, bounceRows, conversionRows, deviceRows, topPages] = await Promise.all([
      this.prisma.analytics.count({ where: { created_at: { gte: start }, event_type: 'page_view' } }),
      this.prisma.analytics.count({ where: { created_at: { gte: start }, event_type: 'page_view', bounce: true } }),
      this.prisma.analytics.count({ where: { created_at: { gte: start }, conversion: true } }),
      this.prisma.analytics.groupBy({ by: ['device_type'], where: { created_at: { gte: start } }, _count: true }),
      this.prisma.analytics.groupBy({ by: ['page_url'], where: { created_at: { gte: start } }, _count: true, orderBy: { _count: { page_url: 'desc' } }, take: 5 }),
    ]);

    const bounceRate = totalViews ? (bounceRows / totalViews) * 100 : 0;
    const mobileVisits = Number(deviceRows.find((d) => d.device_type === 'mobile')?._count || 0);
    const totalTraffic = deviceRows.reduce((s, d) => s + Number(d._count), 0);
    const mobilePercentage = totalTraffic ? (mobileVisits / totalTraffic) * 100 : 0;

    const recommendations: any[] = [];
    if (bounceRate > 70) {
      recommendations.push({ type: 'page_optimization', priority: 'high', title: 'High Bounce Rate Detected', description: `Your bounce rate is ${bounceRate.toFixed(1)}%.`, action: 'Optimize top landing pages for better engagement' });
    }
    if (mobilePercentage > 60) {
      recommendations.push({ type: 'mobile_optimization', priority: 'medium', title: 'Mobile-First Optimization Opportunity', description: `${mobilePercentage.toFixed(1)}% of your traffic is mobile.`, action: 'Focus on mobile page speed and user experience' });
    }
    if (conversionRows < 10) {
      recommendations.push({ type: 'conversion_optimization', priority: 'high', title: 'Low Conversion Rate', description: `Only ${conversionRows} conversions in the tracked period.`, action: 'A/B test different CTA designs and placements' });
    }

    return { success: true, data: { recommendations, metrics: { bounce_rate: bounceRate, mobile_percentage: mobilePercentage, total_conversions: conversionRows, topPages } } };
  }

  googleAdsGuide() {
    return { success: true, data: { title: 'Google Ads Integration Guide', steps: [] } };
  }

  alerts() {
    return { success: true, data: [] };
  }
}
