'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare as MessageSquareIcon,
  Plus,
  Hash,
  AtSign,
  Smile,
  Trash2,
  Users,
} from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchWorkspaces,
  fetchChannels,
  fetchDirectMessages,
  fetchMessagesForChannel,
  fetchMessagesForDm,
  sendMessage,
  addReaction,
  removeReaction,
  deleteMessage,
} from '@/lib/api';
import type { Channel, DirectMessage, Message, Reaction, Workspace } from '@/types/communication';
import type { ChatProfile } from '@clickbit/shared';

type Conversation = { kind: 'channel'; id: number; name: string } | { kind: 'dm'; id: number; name: string };

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];

function profileName(p?: ChatProfile | null) {
  if (!p) return 'Unknown';
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || p.email || `User ${p.id}`;
}

function dmName(dm: DirectMessage, currentUserId?: number): string {
  if (dm.name) return dm.name;
  const participants = (dm.participants || []).map((p) => p.user).filter(Boolean) as ChatProfile[];
  const others = currentUserId ? participants.filter((p) => p.id !== currentUserId) : participants;
  if (others.length === 0 && participants.length > 0) return profileName(participants[0]);
  if (others.length === 0) return `DM ${dm.id}`;
  if (dm.type === 'group' || others.length > 1) {
    const names = others.map((p) => `${p.first_name || p.email || 'User'}`);
    return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
  }
  return profileName(others[0]);
}

function useChatTitle(dm?: DirectMessage, channel?: Channel, currentUserId?: number) {
  return useMemo(() => {
    if (channel) return `# ${channel.name}`;
    if (dm) return dmName(dm, currentUserId);
    return 'Select a conversation';
  }, [dm, channel, currentUserId]);
}

function aggregateReactions(reactions?: Reaction[]) {
  const map = new Map<string, { emoji: string; count: number; userIds: number[] }>();
  (reactions || []).forEach((r) => {
    const entry = map.get(r.emoji) || { emoji: r.emoji, count: 0, userIds: [] };
    entry.count += 1;
    if (r.user_id) entry.userIds.push(r.user_id);
    map.set(r.emoji, entry);
  });
  return Array.from(map.values());
}

export default function AdminCommunicationChatPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [activeEmojiMessage, setActiveEmojiMessage] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery({
    queryKey: ['workspaces', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchWorkspaces(token); },
    enabled: !!token,
  });

  useEffect(() => {
    if (workspaces?.data?.length && !selectedWorkspace) setSelectedWorkspace(workspaces.data[0].id);
  }, [workspaces, selectedWorkspace]);

  const { data: channels, isLoading: loadingChannels } = useQuery({
    queryKey: ['channels', token, selectedWorkspace],
    queryFn: async () => { if (!token || !selectedWorkspace) throw new Error('No token'); return fetchChannels(token, selectedWorkspace); },
    enabled: !!token && !!selectedWorkspace,
  });

  const { data: dms, isLoading: loadingDms } = useQuery({
    queryKey: ['direct-messages', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchDirectMessages(token); },
    enabled: !!token,
  });

  const selectedChannel = useMemo(() => (conversation?.kind === 'channel' ? channels?.data?.find((c: Channel) => c.id === conversation.id) : undefined), [conversation, channels]);
  const selectedDm = useMemo(() => (conversation?.kind === 'dm' ? dms?.data?.find((d: DirectMessage) => d.id === conversation.id) : undefined), [conversation, dms]);

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
      const data: any = { content: draft.trim() };
      if (conversation.kind === 'channel') data.channelId = conversation.id;
      else data.directMessageId = conversation.id;
      return sendMessage(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
      setDraft('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return deleteMessage(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
    },
  });

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      if (!token) throw new Error('No token');
      return addReaction(token, messageId, emoji);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
      setActiveEmojiMessage(null);
    },
  });

  const unreact = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      if (!token) throw new Error('No token');
      return removeReaction(token, messageId, emoji);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!draft.trim()) return;
    send.mutate();
  };

  const toggleReaction = (message: Message, emoji: string) => {
    const currentUserReacted = (message.reactions || []).some((r) => r.emoji === emoji && r.user_id === user?.id);
    if (currentUserReacted) unreact.mutate({ messageId: message.id, emoji });
    else react.mutate({ messageId: message.id, emoji });
  };

  const onSelectDm = (d: DirectMessage) => {
    setConversation({ kind: 'dm', id: d.id, name: dmName(d, user?.id) });
  };

  const chatTitle = useChatTitle(selectedDm, selectedChannel, user?.id);

  return (
    <PageShell
      title="Chat"
      icon={MessageSquareIcon}
      actions={<Button asChild><Link href="/admin/communication/chat/new"><Plus className="mr-1 h-4 w-4" /> New</Link></Button>}
    >
      <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)] -m-4 sm:-m-6 overflow-hidden">
        <div className="grid h-full grid-cols-1 grid-rows-[1fr_2fr] md:grid-cols-[260px_1fr] md:grid-rows-1 divide-y md:divide-y-0 md:divide-x divide-border">
          <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conversations</CardTitle>
              <select value={selectedWorkspace ?? ''} onChange={(e) => setSelectedWorkspace(Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select workspace</option>
                {workspaces?.data?.map((w: Workspace) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 py-2">
              {loadingWorkspaces ? <Skeleton className="h-8 w-full" /> : (
                <>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Channels</div>
                    {loadingChannels ? <Skeleton className="h-8 w-full" /> : (channels?.data || []).map((c: Channel) => {
                      const active = conversation?.kind === 'channel' && conversation.id === c.id;
                      return (
                        <button key={c.id} onClick={() => setConversation({ kind: 'channel', id: c.id, name: c.name })} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${active ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}>
                          <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Direct messages</div>
                    {loadingDms ? <Skeleton className="h-8 w-full" /> : (dms?.data || []).map((d: DirectMessage) => {
                      const active = conversation?.kind === 'dm' && conversation.id === d.id;
                      const name = dmName(d, user?.id);
                      return (
                        <button key={d.id} onClick={() => onSelectDm(d)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${active ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}>
                          {d.type === 'group' ? <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <AtSign className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                          <span className="truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base truncate">{chatTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 py-4">
              {loadingMessages ? <Skeleton className="h-8 w-full" /> : conversation ? (
                (messages?.messages || []).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">No messages yet. Start the conversation.</div>
                ) : (
                  (messages?.messages || []).map((m: Message) => (
                    <div key={m.id} className="group flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full nm-raised-sm flex items-center justify-center flex-shrink-0 text-xs font-semibold text-muted-foreground">
                        {m.author ? (m.author.first_name?.[0] || m.author.email?.[0] || '?').toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold text-sm">{m.author ? profileName(m.author) : `User ${m.user_id}`}</span>
                          <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                        {(m.reactions?.length ? true : false) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {aggregateReactions(m.reactions).map((r) => {
                              const currentUserReacted = r.userIds.includes(user?.id || 0);
                              return (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => toggleReaction(m, r.emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${currentUserReacted ? 'bg-primary/10 border-primary/30' : 'bg-muted border-transparent hover:bg-muted/80'}`}
                                  title={r.userIds.map((id) => {
                                    const reactor = m.reactions?.find((rx) => rx.user_id === id && rx.emoji === r.emoji)?.user;
                                    return reactor ? profileName(reactor) : `User ${id}`;
                                  }).join(', ')}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="font-medium">{r.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <div className="relative">
                          <button type="button" onClick={() => setActiveEmojiMessage(activeEmojiMessage === m.id ? null : m.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="Add reaction">
                            <Smile className="h-4 w-4" />
                          </button>
                          {activeEmojiMessage === m.id && (
                            <div className="absolute right-0 bottom-8 z-10 p-2 rounded-lg nm-raised border shadow-lg flex gap-1 bg-background">
                              {QUICK_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(m, emoji)}
                                  className="text-lg hover:scale-110 transition-transform p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {m.user_id === user?.id && (
                          <button type="button" onClick={() => remove.mutate(m.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="text-center text-sm text-muted-foreground py-12">Select a channel or direct message to start chatting.</div>
              )}
              <div ref={bottomRef} />
            </CardContent>
            {conversation && (
              <CardContent className="border-t pt-3 pb-4">
                <div className="flex gap-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} className="flex-1" />
                  <Button onClick={handleSend} disabled={send.isPending || !draft.trim()}>Send</Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
