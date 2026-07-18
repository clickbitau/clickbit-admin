'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Mail as MailIcon, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
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
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
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

  const filteredAccounts = useMemo(() => {
    const rows = accounts?.data ?? [];
    if (!accountSearch.trim()) return rows;
    const q = accountSearch.trim().toLowerCase();
    return rows.filter((a) => (a.email || '').toLowerCase().includes(q) || (a.display_name || '').toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredTemplates = useMemo(() => {
    const rows = templates?.data ?? [];
    if (!templateSearch.trim()) return rows;
    const q = templateSearch.trim().toLowerCase();
    return rows.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q));
  }, [templates, templateSearch]);

  const filteredMessages = useMemo(() => {
    const rows = messages?.data ?? [];
    if (!messageSearch.trim()) return rows;
    const q = messageSearch.trim().toLowerCase();
    return rows.filter((m) => (m.subject || '').toLowerCase().includes(q) || (m.from_address || '').toLowerCase().includes(q) || (m.from_name || '').toLowerCase().includes(q));
  }, [messages, messageSearch]);

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
      actions={<Button asChild><Link href="/admin/communication/mail/compose"><Plus className="mr-1 h-4 w-4" /> Compose</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Email Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, username: e.target.value })} className="w-full sm:max-w-xs" />
              <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full sm:max-w-xs" />
              <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Preset</option>
                {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <Button onClick={() => form.email && form.password && addAccount.mutate()} disabled={addAccount.isPending}>Add</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search accounts..." className="pl-9" />
            </div>
            {loadingAccounts ? <Skeleton className="h-16 w-full" /> : (
              <div className="divide-y">
                {filteredAccounts.map((a: MailAccount) => (
                  <div key={a.id} className={`flex items-center justify-between gap-2 py-2 px-2 rounded-lg ${selectedAccount === a.id ? 'nm-inset-sm' : ''}`}>
                    <button onClick={() => { setSelectedAccount(a.id); setSelectedFolder('INBOX'); }} className="text-sm hover:underline truncate text-left">{a.email}</button>
                    <Button variant="destructive" size="sm" onClick={() => removeAccount.mutate(a.id)}>Delete</Button>
                  </div>
                ))}
                {!filteredAccounts.length && <div className="text-muted-foreground">No accounts.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full sm:max-w-xs" />
              <Input placeholder="Subject" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} className="w-full sm:max-w-xs" />
              <Button onClick={() => templateForm.name && addTemplate.mutate()} disabled={addTemplate.isPending}>Add</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
            </div>
            <div className="divide-y">
              {filteredTemplates.map((t: EmailTemplate) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="text-sm truncate">{t.name} &middot; {t.subject}</div>
                  <Button variant="destructive" size="sm" onClick={() => removeTemplate.mutate(t.id)}>Delete</Button>
                </div>
              ))}
              {!filteredTemplates.length && <div className="text-muted-foreground">No templates.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <CardTitle>Messages</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="Search messages..." className="pl-9" />
            </div>
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="w-full sm:w-auto rounded-md border bg-background px-3 py-2 text-sm">
              {folders?.data?.map((f: MailFolder) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {filteredMessages.map((m: CachedEmail) => (
              <div key={m.id} className="py-2">
                <button onClick={() => setExpandedMessage(expandedMessage === m.id ? null : m.id)} className="w-full text-left flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.subject || '(no subject)'}</div>
                    <div className="text-xs text-muted-foreground">{m.from_name || m.from_address} &middot; {m.date ? new Date(m.date).toLocaleString() : ''}</div>
                  </div>
                  {expandedMessage === m.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedMessage === m.id && (
                  <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap border-l-2 pl-3 py-1">
                    {m.text_body || m.html_body || 'No content.'}
                  </div>
                )}
              </div>
            ))}
            {!filteredMessages.length && <div className="text-muted-foreground">No messages.</div>}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
