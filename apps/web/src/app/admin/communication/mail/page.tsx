'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  AlertCircle,
  Folder,
  Star,
  RefreshCw,
  Reply,
  Forward,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchMailAccounts,
  createMailAccount,
  deleteMailAccount,
  fetchMailFolders,
  fetchMailMessages,
  fetchMailMessage,
  fetchMailTemplates,
  createMailTemplate,
  deleteMailTemplate,
} from '@/lib/api';
import type { CachedEmail, EmailTemplate, MailAccount, MailFolder } from '@/types/communication';
import { toast } from 'sonner';

const PRESETS = [
  { label: 'Hostinger', value: 'hostinger' },
  { label: 'Gmail', value: 'gmail' },
  { label: 'Outlook', value: 'outlook' },
  { label: 'Yahoo', value: 'yahoo' },
];

const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '\\Inbox': Inbox,
  '\\Sent': Send,
  '\\Drafts': FileText,
  '\\Trash': Trash2,
  '\\Archive': Archive,
  '\\Junk': AlertCircle,
  '\\Flagged': Star,
};

function getFolderIcon(folder: MailFolder) {
  const Icon = FOLDER_ICONS[folder.name] || FOLDER_ICONS[folder.path] || Folder;
  return Icon || Folder;
}

function formatMailDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return date.toLocaleDateString('en-AU', { weekday: 'short' });
  return date.toLocaleDateString('en-AU');
}

const LIMIT = 25;

export default function AdminCommunicationMailPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const accountQuery = searchParams.get('account') || '';
  const folderQuery = searchParams.get('folder') || 'INBOX';
  const uidQuery = searchParams.get('uid') || '';

  const [selectedAccount, setSelectedAccount] = useState<string>(accountQuery);
  const [selectedFolder, setSelectedFolder] = useState<string>(folderQuery);
  const [selectedUid, setSelectedUid] = useState<string>(uidQuery);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ email: '', username: '', password: '', display_name: '', preset: '' });
  const [accountSearch, setAccountSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body_text: '' });
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'subject-asc' | 'subject-desc' | 'from-asc' | 'from-desc'>('date-desc');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setSelectedAccount(accountQuery);
    setSelectedFolder(folderQuery || 'INBOX');
    setSelectedUid(uidQuery);
    setPage(0);
  }, [accountQuery, folderQuery, uidQuery]);

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['mail-accounts', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchMailAccounts(token); },
    enabled: !!token,
  });

  const { data: folders, isLoading: loadingFolders } = useQuery({
    queryKey: ['mail-folders', token, selectedAccount],
    queryFn: () => { if (!token || !selectedAccount) throw new Error('No token'); return fetchMailFolders(token, selectedAccount); },
    enabled: !!token && !!selectedAccount,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['mail-messages', token, selectedAccount, selectedFolder, page, sort, onlyUnread, messageSearch],
    queryFn: () => {
      if (!token || !selectedAccount || !selectedFolder) throw new Error('No token');
      const [sortBy, sortOrder] = sort.split('-') as [string, 'asc' | 'desc'];
      const params: Record<string, string | number | boolean> = { limit: LIMIT, offset: page * LIMIT, sortBy, sortOrder };
      if (messageSearch.trim()) params.search = messageSearch.trim();
      if (onlyUnread) params.unread = 'true';
      return fetchMailMessages(token, selectedAccount, selectedFolder, params);
    },
    enabled: !!token && !!selectedAccount && !!selectedFolder,
  });

  const { data: messageDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['mail-message', token, selectedAccount, selectedFolder, selectedUid],
    queryFn: () => { if (!token || !selectedAccount || !selectedFolder || !selectedUid) throw new Error('No message'); return fetchMailMessage(token, selectedAccount, selectedFolder, Number(selectedUid)); },
    enabled: !!token && !!selectedAccount && !!selectedFolder && !!selectedUid,
  });

  const { data: templates } = useQuery({
    queryKey: ['mail-templates', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchMailTemplates(token); },
    enabled: !!token,
  });

  const accountList = useMemo(() => (accounts?.data || []) as MailAccount[], [accounts]);
  const filteredAccounts = useMemo(() => {
    const rows = accountList;
    if (!accountSearch.trim()) return rows;
    const q = accountSearch.trim().toLowerCase();
    return rows.filter((a) => (a.email || '').toLowerCase().includes(q) || (a.display_name || '').toLowerCase().includes(q));
  }, [accountList, accountSearch]);

  const folderList = useMemo(() => (folders?.data || []) as MailFolder[], [folders]);
  const messageList = useMemo(() => (messages?.data || []) as CachedEmail[], [messages]);
  const totalMessages = messages?.pagination?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMessages / LIMIT));

  const filteredTemplates = useMemo(() => {
    const rows = (templates?.data || []) as EmailTemplate[];
    if (!templateSearch.trim()) return rows;
    const q = templateSearch.trim().toLowerCase();
    return rows.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q));
  }, [templates, templateSearch]);

  const addAccount = useMutation({
    mutationFn: () => createMailAccount(token!, { ...accountForm, preset: accountForm.preset || undefined } as unknown as Partial<MailAccount>),
    onSuccess: () => { toast.success('Account added'); queryClient.invalidateQueries({ queryKey: ['mail-accounts'] }); setAccountForm({ email: '', username: '', password: '', display_name: '', preset: '' }); setShowAddAccount(false); },
  });

  const removeAccount = useMutation({
    mutationFn: (id: string) => deleteMailAccount(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-accounts'] }),
  });

  const addTemplate = useMutation({
    mutationFn: () => createMailTemplate(token!, templateForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mail-templates'] }); setTemplateForm({ name: '', subject: '', body_text: '' }); },
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteMailTemplate(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail-templates'] }),
  });

  const selectAccount = (id: string) => {
    setSelectedAccount(id);
    setSelectedFolder('INBOX');
    setSelectedUid('');
    router.push(`/admin/communication/mail?account=${encodeURIComponent(id)}`);
  };

  const selectFolder = (path: string) => {
    setSelectedFolder(path);
    setSelectedUid('');
    router.push(`/admin/communication/mail?account=${encodeURIComponent(selectedAccount)}&folder=${encodeURIComponent(path)}`);
  };

  const selectMessage = (m: CachedEmail) => {
    setSelectedUid(String(m.uid));
    router.push(`/admin/communication/mail?account=${encodeURIComponent(selectedAccount)}&folder=${encodeURIComponent(selectedFolder)}&uid=${encodeURIComponent(m.uid)}`);
  };

  const selectedMessage = messageDetail?.data as CachedEmail | undefined;

  return (
    <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] -m-2 lg:-m-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_2fr] gap-0 rounded-2xl overflow-hidden nm-raised h-full">
        {/* Left sidebar: accounts, folders, templates */}
        <div className="hidden md:flex flex-col border-r border-border/50 bg-background/50 min-h-0">
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">Accounts</h2>
              <button onClick={() => setShowAddAccount(!showAddAccount)} className="p-1 rounded-md text-muted-foreground hover:text-foreground" title="Add account"><Plus className="h-4 w-4" /></button>
            </div>
            {showAddAccount && (
              <div className="space-y-2 nm-inset-sm rounded-xl p-3 mb-2">
                <Input placeholder="Email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value, username: e.target.value })} className="h-8 text-sm" />
                <Input type="password" placeholder="Password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Display name" value={accountForm.display_name} onChange={(e) => setAccountForm({ ...accountForm, display_name: e.target.value })} className="h-8 text-sm" />
                <select value={accountForm.preset} onChange={(e) => setAccountForm({ ...accountForm, preset: e.target.value })} className="h-8 text-sm rounded-md border bg-background px-2">
                  <option value="">Preset</option>
                  {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7" onClick={() => accountForm.email && accountForm.password && addAccount.mutate()} disabled={addAccount.isPending}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowAddAccount(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search accounts..." className="pl-7 h-8 text-xs" />
            </div>
            <Button asChild size="sm" className="w-full mt-2"><Link href="/admin/communication/mail/compose"><Plus className="mr-1 h-4 w-4" /> Compose</Link></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {loadingAccounts ? <Skeleton className="h-16 w-full" /> : (
              <div className="space-y-1">
                {filteredAccounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => selectAccount(a.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${selectedAccount === a.id ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}
                  >
                    <span className="truncate">{a.display_name || a.email}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete account?')) removeAccount.mutate(a.id); }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                ))}
                {!filteredAccounts.length && <div className="text-xs text-muted-foreground px-2">No accounts.</div>}
              </div>
            )}

            {selectedAccount && (
              <div>
                <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Folders</h3>
                {loadingFolders ? <Skeleton className="h-8 w-full" /> : folderList.map((f) => {
                  const Icon = getFolderIcon(f);
                  const active = selectedFolder === f.path;
                  return (
                    <button key={f.path} onClick={() => selectFolder(f.path)} className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${active ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate flex-1">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Templates</h3>
              <div className="nm-inset-sm rounded-xl p-2 space-y-2">
                <div className="flex gap-1">
                  <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Name" className="h-7 text-xs" />
                  <Input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Subject" className="h-7 text-xs" />
                  <Button size="sm" className="h-7 px-2" onClick={() => templateForm.name && addTemplate.mutate()} disabled={addTemplate.isPending}>Add</Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Search templates..." className="pl-6 h-7 text-xs" />
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filteredTemplates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-1 text-xs px-1 py-1 rounded hover:bg-muted">
                      <span className="truncate">{t.name}</span>
                      <button onClick={() => removeTemplate.mutate(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile account/folder selector */}
        <div className="md:hidden p-3 border-b border-border/50 bg-background/50 space-y-2">
          <select value={selectedAccount} onChange={(e) => selectAccount(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">Select account</option>
            {accountList.map((a) => <option key={a.id} value={a.id}>{a.display_name || a.email}</option>)}
          </select>
          {selectedAccount && (
            <select value={selectedFolder} onChange={(e) => selectFolder(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {folderList.map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
          )}
          <Button asChild size="sm" variant="outline" className="w-full"><Link href="/admin/communication/mail/compose"><Plus className="mr-1 h-4 w-4" /> Compose</Link></Button>
        </div>

        {/* Message list */}
        <div className="flex flex-col min-h-0 border-r border-border/50 bg-background">
          <div className="p-3 border-b border-border/50 flex flex-col gap-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold truncate">{selectedFolder || 'Messages'}</h2>
              <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['mail-messages', token, selectedAccount, selectedFolder] })}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={messageSearch} onChange={(e) => { setMessageSearch(e.target.value); setPage(0); }} placeholder="Search messages..." className="pl-7 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="h-8 rounded-md border bg-background px-2 text-xs">
                <option value="date-desc">Newest</option>
                <option value="date-asc">Oldest</option>
                <option value="subject-asc">Subject A-Z</option>
                <option value="subject-desc">Subject Z-A</option>
                <option value="from-asc">From A-Z</option>
                <option value="from-desc">From Z-A</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={onlyUnread} onChange={(e) => { setOnlyUnread(e.target.checked); setPage(0); }} className="rounded" /> Unread
              </label>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingMessages ? <Skeleton className="h-16 w-full" /> : (
              <div className="divide-y divide-border/50">
                {messageList.map((m) => (
                  <button
                    key={m.uid}
                    onClick={() => selectMessage(m)}
                    className={`w-full text-left px-3 py-3 transition-all hover:bg-muted/50 ${selectedUid === String(m.uid) ? 'bg-primary/5' : ''} ${!m.is_read ? 'font-semibold' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{m.from_name || m.from_address}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatMailDate(m.date)}</span>
                    </div>
                    <div className="text-sm truncate">{m.subject || '(no subject)'}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.preview || m.text_body?.slice(0, 80) || ''}</div>
                    {m.is_starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mt-1" />}
                  </button>
                ))}
                {!messageList.length && <div className="p-6 text-center text-muted-foreground text-sm">No messages.</div>}
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="p-2 border-t border-border/50 flex items-center justify-between">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>

        {/* Reading pane */}
        <div className="flex flex-col min-h-0 bg-background">
          {loadingDetail && selectedUid ? (
            <div className="flex-1 p-6 space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedMessage ? (
            <>
              <div className="p-3 border-b border-border/50 flex items-start justify-between gap-2 bg-muted/20">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg leading-tight">{selectedMessage.subject || '(no subject)'}</h2>
                  <div className="text-xs text-muted-foreground mt-1">From: {selectedMessage.from_name || selectedMessage.from_address} &lt;{selectedMessage.from_address}&gt;</div>
                  <div className="text-xs text-muted-foreground">{selectedMessage.date ? new Date(selectedMessage.date).toLocaleString('en-AU') : ''}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" asChild><Link href={`/admin/communication/mail/compose?reply=${selectedUid}`}><Reply className="h-4 w-4" /></Link></Button>
                  <Button size="sm" variant="ghost" asChild><Link href={`/admin/communication/mail/compose?forward=${selectedUid}`}><Forward className="h-4 w-4" /></Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => {}}><Star className={`h-4 w-4 ${selectedMessage.is_starred ? 'fill-yellow-500 text-yellow-500' : ''}`} /></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {selectedMessage.html_body ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedMessage.html_body }} />
                ) : selectedMessage.text_body ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{selectedMessage.text_body}</div>
                ) : selectedMessage.preview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">{selectedMessage.preview}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">No content.</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a message to read</div>
          )}
        </div>
      </div>
    </div>
  );
}
