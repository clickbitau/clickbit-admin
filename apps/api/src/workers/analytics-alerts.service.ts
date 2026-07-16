import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsAlert {
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
}

@Injectable()
export class AnalyticsAlertsService {
  private readonly logger = new Logger(AnalyticsAlertsService.name);
  private readonly alertRules = {
    traffic_spike: { name: 'Traffic Spike Alert', threshold: 200, enabled: true },
    traffic_drop: { name: 'Traffic Drop Alert', threshold: 50, enabled: true },
    conversion_drop: { name: 'Conversion Drop Alert', threshold: 30, enabled: true },
    high_bounce_rate: { name: 'High Bounce Rate Alert', threshold: 80, enabled: true },
  };

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get<string>('RUN_SCHEDULERS') === 'true';
  }

  @Cron('0 * * * *')
  async runAllAlerts(): Promise<AnalyticsAlert[]> {
    if (!this.enabled) return [];
    const [traffic, conversion, bounce] = await Promise.all([
      this.checkTrafficAlerts(),
      this.checkConversionAlerts(),
      this.checkBounceRateAlerts(),
    ]);
    const all = [...traffic, ...conversion, ...bounce];
    for (const alert of all) {
      this.logger.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.title} - ${alert.message}`);
    }
    return all;
  }

  async checkTrafficAlerts(): Promise<AnalyticsAlert[]> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const lastWeekSameDay = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [todayTraffic, lastWeekTraffic] = await Promise.all([
        this.prisma.analytics.count({ where: { event_type: 'page_view', created_at: { gte: yesterday } } }),
        this.prisma.analytics.count({ where: { event_type: 'page_view', created_at: { gte: new Date(lastWeekSameDay.getTime() - 24 * 60 * 60 * 1000), lte: lastWeekSameDay } } }),
      ]);
      if (lastWeekTraffic === 0) return [];
      const changePercent = ((todayTraffic - lastWeekTraffic) / lastWeekTraffic) * 100;
      const alerts: AnalyticsAlert[] = [];
      if (changePercent > this.alertRules.traffic_spike.threshold) {
        alerts.push({ type: 'traffic_spike', title: 'Traffic Spike Detected', message: `Traffic increased by ${changePercent.toFixed(1)}% compared to last week`, severity: 'info', data: { today_traffic: todayTraffic, last_week_traffic: lastWeekTraffic, change_percent: changePercent } });
      }
      if (changePercent < -this.alertRules.traffic_drop.threshold) {
        alerts.push({ type: 'traffic_drop', title: 'Traffic Drop Detected', message: `Traffic decreased by ${Math.abs(changePercent).toFixed(1)}% compared to last week`, severity: 'warning', data: { today_traffic: todayTraffic, last_week_traffic: lastWeekTraffic, change_percent: changePercent } });
      }
      return alerts;
    } catch (e: any) {
      this.logger.error('Traffic alerts failed', e?.message);
      return [];
    }
  }

  async checkConversionAlerts(): Promise<AnalyticsAlert[]> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [recent, last] = await Promise.all([
        this.prisma.analytics.count({ where: { conversion: true, created_at: { gte: yesterday } } }),
        this.prisma.analytics.count({ where: { conversion: true, created_at: { gte: new Date(lastWeek.getTime() - 24 * 60 * 60 * 1000), lte: lastWeek } } }),
      ]);
      if (last === 0) return [];
      const changePercent = ((recent - last) / last) * 100;
      if (changePercent < -this.alertRules.conversion_drop.threshold) {
        return [{ type: 'conversion_drop', title: 'Conversion Rate Drop', message: `Conversions dropped by ${Math.abs(changePercent).toFixed(1)}% compared to last week`, severity: 'critical', data: { today_conversions: recent, last_week_conversions: last, change_percent: changePercent } }];
      }
      return [];
    } catch (e: any) {
      this.logger.error('Conversion alerts failed', e?.message);
      return [];
    }
  }

  async checkBounceRateAlerts(): Promise<AnalyticsAlert[]> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [total, bounces] = await Promise.all([
        this.prisma.analytics.count({ where: { created_at: { gte: yesterday } } }),
        this.prisma.analytics.count({ where: { bounce: true, created_at: { gte: yesterday } } }),
      ]);
      const bounceRate = total > 0 ? (bounces / total) * 100 : 0;
      if (bounceRate > this.alertRules.high_bounce_rate.threshold) {
        return [{ type: 'high_bounce_rate', title: 'High Bounce Rate Alert', message: `Bounce rate is ${bounceRate.toFixed(1)}%, which is above the threshold of ${this.alertRules.high_bounce_rate.threshold}%`, severity: 'warning', data: { bounce_rate: bounceRate, threshold: this.alertRules.high_bounce_rate.threshold } }];
      }
      return [];
    } catch (e: any) {
      this.logger.error('Bounce rate alerts failed', e?.message);
      return [];
    }
  }
}
