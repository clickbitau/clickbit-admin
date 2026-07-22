'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash, type LucideIcon } from 'lucide-react';

export interface ResourceField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[];
  readOnly?: boolean;
}

export interface ResourceAction {
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
}

export interface ResourceDetailPageProps {
  title: string;
  icon: LucideIcon;
  backHref: string;
  titleKey: string;
  getFn: (token: string, id: string) => Promise<Record<string, any>>;
  updateFn?: (token: string, id: string, data: Record<string, any>) => Promise<any>;
  deleteFn?: (token: string, id: string) => Promise<any>;
  fields: ResourceField[];
  actions?: ResourceAction[];
  extraReadOnly?: (item: Record<string, any>) => React.ReactNode;
}

export function ResourceDetailPage({
  title,
  icon,
  backHref,
  titleKey,
  getFn,
  updateFn,
  deleteFn,
  fields,
  actions = [],
  extraReadOnly,
}: ResourceDetailPageProps) {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    const match = window.location.pathname.match(/\/(\d+)(?:\/|$)/);
    if (match) setId(match[1]);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: [title.toLowerCase(), token, id],
    queryFn: async () => {
      if (!token || !id) throw new Error('Missing token or id');
      return getFn(token, id);
    },
    enabled: !!token && !!id,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => updateFn!(token!, id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [title.toLowerCase(), token, id] });
      toast.success(`${title} updated`);
      setIsEditing(false);
    },
    onError: () => toast.error(`Failed to update ${title.toLowerCase()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFn!(token!, id!),
    onSuccess: () => {
      toast.success(`${title} deleted`);
      router.push(backHref);
    },
    onError: () => toast.error(`Failed to delete ${title.toLowerCase()}`),
  });

  const handleSave = () => {
    if (updateFn) updateMutation.mutate(form);
  };

  const renderInput = (field: ResourceField) => {
    const value = form[field.key];
    const setValue = (val: any) => setForm({ ...form, [field.key]: val });
    switch (field.type) {
      case 'textarea':
        return <Textarea value={value || ''} onChange={(e) => setValue(e.target.value)} rows={4} />;
      case 'number':
        return <Input type="number" value={value ?? ''} onChange={(e) => setValue(Number(e.target.value))} />;
      case 'date':
        return <Input type="date" value={value ? new Date(value).toISOString().split('T')[0] : ''} onChange={(e) => setValue(e.target.value)} />;
      case 'select':
        return (
          <select value={value || ''} onChange={(e) => setValue(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'checkbox':
        return (
          <div className="flex items-center gap-2 py-2">
            <input type="checkbox" checked={!!value} onChange={(e) => setValue(e.target.checked)} id={field.key} />
            <Label htmlFor={field.key}>{field.label}</Label>
          </div>
        );
      default:
        return <Input value={value || ''} onChange={(e) => setValue(e.target.value)} />;
    }
  };

  const displayValue = (field: ResourceField) => {
    const value = form[field.key];
    if (field.type === 'checkbox') return value ? 'Yes' : 'No';
    if (field.type === 'date') return value ? new Date(value).toLocaleDateString() : '—';
    return value || '—';
  };

  const displayTitle = data?.[titleKey] || `${title} #${id}`;

  if (error) {
    return (
      <PageShell title={title} icon={icon} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href={backHref}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load {title.toLowerCase()}.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={displayTitle}
      icon={icon}
      description={data?.status ? `Status: ${data.status}` : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {updateFn && (
            !isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
            )
          )}
          {actions.map((action, idx) => (
            <Button key={idx} variant={action.variant || 'outline'} size="sm" onClick={action.onClick} disabled={action.disabled}>{action.label}</Button>
          ))}
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-2xl">{displayTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing && updateFn ? (
              <div className="grid gap-4 md:grid-cols-2">
                {fields.filter((f) => !f.readOnly).map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    {field.type !== 'checkbox' && <Label>{field.label}</Label>}
                    {renderInput(field)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                {fields.map((field) => (
                  <p key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <span className="text-muted-foreground">{field.label}:</span> {displayValue(field)}
                  </p>
                ))}
                {extraReadOnly?.(data)}
              </div>
            )}

            <Separator />

            {deleteFn && (
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete {title.toLowerCase()}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
