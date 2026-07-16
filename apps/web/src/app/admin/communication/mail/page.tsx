'use client';
import { Mail as MailIcon } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMailAccounts, createMailAccount, deleteMailAccount, fetchMailFolders, fetchMailMessages, fetchMailTemplates, createMailTemplate, deleteMailTemplate } from '@/lib/api';
import type { CachedEmail, EmailTemplate, MailAccount, MailFolder } from '@/types/communication';

const PRESETS = [
  { label: 'Hostinger', value: 'hostinger' },
  { label: 'Gmail', value: 'gmail' },
  { label: 'Outlook', value: 'outlook' },
  { label: 'Yahoo', value: 'yahoo' },
];

export default function AdminCommunicationMailPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');
  const [form, setForm] = useState({ email: '', username: '', password: '', display_name: '', preset: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body_text: '' });

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['mail-accounts', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchMailAccounts(token); },
    enabled: !!token,
  });

  const { data: folders } = useQuery({
    queryKey: ['mail-folders', token, selectedAccount],
    queryFn: async () => { if (!token || !selectedAccount) throw new Error('No token'); return fetchMailFolders(token, selectedAccount); },
    enabled: !!token && !!selectedAccount,
  });

  const { data: messages } = useQuery({
    queryKey: ['mail-messages', token, selectedAccount, selectedFolder],
    queryFn: async () => { if (!token || !selectedAccount || !selectedFolder) throw new Error('No token'); return fetchMailMessages(token, selectedAccount, selectedFolder); },
    enabled: !!token && !!selectedAccount && !!selectedFolder,
  });

  const { data: templates } = useQuery({
    queryKey: ['mail-templates', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchMailTemplates(token); },
    enabled: !!token,
  });

  const addAccount = useMutation({
    mutationFn: () => createMailAccount(token!, { ...form, preset: form.preset || undefined } as unknown as Partial<MailAccount>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mail-accounts', token] }); setForm({ email: '', username: '', password: '', display_name: '', preset: '' }); },
  });

  const removeAccount = useMutation({
    mutationFn: (id: string) => deleteMailAccount(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-accounts', token] }),
  });

  const addTemplate = useMutation({
    mutationFn: () => createMailTemplate(token!, templateForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mail-templates', token] }); setTemplateForm({ name: '', subject: '', body_text: '' }); },
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteMailTemplate(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-templates', token] }),
  });

  return (
    <PageShell
      title="Mail"
      icon={MailIcon}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Email Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, username: e.target.value })} className="max-w-xs" />
              <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="max-w-xs" />
              <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Preset</option>
                {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <Button onClick={() => form.email && form.password && addAccount.mutate()} disabled={addAccount.isPending}>Add</Button>
            </div>
            {loadingAccounts ? <Skeleton className="h-16 w-full" /> : (
              <div className="divide-y">
                {accounts?.data?.map((a: MailAccount) => (
                  <div key={a.id} className="flex items-center justify-between py-2">
                    <button onClick={() => { setSelectedAccount(a.id); setSelectedFolder('INBOX'); }} className={`text-sm hover:underline ${selectedAccount === a.id ? 'font-semibold' : ''}`}>{a.email}</button>
                    <Button variant="destructive" size="sm" onClick={() => removeAccount.mutate(a.id)}>Delete</Button>
                  </div>
                ))}
                {!accounts?.data?.length && <div className="text-muted-foreground">No accounts.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="max-w-xs" />
              <Input placeholder="Subject" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} className="max-w-xs" />
              <Button onClick={() => templateForm.name && addTemplate.mutate()} disabled={addTemplate.isPending}>Add</Button>
            </div>
            <div className="divide-y">
              {templates?.data?.map((t: EmailTemplate) => (
                <div key={t.id} className="flex items-center justify-between py-2">
                  <div className="text-sm">{t.name} &middot; {t.subject}</div>
                  <Button variant="destructive" size="sm" onClick={() => removeTemplate.mutate(t.id)}>Delete</Button>
                </div>
              ))}
              {!templates?.data?.length && <div className="text-muted-foreground">No templates.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <div className="flex gap-2">
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
              {folders?.data?.map((f: MailFolder) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {messages?.data?.map((m: CachedEmail) => (
              <div key={m.id} className="py-2">
                <div className="text-sm font-medium">{m.subject || '(no subject)'}</div>
                <div className="text-xs text-muted-foreground">{m.from_name || m.from_address} &middot; {m.date ? new Date(m.date).toLocaleString() : ''}</div>
              </div>
            ))}
            {!messages?.data?.length && <div className="text-muted-foreground">No messages.</div>}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}