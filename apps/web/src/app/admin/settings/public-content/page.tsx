'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Save } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchPublicContent, upsertAdminSetting } from '@/lib/api';

type PublicContentKey = 'site-identity' | 'contact-info' | 'footer-content' | 'navigation' | 'faq' | 'mission-points' | 'marketing-integrations' | 'process-phases';

const publicContentDbKey: Record<PublicContentKey, string> = {
  'site-identity': 'site_identity',
  'contact-info': 'contact_info',
  'footer-content': 'footer_content',
  navigation: 'main_navigation',
  faq: 'faq_items',
  'mission-points': 'mission_points',
  'marketing-integrations': 'marketing_integrations',
  'process-phases': 'process_phases',
};

const KEYS: { key: PublicContentKey; label: string }[] = [
  { key: 'site-identity', label: 'Site Identity' },
  { key: 'contact-info', label: 'Contact Information' },
  { key: 'footer-content', label: 'Footer Content' },
  { key: 'navigation', label: 'Main Navigation' },
  { key: 'faq', label: 'FAQ Items' },
  { key: 'mission-points', label: 'Mission Points' },
  { key: 'marketing-integrations', label: 'Marketing Integrations' },
  { key: 'process-phases', label: 'Process Phases' },
];

function stringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function AdminPublicContentPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<PublicContentKey>('site-identity');
  const [draft, setDraft] = useState<string>('{}');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-content', active],
    queryFn: async () => fetchPublicContent(active),
    enabled: !!token,
  });

  useEffect(() => {
    if (data !== undefined) {
      setDraft(stringify(data));
      setSaved(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const parsed = JSON.parse(draft);
      return upsertAdminSetting(token, publicContentDbKey[active], { setting_value: JSON.stringify(parsed), setting_type: 'public', is_public: true, auto_load: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-content', active] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => setSaved(false),
  });

  return (
    <PageShell title="Public Content" icon={Globe} description="Edit the public marketing site content.">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Content Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {KEYS.map((k) => (
              <Button
                key={k.key}
                variant={active === k.key ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActive(k.key)}
              >
                {k.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {KEYS.find((k) => k.key === active)?.label}
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-2 h-4 w-4" /> {save.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="text-destructive">Failed to load content.</div>}
            {isLoading && <div className="text-muted-foreground">Loading...</div>}
            {!isLoading && (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={24}
                className="font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground mt-2">Edit the JSON for this section and click Save. Invalid JSON will fail to save.</p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
