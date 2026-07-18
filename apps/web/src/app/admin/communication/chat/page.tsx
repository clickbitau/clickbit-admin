'use client';
import { MessageSquare as MessageSquareIcon, Plus } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWorkspaces, fetchChannels, fetchDirectMessages, fetchMessagesForChannel, fetchMessagesForDm, sendMessage, fetchChatParticipants } from '@/lib/api';
import type { Channel, DirectMessage, Message, Workspace } from '@/types/communication';

type Conversation = { kind: 'channel'; id: number; name: string } | { kind: 'dm'; id: number; name: string };

export default function AdminCommunicationChatPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery({
    queryKey: ['workspaces', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchWorkspaces(token); },
    enabled: !!token,
  });

  useEffect(() => {
    if (workspaces?.data?.length && !selectedWorkspace) setSelectedWorkspace(workspaces.data[0].id);
  }, [workspaces, selectedWorkspace]);

  const { data: channels } = useQuery({
    queryKey: ['channels', token, selectedWorkspace],
    queryFn: async () => { if (!token || !selectedWorkspace) throw new Error('No token'); return fetchChannels(token, selectedWorkspace); },
    enabled: !!token && !!selectedWorkspace,
  });

  const { data: dms } = useQuery({
    queryKey: ['direct-messages', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchDirectMessages(token); },
    enabled: !!token,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', token, conversation?.kind, conversation?.id],
    queryFn: async () => {
      if (!token || !conversation) throw new Error('No conversation');
      if (conversation.kind === 'channel') return fetchMessagesForChannel(token, conversation.id);
      return fetchMessagesForDm(token, conversation.id);
    },
    enabled: !!token && !!conversation,
  });

  const send = useMutation({
    mutationFn: () => {
      if (!token || !conversation) throw new Error('No token');
      const data: any = { content: draft };
      if (conversation.kind === 'channel') data.channelId = conversation.id;
      else data.directMessageId = conversation.id;
      return sendMessage(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
      setDraft('');
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <PageShell
      title="Chat"
      icon={MessageSquareIcon}
      actions={<Button asChild><Link href="/admin/communication/chat/new"><Plus className="mr-1 h-4 w-4" /> New</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="h-[50vh] md:h-[calc(100vh-12rem)]">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <select value={selectedWorkspace ?? ''} onChange={(e) => setSelectedWorkspace(Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Select workspace</option>
              {workspaces?.data?.map((w: Workspace) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </CardHeader>
          <CardContent className="space-y-4 overflow-auto">
            {loadingWorkspaces ? <Skeleton className="h-8 w-full" /> : (
              <>
                <div className="text-sm font-medium text-muted-foreground">Channels</div>
                {channels?.data?.map((c: Channel) => (
                  <button key={c.id} onClick={() => setConversation({ kind: 'channel', id: c.id, name: c.name })} className="block w-full text-left text-sm hover:underline">
                    # {c.name}
                  </button>
                ))}
                <div className="text-sm font-medium text-muted-foreground pt-2">Direct messages</div>
                {dms?.data?.map((d: DirectMessage) => (
                  <button key={d.id} onClick={() => setConversation({ kind: 'dm', id: d.id, name: d.name || `DM ${d.id}` })} className="block w-full text-left text-sm hover:underline">
                    {d.name || `DM ${d.id}`}
                  </button>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-[50vh] md:h-[calc(100vh-12rem)] flex flex-col">
          <CardHeader>
            <CardTitle>{conversation ? conversation.name : 'Select a conversation'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-3">
            {loadingMessages ? <Skeleton className="h-8 w-full" /> : (
              (messages?.messages || []).map((m: Message) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{m.author ? `${m.author.first_name} ${m.author.last_name}` : `User ${m.user_id}`}</span>
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm">{m.content}</div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </CardContent>
          {conversation && (
            <CardContent className="border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) send.mutate(); }} className="flex-1" />
                <Button onClick={() => draft.trim() && send.mutate()} disabled={send.isPending} className="w-full sm:w-auto">Send</Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </PageShell>
  );
}