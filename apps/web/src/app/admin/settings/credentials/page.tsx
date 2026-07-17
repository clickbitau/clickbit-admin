'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchCredentials, bulkUpdateCredentials, seedCredentials, testSmtpCredentials } from '@/lib/api';
import {
  Shield, Settings, CreditCard, Mail, Map, Github, Bot, HardDrive,
  Cloud, Phone, Activity, Lock, Eye, EyeOff, Save, Download, RefreshCw,
  CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Shield, Settings, CreditCard, Mail, Map, Github, Bot, HardDrive,
  Cloud, Phone, Activity, Lock,
};

const CATEGORY_ORDER = [
  'security', 'general', 'stripe', 'smtp', 'google', 'github',
  'jules', 'storage', 'nextcloud', 'turn', 'monitoring',
];

interface Credential {
  id: number;
  key: string;
  value: string;
  is_secret: boolean;
  label: string;
  description: string;
  category: string;
  sort_order: number;
  has_value: boolean;
}

interface CategoryData {
  label: string;
  icon?: string;
  description: string;
  credentials: Credential[];
}

export default function AdminCredentialsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [dirtyCategories, setDirtyCategories] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['credentials', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchCredentials(token); },
    enabled: !!token,
  });

  const categories = useMemo(() => data?.categories ?? {}, [data]);

  useEffect(() => {
    const vals: Record<string, string> = {};
    const expanded: Record<string, boolean> = {};
    Object.entries(categories).forEach(([cat, catData]) => {
      expanded[cat] = true;
      catData.credentials.forEach((cred) => { vals[cred.key] = cred.value; });
    });
    setEditValues(vals);
    setExpandedCategories(expanded);
  }, [categories]);

  const updateMutation = useMutation({
    mutationFn: (payload: { category: string; updates: { key: string; value: string }[] }) => bulkUpdateCredentials(token!, payload.updates),
    onSuccess: (_data, variables) => {
      toast.success(`${categories[variables.category]?.label || variables.category} credentials saved`);
      queryClient.invalidateQueries({ queryKey: ['credentials', token] });
      setDirtyCategories((prev) => ({ ...prev, [variables.category]: false }));
    },
    onError: () => toast.error('Failed to save credentials'),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedCredentials(token!),
    onSuccess: (res) => { toast.success(`Seeded ${res.count} credential(s) from environment`); queryClient.invalidateQueries({ queryKey: ['credentials', token] }); },
    onError: () => toast.error('Failed to seed credentials'),
  });

  const smtpMutation = useMutation({
    mutationFn: () => testSmtpCredentials(token!),
    onSuccess: (res) => { toast[res.success ? 'success' : 'error'](res.message); },
    onError: () => toast.error('SMTP test failed'),
  });

  const handleInputChange = (key: string, value: string, category: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setDirtyCategories((prev) => ({ ...prev, [category]: true }));
  };

  const toggleSecret = (key: string) => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleCategory = (cat: string) => setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const handleSaveCategory = (category: string) => {
    const catData = categories[category];
    if (!catData) return;
    const updates = catData.credentials
      .map((cred) => ({ key: cred.key, value: editValues[cred.key] ?? cred.value }))
      .filter((u) => {
        if (!u.value || u.value.includes('••••••••')) return false;
        const orig = catData.credentials.find((c) => c.key === u.key);
        return orig ? u.value !== orig.value : !!u.value;
      });
    if (updates.length === 0) {
      toast('No changes to save');
      return;
    }
    updateMutation.mutate({ category, updates });
  };

  const getIcon = (iconName?: string) => ICON_MAP[iconName || ''] || Lock;
  const sortedCategories = CATEGORY_ORDER.filter((c) => categories[c]);

  return (
    <PageShell
      title="Credentials"
      icon={Shield}
      description="Manage API keys, secrets, and service credentials."
      actions={
        <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          {seedMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Seed from .env
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-6">
          {sortedCategories.map((cat) => {
            const catData = categories[cat];
            const IconComp = getIcon(catData.icon);
            const isExpanded = expandedCategories[cat] !== false;
            const isDirty = dirtyCategories[cat];

            return (
              <Card key={cat}>
                <CardHeader className="p-0">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 nm-inset-sm rounded-lg"><IconComp className="h-5 w-5 text-primary" /></div>
                      <div>
                        <CardTitle className="text-lg">{catData.label}</CardTitle>
                        <p className="text-sm text-muted-foreground">{catData.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDirty && <Badge variant="secondary">Unsaved</Badge>}
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </button>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    {catData.credentials.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No credentials configured. Click &quot;Seed from .env&quot; to import.</p>
                    ) : (
                      catData.credentials.map((cred) => (
                        <div key={cred.key} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                          <div className="md:pt-2">
                            <p className="text-sm font-medium">{cred.label}</p>
                            {cred.description && <p className="text-xs text-muted-foreground">{cred.description}</p>}
                          </div>
                          <div className="md:col-span-2 relative">
                            <Input
                              type={cred.is_secret && !showSecrets[cred.key] ? 'password' : 'text'}
                              value={editValues[cred.key] ?? ''}
                              onChange={(e) => handleInputChange(cred.key, e.target.value, cat)}
                              placeholder={cred.has_value ? '(set — enter new value to change)' : '(not set)'}
                              className="pr-10 font-mono text-sm"
                            />
                            {cred.is_secret && (
                              <button type="button" onClick={() => toggleSecret(cred.key)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showSecrets[cred.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            )}
                            {!cred.is_secret && cred.has_value && <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                            {cred.is_secret && cred.has_value && (
                              <span className="absolute right-8 top-1/2 -translate-y-1/2"><CheckCircle className="h-4 w-4 text-green-500" /></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    <div className="flex items-center gap-3 pt-3 border-t">
                      <Button size="sm" onClick={() => handleSaveCategory(cat)} disabled={updateMutation.isPending || !isDirty}>
                        {updateMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                        Save {catData.label}
                      </Button>
                      {cat === 'smtp' && (
                        <Button variant="outline" size="sm" onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>
                          {smtpMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                          Test Connection
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Credentials are stored in the database and loaded into the server at startup.</li>
                  <li>Your <code className="px-1 py-0.5 bg-muted rounded text-xs">.env</code> file only needs database and Supabase connection details.</li>
                  <li>Click <strong>Seed from .env</strong> to import existing environment values (one-time).</li>
                  <li>Secret values are masked in the UI. Enter a new value to change them.</li>
                  <li>After saving, restart the server for changes to take full effect.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
