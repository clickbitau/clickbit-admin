'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchPublicSiteSettings } from '@/lib/api';

export function ActiveWebsiteCard() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['public-site-settings'],
    queryFn: () => fetchPublicSiteSettings(),
  });

  const settings = data ?? {};
  const siteName = String(settings.site_name || settings.company_name || 'ClickBIT');
  const tagline = String(settings.site_tagline || settings.tagline || '');
  const siteUrl = String(settings.site_url || origin || '');
  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const content = (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" /> Active Website
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold truncate">{siteName}</h3>
                <Badge variant="default" className="h-5 gap-1 px-1.5 text-xs">
                  <CheckCircle className="h-3 w-3" /> Online
                </Badge>
              </div>
              {tagline && <p className="text-sm text-muted-foreground truncate">{tagline}</p>}
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline truncate"
                >
                  {displayUrl || siteUrl} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {siteUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={siteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" /> Visit</a>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return content;
}
