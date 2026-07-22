'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { fetchMailAccounts, fetchMailMessage, fetchMailTemplates, sendMail } from '@/lib/api';
import type { CachedEmail, EmailTemplate, MailAccount } from '@/types/communication';
import { ArrowLeft, Mail, Send } from 'lucide-react';

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function quoteText(text: string) {
  return text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

export default function AdminMailComposePage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const replyUid = searchParams?.get('reply');
  const forwardUid = searchParams?.get('forward');
  const accountQuery = searchParams?.get('account') || '';
  const folderQuery = searchParams?.get('folder') || 'INBOX';
  const originalUid = replyUid || forwardUid;
  const isReply = !!replyUid;

  const [accountId, setAccountId] = useState(accountQuery);
  const [form, setForm] = useState({
    to_email: '',
    to_name: '',
    subject: '',
    body_text: '',
    body_html: '',
    in_reply_to: null as string | null,
    references: null as string | null,
  });

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

  const { data: originalData, isLoading: loadingOriginal } = useQuery({
    queryKey: ['mail-message', token, accountQuery, folderQuery, originalUid],
    queryFn: () => fetchMailMessage(token!, accountQuery, folderQuery, Number(originalUid)),
    enabled: !!token && !!accountQuery && !!folderQuery && !!originalUid,
  });

  const accounts = useMemo(() => accountsData?.data ?? [], [accountsData?.data]);
  const templates = useMemo(() => templatesData?.data ?? [], [templatesData?.data]);
  const original = originalData?.data as CachedEmail | undefined;

  useEffect(() => {
    if (accountQuery && accounts.some((a: MailAccount) => a.id === accountQuery)) {
      setAccountId(accountQuery);
    }
  }, [accountQuery, accounts]);

  useEffect(() => {
    if (!original) return;
    const from = `${original.from_name || original.from_address || ''} <${original.from_address || ''}>`.trim() || 'Unknown';
    const date = original.date ? new Date(original.date).toLocaleString('en-AU') : '';
    const origSubject = original.subject || '(no subject)';

    if (isReply) {
      const subject = origSubject.toLowerCase().startsWith('re:') ? origSubject : `Re: ${origSubject}`;
      const textBody = original.text_body || original.preview || '';
      const htmlBody = original.html_body || escapeHtml(textBody);
      setForm({
        to_email: original.from_address || '',
        to_name: original.from_name || '',
        subject,
        body_text: `\n\nOn ${date}, ${from} wrote:\n\n${quoteText(textBody)}`,
        body_html: `<br><br>On ${date}, ${from} wrote:<br><blockquote style="border-left:2px solid #888;margin:0;padding-left:1em;">${htmlBody}</blockquote>`,
        in_reply_to: original.message_id || null,
        references: original.references_header ? `${original.references_header} ${original.message_id || ''}`.trim() : original.message_id || null,
      });
    } else {
      const subject = `Fwd: ${origSubject}`;
      const textBody = original.text_body || original.preview || '';
      const htmlBody = original.html_body || escapeHtml(textBody);
      setForm({
        to_email: '',
        to_name: '',
        subject,
        body_text: `---------- Forwarded message ----------\nFrom: ${from}\nDate: ${date}\nSubject: ${origSubject}\n\n${textBody}`,
        body_html: `<br><br>---------- Forwarded message ----------<br>From: ${escapeHtml(from)}<br>Date: ${date}<br>Subject: ${escapeHtml(origSubject)}<br><br>${htmlBody}`,
        in_reply_to: null,
        references: null,
      });
    }
  }, [original, isReply]);

  const mutation = useMutation({
    mutationFn: () => sendMail(token!, accountId, { ...form }),
    onSuccess: () => {
      toast.success(isReply ? 'Reply sent' : originalUid ? 'Forwarded' : 'Email queued');
      router.push('/admin/communication/mail');
    },
    onError: () => toast.error('Failed to send email'),
  });

  function applyTemplate(t: EmailTemplate) {
    setForm((prev) => ({ ...prev, subject: t.subject || prev.subject, body_text: t.body_text || prev.body_text, body_html: t.body_html || prev.body_html }));
  }

  const title = isReply ? 'Reply' : originalUid ? 'Forward Email' : 'Compose Email';

  return (
    <PageShell
      title={title}
      icon={Mail}
      description="Send an email from a connected account"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/communication/mail"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>From account</Label>
            {loadingAccounts || loadingOriginal ? <Skeleton className="h-10 w-full" /> : (
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
              <Send className="mr-2 h-4 w-4" /> {isReply ? 'Send Reply' : originalUid ? 'Forward' : 'Send Email'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
