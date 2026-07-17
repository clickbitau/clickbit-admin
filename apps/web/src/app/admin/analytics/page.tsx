'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, Globe, MousePointer, Smartphone, Users } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchAnalyticsDashboard } from '@/lib/api';

function TopList({ title, items, keyName, valueName }: { title: string; items: any[]; keyName: string; valueName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items?.length === 0 && <li className="text-muted-foreground">No data.</li>}
          {items?.slice(0, 10).map((item, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="truncate max-w-[70%]" title={item[keyName] || '(none)'}>{item[keyName] || '(none)'}</span>
              <span className="font-mono">{item[valueName] || 0}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', token, period],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchAnalyticsDashboard(token, period);
    },
    enabled: !!token,
  });

  const stats = data?.data;

  const statCards = useMemo(() => {
    return [
      { label: 'Page Views', value: stats?.pageViews ?? 0, icon: Eye },
      { label: 'Top Page Visits', value: stats?.topPages?.[0]?.visits ?? 0, icon: BarChart3 },
      { label: 'Top Referrer Visits', value: stats?.topReferrers?.[0]?.visits ?? 0, icon: MousePointer },
      { label: 'Unique UTM Sources', value: stats?.utmStats?.length ?? 0, icon: Globe },
    ];
  }, [stats]);

  return (
    <PageShell title="Analytics" icon={BarChart3} description="Website traffic, conversions, and visitor breakdown.">
      <StatCards cards={statCards} />

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90, 365].map((d) => (
          <Button key={d} variant={period === d ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(d)}>
            Last {d} days
          </Button>
        ))}
      </div>

      {error && <div className="text-destructive">Failed to load analytics.</div>}
      {isLoading && <div className="text-muted-foreground">Loading...</div>}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <TopList title="Top Pages" items={stats.topPages} keyName="page_url" valueName="visits" />
          <TopList title="Top Referrers" items={stats.topReferrers} keyName="referrer_url" valueName="visits" />
          <TopList title="UTM Sources" items={stats.utmStats} keyName="utm_source" valueName="visits" />
          <TopList title="Devices" items={stats.deviceStats} keyName="device_type" valueName="visits" />
          <TopList title="Countries" items={stats.geographicStats} keyName="country" valueName="visits" />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {stats.conversionStats?.length === 0 && <li className="text-muted-foreground">No conversions.</li>}
                {stats.conversionStats?.map((c: any, i: number) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{c.event_type || '(none)'}</span>
                    <span className="font-mono">{c.conversions || 0}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
