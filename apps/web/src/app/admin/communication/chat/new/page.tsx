'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { createChannel, createDirectMessage, createWorkspace, fetchChatParticipants, fetchWorkspaces } from '@/lib/api';
import type { Channel, DirectMessage, Workspace } from '@clickbit/shared';
import { ArrowLeft, MessageSquarePlus, Plus } from 'lucide-react';

type Tab = 'workspace' | 'channel' | 'dm';

export default function AdminNewChatPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('channel');

  const { data: participantsData, isLoading: loadingParticipants } = useQuery({
    queryKey: ['chat-participants', token],
    queryFn: () => fetchChatParticipants(token!),
    enabled: !!token,
  });

  const { data: workspacesData, isLoading: loadingWorkspaces } = useQuery({
    queryKey: ['workspaces', token],
    queryFn: () => fetchWorkspaces(token!),
    enabled: !!token,
  });

  const participants = participantsData?.data ?? [];
  const workspaces = workspacesData?.data ?? [];

  const workspaceMutation = useMutation({
    mutationFn: (data: Partial<Workspace>) => createWorkspace(token!, data),
    onSuccess: (res: any) => {
      toast.success('Workspace created');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      const id = res?.workspace?.id || res?.data?.id;
      router.push(id ? `/admin/communication/chat?workspace=${id}` : '/admin/communication/chat');
    },
    onError: () => toast.error('Failed to create workspace'),
  });

  const channelMutation = useMutation({
    mutationFn: (data: Partial<Channel>) => createChannel(token!, data),
    onSuccess: (res: any) => {
      toast.success('Channel created');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      const id = res?.data?.id || res?.channel?.id;
      router.push(id ? `/admin/communication/chat?channel=${id}` : '/admin/communication/chat');
    },
    onError: () => toast.error('Failed to create channel'),
  });

  const dmMutation = useMutation({
    mutationFn: (data: { participant_ids: number[]; type?: 'dm' | 'group'; name?: string }) => createDirectMessage(token!, data),
    onSuccess: (res: any) => {
      toast.success('Conversation created');
      queryClient.invalidateQueries({ queryKey: ['direct-messages'] });
      const id = res?.data?.id || res?.directMessage?.id || res?.conversation?.id;
      router.push(id ? `/admin/communication/chat?dm=${id}` : '/admin/communication/chat');
    },
    onError: () => toast.error('Failed to create conversation'),
  });

  return (
    <PageShell
      title="New Conversation"
      icon={MessageSquarePlus}
      description="Create a workspace, channel, or direct message"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/communication/chat"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="flex gap-2">
        {(['workspace', 'channel', 'dm'] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)}>
            {t === 'dm' ? 'Direct Message' : t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'workspace' && <WorkspaceForm onSubmit={(d) => workspaceMutation.mutate(d)} loading={workspaceMutation.isPending} />}
      {tab === 'channel' && <ChannelForm workspaces={workspaces} loadingWorkspaces={loadingWorkspaces} onSubmit={(d) => channelMutation.mutate(d)} loading={channelMutation.isPending} />}
      {tab === 'dm' && <DmForm participants={participants} loadingParticipants={loadingParticipants} onSubmit={(d) => dmMutation.mutate(d)} loading={dmMutation.isPending} />}
    </PageShell>
  );
}

function WorkspaceForm({ onSubmit, loading }: { onSubmit: (d: Partial<Workspace>) => void; loading?: boolean }) {
  const [form, setForm] = useState<Partial<Workspace>>({ name: '', description: '' });
  return (
    <Card>
      <CardHeader><CardTitle>New Workspace</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        <div><Button onClick={() => form.name && onSubmit(form)} disabled={loading}><Plus className="mr-2 h-4 w-4" /> Create Workspace</Button></div>
      </CardContent>
    </Card>
  );
}

function ChannelForm({ workspaces, loadingWorkspaces, onSubmit, loading }: { workspaces: Workspace[]; loadingWorkspaces: boolean; onSubmit: (d: Partial<Channel>) => void; loading?: boolean }) {
  const [form, setForm] = useState<Partial<Channel>>({ workspace_id: 0, name: '', type: 'public', description: '' });
  return (
    <Card>
      <CardHeader><CardTitle>New Channel</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><Label>Workspace</Label>
          {loadingWorkspaces ? <Skeleton className="h-10 w-full" /> : (
            <select value={form.workspace_id || ''} onChange={(e) => setForm({ ...form, workspace_id: Number(e.target.value) })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select workspace</option>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
        </div>
        <div><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Type</Label>
          <select value={form.type || 'public'} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        <div><Button onClick={() => form.workspace_id && form.name && onSubmit(form)} disabled={loading}><Plus className="mr-2 h-4 w-4" /> Create Channel</Button></div>
      </CardContent>
    </Card>
  );
}

function DmForm({ participants, loadingParticipants, onSubmit, loading }: { participants: { id: number; first_name: string; last_name: string; email: string }[]; loadingParticipants: boolean; onSubmit: (d: { participant_ids: number[]; type?: 'dm' | 'group'; name?: string }) => void; loading?: boolean }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [type, setType] = useState<'dm' | 'group'>('dm');
  const [name, setName] = useState('');
  return (
    <Card>
      <CardHeader><CardTitle>New Direct Message / Group</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value as 'dm' | 'group')} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="dm">Direct Message</option>
            <option value="group">Group</option>
          </select>
        </div>
        {type === 'group' && <div><Label>Group name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <div className="md:col-span-2"><Label>Participants</Label>
          {loadingParticipants ? <Skeleton className="h-24 w-full" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-auto border rounded-md p-2">
              {participants.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />
                  {p.first_name} {p.last_name} ({p.email})
                </label>
              ))}
            </div>
          )}
        </div>
        <div><Button onClick={() => selected.length && onSubmit({ participant_ids: selected, type, name: name || undefined })} disabled={loading}><Plus className="mr-2 h-4 w-4" /> Create Conversation</Button></div>
      </CardContent>
    </Card>
  );
}
