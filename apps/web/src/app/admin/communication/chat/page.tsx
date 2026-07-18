'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare as MessageSquareIcon,
  Plus,
  Hash,
  Send,
  Trash2,
  Edit2,
  Smile,
  X,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchWorkspaces,
  createWorkspace,
  fetchChannels,
  createChannel,
  fetchDirectMessages,
  fetchMessagesForChannel,
  fetchMessagesForDm,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} from '@/lib/api';
import type { Channel, DirectMessage, DirectMessageParticipant, Message, Reaction, Workspace } from '@/types/communication';
import type { ChatProfile } from '@clickbit/shared';
import { toast } from 'sonner';

type Conversation =
  | { kind: 'channel'; id: number; name: string; description?: string | null }
  | { kind: 'dm'; id: number; name: string; avatar?: string | null };

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function participantName(p?: DirectMessageParticipant | null) {
  if (!p) return 'Unknown';
  const profile = p.user;
  if (profile) {
    const full = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    return full || profile.email || `User ${profile.id}`;
  }
  return `User ${p.user_id}`;
}

function getDmName(dm: DirectMessage, currentUserId?: number) {
  if (dm.name) return dm.name;
  const others = (dm.participants || []).filter((p) => p.user_id !== currentUserId);
  if (dm.type === 'group' || others.length > 1) {
    if (others.length === 0) return `Group ${dm.id}`;
    const names = others.map(participantName);
    return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
  }
  return participantName(others[0]) || `DM ${dm.id}`;
}

function formatMessageTime(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 24) {
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-AU');
}

function Avatar({ src, fallback, className = 'w-8 h-8' }: { src?: string | null; fallback?: string; className?: string }) {
  return (
    <div className={`rounded-full nm-raised-sm flex items-center justify-center overflow-hidden bg-muted text-xs font-semibold ${className}`}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span>{getInitials(fallback)}</span>}
    </div>
  );
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤔', '👏', '🔥', '😮'];

function aggregateReactions(reactions?: Reaction[]) {
  const map = new Map<string, { emoji: string; count: number; userIds: number[]; reactors: string[] }>();
  (reactions || []).forEach((r) => {
    const entry = map.get(r.emoji) || { emoji: r.emoji, count: 0, userIds: [], reactors: [] };
    entry.count += 1;
    if (r.user_id) entry.userIds.push(r.user_id);
    const name = r.user ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() || r.user.email : `User ${r.user_id}`;
    if (name) entry.reactors.push(name);
    map.set(r.emoji, entry);
  });
  return Array.from(map.values());
}

export default function AdminCommunicationChatPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', category: '', description: '' });
  const [activeEmojiMessage, setActiveEmojiMessage] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const workspaceQuery = searchParams.get('workspace');
  const channelQuery = searchParams.get('channel');
  const dmQuery = searchParams.get('dm');

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery({
    queryKey: ['workspaces', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchWorkspaces(token); },
    enabled: !!token,
  });

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

  const sortedWorkspaces = useMemo(() => (workspaces?.data || []) as Workspace[], [workspaces]);
  const allChannels = useMemo(() => (channels?.data || []) as Channel[], [channels]);
  const allDms = useMemo(() => (dms?.data || []) as DirectMessage[], [dms]);

  useEffect(() => {
    if (!sortedWorkspaces.length) return;
    const wsId = workspaceQuery ? Number(workspaceQuery) : sortedWorkspaces[0]?.id;
    if (wsId) setSelectedWorkspace(wsId);
  }, [sortedWorkspaces, workspaceQuery]);

  useEffect(() => {
    if (channelQuery && allChannels.length) {
      const c = allChannels.find((ch) => String(ch.id) === channelQuery);
      if (c) setConversation({ kind: 'channel', id: c.id, name: c.name, description: c.description });
    } else if (dmQuery && allDms.length) {
      const d = allDms.find((dm) => String(dm.id) === dmQuery);
      if (d) setConversation({ kind: 'dm', id: d.id, name: getDmName(d, user?.id), avatar: d.avatar_url });
    }
  }, [channelQuery, dmQuery, allChannels, allDms, user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useMutation({
    mutationFn: () => {
      if (!token || !conversation) throw new Error('No conversation');
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

  const edit = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => {
      if (!token) throw new Error('No token');
      return editMessage(token, id, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] });
      setEditingId(null);
      setEditText('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error('No token');
      return deleteMessage(token, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] }),
  });

  const createWs = useMutation({
    mutationFn: () => { if (!token) throw new Error('No token'); return createWorkspace(token, { name: newWorkspaceName }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workspaces'] }); setNewWorkspaceName(''); setShowCreateWorkspace(false); toast.success('Workspace created'); },
  });

  const createCh = useMutation({
    mutationFn: () => {
      if (!token || !selectedWorkspace) throw new Error('No workspace');
      return createChannel(token, { workspace_id: selectedWorkspace, name: newChannel.name, type: 'text', category: newChannel.category || undefined, description: newChannel.description || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', token, selectedWorkspace] });
      setNewChannel({ name: '', category: '', description: '' });
      setShowCreateChannel(false);
      toast.success('Channel created');
    },
  });

  const groupedChannels = useMemo(() => {
    const cats = Array.from(new Set(allChannels.map((c) => c.category || 'General'))).sort();
    return cats.map((category) => ({ category, channels: allChannels.filter((c) => (c.category || 'General') === category).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) }));
  }, [allChannels]);

  const handleReaction = (message: Message, emoji: string) => {
    if (!token) return;
    const existing = message.reactions?.find((r) => r.emoji === emoji && r.user_id === user?.id);
    const promise = existing
      ? removeReaction(token, message.id, emoji)
      : addReaction(token, message.id, emoji);
    promise.then(() => queryClient.invalidateQueries({ queryKey: ['messages', token, conversation?.kind, conversation?.id] }));
  };

  const selectedWorkspaceName = useMemo(() => sortedWorkspaces.find((w) => w.id === selectedWorkspace)?.name || 'Workspace', [sortedWorkspaces, selectedWorkspace]);

  const onSelectChannel = (c: Channel) => {
    setConversation({ kind: 'channel', id: c.id, name: c.name, description: c.description });
    router.replace(`/admin/communication/chat?channel=${c.id}`);
  };

  const onSelectDm = (d: DirectMessage) => {
    const name = getDmName(d, user?.id);
    setConversation({ kind: 'dm', id: d.id, name, avatar: d.avatar_url });
    router.replace(`/admin/communication/chat?dm=${d.id}`);
  };

  const isOwn = (m: Message) => m.user_id === user?.id;

  return (
    <PageShell
      title="Chat"
      icon={MessageSquareIcon}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="hidden sm:inline-flex"><Link href="/admin/communication/chat/new"><Plus className="mr-1 h-4 w-4" /> New</Link></Button>
        </div>
      }
    >
      <div className="rounded-2xl overflow-hidden nm-raised h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] -m-4 sm:-m-6">
        <div className="grid grid-cols-1 md:grid-cols-[72px_260px_1fr] h-full gap-0">
          {/* Workspace rail */}
          <div className="hidden md:flex flex-col items-center py-4 space-y-3 bg-muted/30 border-r border-border/50 overflow-y-auto">
            {loadingWorkspaces ? <Skeleton className="w-10 h-10 rounded-xl" /> : sortedWorkspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkspace(w.id)}
                title={w.name}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${selectedWorkspace === w.id ? 'nm-inset-sm bg-primary text-primary-foreground' : 'nm-raised-sm hover:nm-raised'}`}
              >
                {w.icon_url ? <img src={w.icon_url} alt={w.name} className="w-full h-full object-cover rounded-xl" /> : <span className="text-sm font-bold">{getInitials(w.name)}</span>}
              </button>
            ))}
            <button onClick={() => setShowCreateWorkspace(true)} className="w-11 h-11 rounded-xl nm-raised-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-all" title="Create workspace"><Plus className="h-5 w-5" /></button>
            {showCreateWorkspace && (
              <div className="px-2 w-full">
                <Input value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} placeholder="Name" className="h-8 text-xs" />
                <div className="flex gap-1 mt-1">
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => newWorkspaceName.trim() && createWs.mutate()}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowCreateWorkspace(false)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Channel / DM sidebar */}
          <div className="hidden md:flex flex-col border-r border-border/50 bg-background/50 min-h-0">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <h2 className="font-semibold truncate">{selectedWorkspaceName}</h2>
              <button onClick={() => setShowCreateChannel(!showCreateChannel)} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-all" title="Create channel"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {showCreateChannel && (
                <div className="nm-inset-sm rounded-xl p-3 space-y-2">
                  <Input value={newChannel.name} onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="Channel name" className="h-8 text-sm" />
                  <Input value={newChannel.category} onChange={(e) => setNewChannel({ ...newChannel, category: e.target.value })} placeholder="Category" className="h-8 text-sm" />
                  <Input value={newChannel.description} onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })} placeholder="Description" className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7" onClick={() => newChannel.name.trim() && createCh.mutate()}>Create</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowCreateChannel(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div>
                <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Channels</div>
                {groupedChannels.map((group) => (
                  <div key={group.category}>
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground/70">{group.category}</div>
                    {group.channels.map((c) => {
                      const active = conversation?.kind === 'channel' && conversation.id === c.id;
                      return (
                        <button key={c.id} onClick={() => onSelectChannel(c)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${active ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}>
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" /> {c.name}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {!allChannels.length && <div className="px-2 text-xs text-muted-foreground">No channels.</div>}
              </div>

              <div>
                <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                  Direct messages
                  <Link href="/admin/communication/chat/new?tab=dm" className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></Link>
                </div>
                {allDms.map((d) => {
                  const name = getDmName(d, user?.id);
                  const isGroup = d.type === 'group' || (d.participants || []).filter((p) => p.user_id !== user?.id).length > 1;
                  const other = (d.participants || []).find((p) => p.user_id !== user?.id);
                  const active = conversation?.kind === 'dm' && conversation.id === d.id;
                  return (
                    <button key={d.id} onClick={() => onSelectDm(d)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all ${active ? 'nm-inset-sm font-medium' : 'hover:nm-raised-sm'}`}>
                      {isGroup ? (
                        <div className="w-5 h-5 rounded-full nm-raised-sm flex items-center justify-center text-[10px]"><Users className="h-3 w-3" /></div>
                      ) : (
                        <Avatar src={d.avatar_url || other?.user?.avatar} fallback={name} className="w-5 h-5 text-[10px]" />
                      )}
                      <span className="truncate">{name}</span>
                    </button>
                  );
                })}
                {!allDms.length && <div className="px-2 text-xs text-muted-foreground">No direct messages.</div>}
              </div>
            </div>
          </div>

          {/* Mobile conversation selector */}
          <div className="md:hidden p-3 border-b border-border/50 bg-background/50 space-y-2">
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={conversation ? `${conversation.kind}-${conversation.id}` : ''} onChange={(e) => {
              const [kind, id] = e.target.value.split('-');
              if (kind === 'channel') { const c = allChannels.find((ch) => String(ch.id) === id); if (c) onSelectChannel(c); }
              else if (kind === 'dm') { const d = allDms.find((dm) => String(dm.id) === id); if (d) onSelectDm(d); }
            }}>
              <option value="">Select a conversation</option>
              {sortedWorkspaces.map((w) => <optgroup key={w.id} label={w.name}>
                {allChannels.filter((c) => c.workspace_id === w.id).map((c) => <option key={`channel-${c.id}`} value={`channel-${c.id}`}># {c.name}</option>)}
              </optgroup>)}
              {allDms.map((d) => {
                const name = getDmName(d, user?.id);
                return <option key={`dm-${d.id}`} value={`dm-${d.id}`}>{name}</option>;
              })}
            </select>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1"><Link href="/admin/communication/chat/new"><Plus className="mr-1 h-4 w-4" /> New</Link></Button>
            </div>
          </div>

          {/* Message pane */}
          <div className="flex flex-col min-h-0 bg-background">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2 bg-muted/20">
              {conversation ? (
                <>
                  {conversation.kind === 'channel' ? <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" /> : <Avatar src={(conversation as any).avatar} fallback={conversation.name} className="w-6 h-6 text-[10px]" />}
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{conversation.name}</h2>
                    {conversation.kind === 'channel' && conversation.description && <p className="text-xs text-muted-foreground truncate">{conversation.description}</p>}
                  </div>
                </>
              ) : <h2 className="font-semibold text-muted-foreground">Select a conversation</h2>}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? <Skeleton className="h-8 w-3/4" /> : (messages?.messages || []).map((m: Message, idx: number, arr: Message[]) => {
                const showAvatar = idx === 0 || arr[idx - 1].user_id !== m.user_id;
                const isMe = isOwn(m);
                const authorName = m.author ? `${m.author.first_name || ''} ${m.author.last_name || ''}`.trim() || m.author.email || `User ${m.user_id}` : `User ${m.user_id}`;
                const groupedReactions = aggregateReactions(m.reactions);
                return (
                  <div key={m.id} className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {showAvatar ? <Avatar src={m.author?.avatar} fallback={authorName} className="w-9 h-9 text-xs flex-shrink-0" /> : <div className="w-9 flex-shrink-0" />}
                    <div className={`max-w-[80%] min-w-0 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {showAvatar && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{authorName}</span>
                          <span className="text-xs text-muted-foreground">{formatMessageTime(m.created_at)}</span>
                          {m.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
                        </div>
                      )}
                      <div className={`relative px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'nm-inset-sm rounded-tl-none'}`}>
                        {editingId === m.id ? (
                          <div className="space-y-2">
                            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[60px] text-foreground bg-background" />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => edit.mutate({ id: m.id, content: editText })}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditText(''); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        )}
                      </div>
                      {groupedReactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {groupedReactions.map((r) => {
                            const reactedByMe = r.userIds.includes(user?.id || 0);
                            return (
                              <button key={r.emoji} onClick={() => handleReaction(m, r.emoji)} title={r.reactors.join(', ')} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-all ${reactedByMe ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent hover:border-primary'}`}>
                                <span>{r.emoji}</span>
                                {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {m.thread && m.thread.reply_count ? (
                        <button onClick={() => {}} className="mt-1 text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {m.thread.reply_count} {m.thread.reply_count === 1 ? 'reply' : 'replies'}
                        </button>
                      ) : null}
                      {!editingId && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <div className="relative">
                            <button onClick={() => setActiveEmojiMessage(activeEmojiMessage === m.id ? null : m.id)} className="p-1 rounded-md text-muted-foreground hover:text-foreground" title="Add reaction"><Smile className="h-3.5 w-3.5" /></button>
                            {activeEmojiMessage === m.id && (
                              <div className="absolute bottom-full left-0 mb-1 z-10 p-2 rounded-lg nm-raised border shadow-lg flex gap-1 bg-background">
                                {COMMON_EMOJIS.map((emoji) => (
                                  <button key={emoji} onClick={() => { handleReaction(m, emoji); setActiveEmojiMessage(null); }} className="text-lg hover:scale-110 transition-transform p-1">{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {isMe && (
                            <>
                              <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (window.confirm('Delete message?')) remove.mutate(m.id); }} className="p-1 rounded-md text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {conversation && (
              <div className="p-3 border-t border-border/50 bg-muted/20">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) send.mutate(); } }}
                    className="flex-1 min-h-[44px] max-h-[200px] resize-none nm-inset-sm bg-background"
                    rows={1}
                  />
                  <Button onClick={() => draft.trim() && send.mutate()} disabled={send.isPending || !draft.trim()} className="h-10 w-10 p-0 rounded-full"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
