'use client';

import { PageShell } from '@/components/design-system/PageShell';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatCards } from '@/components/design-system/StatCards';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { fetchTicket, updateTicket, replyToTicket, deleteTicket, fetchSupportStaff, fetchCannedResponses, uploadTicketAttachments } from '@/lib/api';
import type { Ticket, TicketMessage, SupportStaff } from '@/types/support';
import { formatDateTime, formatDuration } from '@/lib/format';
import { toast } from 'sonner';
import {
  AlertCircle, ArrowLeft, Briefcase, Clock, Link as LinkIcon, MessageSquare, Paperclip,
  Send, Trash2, Users, User, RefreshCw, Lock, Star, Eye, EyeOff, X,
  Copy, Tag, Ticket as TicketIcon
} from 'lucide-react';

const statuses = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['general', 'technical', 'billing', 'sales', 'feature_request', 'bug_report', 'account', 'other'];
const replyStatusOptions = ['', 'in_progress', 'waiting_customer', 'resolved'];

function statusVariant(status: string) {
  if (['closed', 'resolved'].includes(status)) return 'default';
  if (['waiting_customer', 'waiting_staff'].includes(status)) return 'secondary';
  if (status === 'open') return 'outline';
  return 'outline';
}

function priorityVariant(priority: string) {
  if (priority === 'urgent') return 'destructive';
  if (priority === 'high') return 'default';
  return 'secondary';
}

function messageIcon(type: string) {
  switch (type) {
    case 'status_change': return <RefreshCw className="h-3 w-3" />;
    case 'assignment_change': return <User className="h-3 w-3" />;
    case 'internal_note': return <Lock className="h-3 w-3" />;
    case 'system': return <AlertCircle className="h-3 w-3" />;
    default: return <MessageSquare className="h-3 w-3" />;
  }
}

function attachmentUrl(att: any) {
  return typeof att === 'string' ? att : att?.url;
}
function attachmentName(att: any, idx: number) {
  return typeof att === 'string' ? `Attachment ${idx + 1}` : (att?.name || `Attachment ${idx + 1}`);
}

export default function AdminTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [updateStatusOnSend, setUpdateStatusOnSend] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showInternalNotes, setShowInternalNotes] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: ['ticket', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTicket(token, id);
    },
    enabled: !!token && !!id,
  });

  const { data: staff } = useQuery<SupportStaff[]>({
    queryKey: ['support-staff', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchSupportStaff(token);
    },
    enabled: !!token,
  });

  const { data: cannedResponses } = useQuery({
    queryKey: ['canned-responses', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchCannedResponses(token);
    },
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => updateTicket(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', token, id] }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!token || !ticket) throw new Error('Missing token/ticket');
      let uploaded: { url: string; name: string; size?: number }[] = [];
      if (pendingFiles.length > 0) {
        const res = await uploadTicketAttachments(token, id, pendingFiles);
        uploaded = res.urls || [];
      }
      return replyToTicket(token, id, {
        message: reply.trim() || `Shared ${pendingFiles.length} file(s)`,
        is_internal: isInternal,
        update_status: updateStatusOnSend || undefined,
        attachments: uploaded,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', token, id] });
      setReply('');
      setPendingFiles([]);
      setIsInternal(false);
      setUpdateStatusOnSend('');
    },
    onError: () => toast.error('Failed to send reply'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTicket(token!, id),
    onSuccess: () => router.push('/admin/support'),
    onError: () => toast.error('Failed to delete ticket'),
  });

  const timeSpent = useMemo(() => {
    const fromLogs = (ticket?.time_logs || []).reduce((sum, log: any) => sum + (log.duration_minutes || 0), 0);
    return fromLogs || (ticket?.time_spent_minutes ?? 0);
  }, [ticket?.time_logs, ticket?.time_spent_minutes]);

  const filteredMessages = useMemo(() => {
    const msgs = (ticket?.messages || []).slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return showInternalNotes ? msgs : msgs.filter((m) => !m.is_internal);
  }, [ticket?.messages, showInternalNotes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  if (error) return <PageShell title="Ticket" icon={TicketIcon} description="Error"><div className="p-6 text-destructive">Failed to load ticket.</div></PageShell>;

  const title = ticket ? `${ticket.ticket_number}: ${ticket.subject}` : 'Ticket';
  const description = ticket ? `${ticket.contact_email || 'Guest'} · ${ticket.category}` : 'Support ticket detail';

  const statCards = ticket
    ? [
        { label: 'Messages', value: ticket.messages?.length ?? 0, icon: MessageSquare },
        { label: 'Time Spent', value: formatDuration(timeSpent * 60) || '0m', icon: Clock },
        { label: 'Watchers', value: ticket.watchers?.length ?? 0, icon: Users },
        { label: 'Child Tickets', value: ticket.child_tickets?.length ?? 0, icon: TicketIcon },
      ]
    : [];

  const handleAddTag = () => {
    if (!newTag.trim() || !ticket) return;
    const tags = [...(ticket.tags || []), newTag.trim()];
    updateMutation.mutate({ tags });
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    if (!ticket) return;
    updateMutation.mutate({ tags: (ticket.tags || []).filter((t) => t !== tag) });
  };

  const copyTicketNumber = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_number);
    toast.success('Copied ticket number');
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    setPendingFiles((p) => [...p, ...picked].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <PageShell
      title={title}
      icon={TicketIcon}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/support"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copyTicketNumber} disabled={!ticket}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} disabled={!ticket}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        </div>
      }
    >
      {isLoading || !ticket ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-2xl">{ticket.ticket_number}: {ticket.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground">{ticket.contact_email || 'Guest'} · created {formatDateTime(ticket.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={statusVariant(ticket.status)} className="capitalize">{ticket.status.replace('_', ' ')}</Badge>
                      <Badge variant={priorityVariant(ticket.priority)} className="capitalize">{ticket.priority}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select value={ticket.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={ticket.priority} onValueChange={(v) => updateMutation.mutate({ priority: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Select value={ticket.category} onValueChange={(v) => updateMutation.mutate({ category: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Assigned to</label>
                    <Select value={ticket.assigned_to ? String(ticket.assigned_to) : ''} onValueChange={(v) => updateMutation.mutate({ assigned_to: v ? Number(v) : null })}>
                      <SelectTrigger className="mt-1 w-full sm:max-w-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {staff?.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.first_name} {s.last_name} ({s.open_tickets_count} open)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold">Description</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{ticket.description}</p>
                  </div>

                  {ticket.internal_notes && (
                    <div className="rounded bg-muted p-3">
                      <h3 className="font-semibold text-sm">Internal Notes</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{ticket.internal_notes}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {(ticket.tags || []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                      placeholder="Add tag..."
                      className="w-32 h-8 text-xs"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Conversation <span className="text-muted-foreground text-sm font-normal">({filteredMessages.length})</span></h3>
                      <Button variant="outline" size="sm" onClick={() => setShowInternalNotes((v) => !v)}>
                        {showInternalNotes ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                        {showInternalNotes ? 'Hide notes' : 'Show notes'}
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                      {filteredMessages.map((msg) => <Message key={msg.id} message={msg} ticket={ticket} />)}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 ${isInternal ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800' : 'bg-muted/30 border-border'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {cannedResponses && cannedResponses.length > 0 && (
                          <Select value="" onValueChange={(v) => { if (v) setReply((r) => r + v); }}>
                            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Canned response" /></SelectTrigger>
                            <SelectContent>
                              {cannedResponses.map((r) => (
                                <SelectItem key={r.id ?? r.title} value={r.content} className="text-xs">{r.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={updateStatusOnSend} onValueChange={(v) => setUpdateStatusOnSend(v)}>
                          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Keep status" /></SelectTrigger>
                          <SelectContent>
                            {replyStatusOptions.map((s) => <SelectItem key={s} value={s}>{s ? `→ ${s.replace('_', ' ')}` : 'Keep status'}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="h-4 w-4" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                        <Lock className={`h-3.5 w-3.5 ${isInternal ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <span className={isInternal ? 'text-amber-600' : 'text-muted-foreground'}>{isInternal ? 'Internal note' : 'Reply to customer'}</span>
                      </label>
                    </div>

                    {pendingFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {pendingFiles.map((f, i) => (
                          <Badge key={i} variant="outline" className="gap-1">
                            <Paperclip className="h-3 w-3" />{f.name}
                            <button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); replyMutation.mutate(); } }}
                      placeholder={isInternal ? 'Write an internal note (only visible to staff)...' : 'Type your reply... (⌘↵ to send)'}
                      rows={3}
                      className="mb-2 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Paperclip className="mr-1 h-4 w-4" /> Attach</Button>
                      <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={onFileSelect} />
                      <Button
                        disabled={(!reply.trim() && pendingFiles.length === 0) || replyMutation.isPending}
                        onClick={() => replyMutation.mutate()}
                        className={isInternal ? 'bg-amber-600 hover:bg-amber-700' : ''}
                      >
                        {replyMutation.isPending ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                        {isInternal ? 'Add Note' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">{ticket.user?.name || `${ticket.user?.first_name || ''} ${ticket.user?.last_name || ''}`.trim() || ticket.guest_name || 'Guest'}</p>
                    {ticket.user && <p className="text-xs text-primary">Registered User</p>}
                    <a href={`mailto:${ticket.contact_email}`} className="text-muted-foreground hover:text-primary">{ticket.contact_email}</a>
                    {ticket.user?.phone && <p className="text-muted-foreground">{ticket.user.phone}</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDateTime(ticket.created_at)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Activity</span> <span>{ticket.last_activity_at ? formatDateTime(ticket.last_activity_at) : 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">First Response</span> <span>{ticket.first_response_at ? formatDateTime(ticket.first_response_at) : 'Pending'}</span></div>
                  {ticket.resolved_at && <div className="flex justify-between"><span className="text-muted-foreground">Resolved</span> <span>{formatDateTime(ticket.resolved_at)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Source</span> <span className="capitalize">{ticket.source || 'Web'}</span></div>
                </CardContent>
              </Card>

              {ticket.satisfaction_rating && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" /> Feedback</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-5 w-5 ${star <= ticket.satisfaction_rating! ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />)}
                      <span className="ml-2 text-sm text-muted-foreground">{ticket.satisfaction_rating}/5</span>
                    </div>
                    {ticket.satisfaction_feedback && <p className="text-sm text-muted-foreground italic">&ldquo;{ticket.satisfaction_feedback}&rdquo;</p>}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Related</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {ticket.crm_project ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /> Project</span>
                      <Link href={`/admin/crm/projects/${ticket.crm_project.id}`} className="text-primary hover:underline">{ticket.crm_project.name || `Project ${ticket.crm_project.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.deal ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><LinkIcon className="h-4 w-4" /> Deal</span>
                      <Link href={`/admin/crm/deals/${ticket.deal.id}`} className="text-primary hover:underline">{ticket.deal.title || `Deal ${ticket.deal.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.bug_report ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="h-4 w-4" /> Bug</span>
                      <Link href={`/admin/bug-reports/${ticket.bug_report.id}`} className="text-primary hover:underline">{ticket.bug_report.title || `Bug ${ticket.bug_report.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.parent_ticket ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><TicketIcon className="h-4 w-4" /> Parent</span>
                      <Link href={`/admin/support/${ticket.parent_ticket.id}`} className="text-primary hover:underline">{ticket.parent_ticket.ticket_number}</Link>
                    </div>
                  ) : null}
                  {!ticket.crm_project && !ticket.deal && !ticket.bug_report && !ticket.parent_ticket && <p className="text-muted-foreground">No related records.</p>}
                </CardContent>
              </Card>

              {ticket.child_tickets && ticket.child_tickets.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Child Tickets</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {ticket.child_tickets.map((t) => (
                      <Link key={t.id} href={`/admin/support/${t.id}`} className="block rounded border p-2 hover:bg-primary/5">
                        <div className="flex items-center justify-between text-sm">
                          <span>{t.ticket_number}: {t.subject}</span>
                          <Badge variant={statusVariant(t.status)} className="text-xs capitalize">{t.status.replace('_', ' ')}</Badge>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {ticket.time_logs && ticket.time_logs.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Time Logs</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {ticket.time_logs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between rounded border p-2">
                        <span>{log.user?.name || `${log.user?.first_name || ''} ${log.user?.last_name || ''}`.trim() || '—'}</span>
                        <span className="text-muted-foreground">{formatDuration((log.duration_minutes || 0) * 60)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Ticket?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete {ticket?.ticket_number}? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Message({ message, ticket }: { message: TicketMessage; ticket: Ticket }) {
  const type = message.message_type || 'reply';
  const system = ['status_change', 'assignment_change', 'system'].includes(type);
  const internal = message.is_internal || type === 'internal_note';
  const staff = message.is_staff_reply;
  const sender = message.sender?.name || `${message.sender?.first_name || ''} ${message.sender?.last_name || ''}`.trim() || message.sender_name || 'Support';

  if (system) {
    return (
      <div className="flex items-center justify-center gap-2 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
          {messageIcon(type)}
          {message.message}
          <span className="text-muted-foreground/70">· {formatDateTime(message.created_at)}</span>
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  if (internal) {
    return (
      <div className="flex gap-3">
        <PersonAvatar name={sender} avatar_url={message.sender?.avatar} size="sm" />
        <div className="max-w-[75%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">{sender}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1"><Lock className="h-2.5 w-2.5 mr-1" />Internal</Badge>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(message.created_at)}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap">{message.message}</div>
          <Attachments attachments={message.attachments} />
        </div>
      </div>
    );
  }

  if (staff) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[75%] text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground">{formatDateTime(message.created_at)}</span>
            <span className="text-xs font-semibold">{sender}</span>
            <Badge className="text-[10px] h-4 px-1">Staff</Badge>
          </div>
          <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-4 py-3 text-sm whitespace-pre-wrap text-left">{message.message}</div>
          <div className="flex justify-end"><Attachments attachments={message.attachments} /></div>
        </div>
        <PersonAvatar name={sender} avatar_url={message.sender?.avatar} size="sm" />
      </div>
    );
  }

  const customerName = ticket.user?.name || `${ticket.user?.first_name || ''} ${ticket.user?.last_name || ''}`.trim() || ticket.guest_name || 'Guest';
  return (
    <div className="flex gap-3">
      <PersonAvatar name={customerName} avatar_url={ticket.user?.avatar} size="sm" />
      <div className="max-w-[75%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold">{customerName}</span>
          <span className="text-[11px] text-muted-foreground">{formatDateTime(message.created_at)}</span>
        </div>
        <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap">{message.message}</div>
        <Attachments attachments={message.attachments} />
      </div>
    </div>
  );
}

function Attachments({ attachments }: { attachments?: unknown[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((att, idx) => {
        const url = attachmentUrl(att);
        const name = attachmentName(att, idx);
        if (!url) return null;
        return (
          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted border rounded-md hover:bg-primary/5">
            <Paperclip className="h-3 w-3" />{name}
          </a>
        );
      })}
    </div>
  );
}
