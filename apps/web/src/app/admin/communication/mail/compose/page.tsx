'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchMailAccounts, fetchMailTemplates, sendMail } from '@/lib/api';
import type { EmailTemplate, MailAccount } from '@/types/communication';
import { ArrowLeft, Mail, Send } from 'lucide-react';

export default function AdminMailComposePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [accountId, setAccountId] = useState('');
  const [form, setForm] = useState({ to_email: '', to_name: '', subject: '', body_text: '', body_html: '' });

  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['mail-accounts', token],
    queryFn: () => fetchMailAccounts(token!),
    enabled: !!token,
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['mail-templates', token],
    queryFn: () => fetchMailTemplates(token!),
    enabled: !!token,
  });

  const accounts = accountsData?.data ?? [];
  const templates = templatesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => sendMail(token!, accountId, { ...form }),
    onSuccess: () => {
      toast.success('Email queued');
      router.push('/admin/communication/mail');
    },
    onError: () => toast.error('Failed to send email'),
  });

  function applyTemplate(t: EmailTemplate) {
    setForm((prev) => ({ ...prev, subject: t.subject || prev.subject, body_text: t.body_text || prev.body_text, body_html: t.body_html || prev.body_html }));
  }

  return (
    <PageShell
      title="Compose Email"
      icon={Mail}
      description="Send an email from a connected account"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/communication/mail"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>New Message</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>From account</Label>
            {loadingAccounts ? <Skeleton className="h-10 w-full" /> : (
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Select account</option>
                {accounts.map((a: MailAccount) => <option key={a.id} value={a.id}>{a.email}</option>)}
              </select>
            )}
          </div>
          <div><Label>Template</Label>
            {loadingTemplates ? <Skeleton className="h-10 w-full" /> : (
              <select value="" onChange={(e) => { const t = templates.find((x: EmailTemplate) => String(x.id) === e.target.value); if (t) applyTemplate(t); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">No template</option>
                {templates.map((t: EmailTemplate) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>To email</Label><Input type="email" value={form.to_email} onChange={(e) => setForm({ ...form, to_email: e.target.value })} /></div>
            <div><Label>To name</Label><Input value={form.to_name} onChange={(e) => setForm({ ...form, to_name: e.target.value })} /></div>
          </div>
          <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><Label>Body text</Label><Textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} rows={6} /></div>
          <div><Label>Body HTML (optional)</Label><Textarea value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} rows={4} /></div>
          <div>
            <Button onClick={() => accountId && form.to_email && form.subject && mutation.mutate()} disabled={mutation.isPending}>
              <Send className="mr-2 h-4 w-4" /> Send Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
