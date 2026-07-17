'use client';

import { PageShell } from '@/components/design-system/PageShell';
import { useMemo, useState } from 'react';
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
import { StatCards } from '@/components/design-system/StatCards';
import { fetchTicket, updateTicket, replyToTicket, deleteTicket, fetchSupportStaff } from '@/lib/api';
import type { Ticket, TicketMessage, SupportStaff } from '@/types/support';
import { formatDateTime, formatDuration } from '@/lib/format';
import { AlertCircle, ArrowLeft, Briefcase, Clock, Link as LinkIcon, MessageCircle, Ticket as TicketIcon, Trash2, Users } from 'lucide-react';

const statuses = ['open', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['general', 'technical', 'billing', 'sales', 'feature_request', 'bug_report', 'account', 'other'];

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

export default function AdminTicketDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);

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

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => updateTicket(token!, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', token, id] }),
  });

  const replyMutation = useMutation({
    mutationFn: (data: { message: string; is_internal: boolean }) => replyToTicket(token!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', token, id] });
      setReply('');
      setIsInternal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTicket(token!, id),
    onSuccess: () => router.push('/admin/support'),
  });

  const timeSpent = useMemo(() => {
    const fromLogs = (ticket?.time_logs || []).reduce((sum, log: any) => sum + (log.duration_minutes || 0), 0);
    return fromLogs || (ticket?.time_spent_minutes ?? 0);
  }, [ticket?.time_logs, ticket?.time_spent_minutes]);

  if (error) return <PageShell title="Ticket" icon={TicketIcon} description="Error"><div className="p-6 text-destructive">Failed to load ticket.</div></PageShell>;

  const title = ticket ? `${ticket.ticket_number}: ${ticket.subject}` : 'Ticket';
  const description = ticket ? `${ticket.contact_email || 'Guest'} · ${ticket.category}` : 'Support ticket detail';

  const statCards = ticket
    ? [
        { label: 'Messages', value: ticket.messages?.length ?? 0, icon: MessageCircle },
        { label: 'Time Spent', value: formatDuration(timeSpent * 60) || '0m', icon: Clock },
        { label: 'Watchers', value: ticket.watchers?.length ?? 0, icon: Users },
        { label: 'Child Tickets', value: ticket.child_tickets?.length ?? 0, icon: TicketIcon },
      ]
    : [];

  return (
    <PageShell
      title={title}
      icon={TicketIcon}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/support"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
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
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{ticket.ticket_number}: {ticket.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground">{ticket.contact_email || 'Guest'} · created {formatDateTime(ticket.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={statusVariant(ticket.status)}>{ticket.status.replace('_', ' ')}</Badge>
                      <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <select value={ticket.status} onChange={(e) => updateMutation.mutate({ status: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                        {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <select value={ticket.priority} onChange={(e) => updateMutation.mutate({ priority: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                        {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <select value={ticket.category} onChange={(e) => updateMutation.mutate({ category: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Assigned to</label>
                    <select
                      value={ticket.assigned_to ?? ''}
                      onChange={(e) => updateMutation.mutate({ assigned_to: e.target.value ? Number(e.target.value) : null })}
                      className="mt-1 w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {staff?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>)}
                    </select>
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

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">Messages</h3>
                    {(ticket.messages ?? []).map((msg) => <Message key={msg.id} message={msg} />)}
                  </div>

                  <div className="space-y-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." rows={4} />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-4 w-4" />
                        Internal note
                      </label>
                      <Button disabled={!reply.trim() || replyMutation.isPending} onClick={() => replyMutation.mutate({ message: reply, is_internal: isInternal })}>Send</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>People</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requester</p>
                    <p>{ticket.user?.name || ticket.user?.first_name + ' ' + ticket.user?.last_name || ticket.guest_name || ticket.contact_email || '—'}</p>
                    <p className="text-xs text-muted-foreground">{ticket.user?.email || ticket.guest_email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assignee</p>
                    <p>{ticket.assignee?.name || ticket.assignee?.first_name + ' ' + ticket.assignee?.last_name || 'Unassigned'}</p>
                    <p className="text-xs text-muted-foreground">{ticket.assignee?.email}</p>
                  </div>
                  {ticket.watchers && ticket.watchers.length > 0 && (
                    <div>
                      <p className="text-muted-foreground">Watchers</p>
                      <p>{ticket.watchers.map((w) => w.name || `${w.first_name} ${w.last_name}`.trim()).filter(Boolean).join(', ')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Related</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {ticket.crm_project ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> Project</span>
                      <Link href={`/admin/crm/projects/${ticket.crm_project.id}`} className="text-primary hover:underline">{ticket.crm_project.name || `Project ${ticket.crm_project.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.deal ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Deal</span>
                      <Link href={`/admin/crm/deals/${ticket.deal.id}`} className="text-primary hover:underline">{ticket.deal.title || `Deal ${ticket.deal.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.bug_report ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Bug</span>
                      <Link href={`/admin/bug-reports/${ticket.bug_report.id}`} className="text-primary hover:underline">{ticket.bug_report.title || `Bug ${ticket.bug_report.id}`}</Link>
                    </div>
                  ) : null}
                  {ticket.parent_ticket ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><TicketIcon className="h-4 w-4" /> Parent</span>
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
                          <Badge variant={statusVariant(t.status)} className="text-xs">{t.status.replace('_', ' ')}</Badge>
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
    </PageShell>
  );
}

function Message({ message }: { message: TicketMessage }) {
  const sender = message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : (message.sender_name || 'Unknown');
  return (
    <div className={`rounded-lg border p-4 ${message.is_internal ? 'bg-muted' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{sender} {message.is_staff_reply ? '(staff)' : ''}</span>
        <span className="text-xs text-muted-foreground">{formatDateTime(message.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{message.message}</p>
      {message.is_internal && <Badge variant="outline" className="mt-2">Internal</Badge>}
    </div>
  );
}
