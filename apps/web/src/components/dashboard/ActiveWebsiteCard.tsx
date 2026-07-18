'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, ExternalLink, CheckCircle } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className="nm-raised p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 nm-inset-sm rounded-lg">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Active Website</h2>
        </div>
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="nm-raised p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 nm-inset-sm rounded-lg">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Active Website</h2>
            <p className="text-sm text-muted-foreground">{displayUrl || siteUrl || 'No URL configured'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium text-sm whitespace-nowrap inline-flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Online
          </span>
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium nm-interactive rounded-lg transition-all"
            >
              Visit <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {tagline && (
        <div className="mt-4 nm-inset-sm rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
      )}
    </div>
  );
}
