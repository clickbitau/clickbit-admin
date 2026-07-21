'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersonAvatar } from './PersonAvatar';
import { formatDateTime } from '@/lib/format';
import type { Activity } from '@/types/crm';
import {
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  MoreHorizontal,
} from 'lucide-react';

const METHOD_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
];

function activityIcon(type: string) {
  switch (type) {
    case 'call':
      return Phone;
    case 'email':
      return Mail;
    case 'meeting':
      return Calendar;
    case 'task':
      return CheckCircle;
    case 'note':
      return MessageSquare;
    case 'document':
      return FileText;
    case 'status_change':
      return AlertCircle;
    default:
      return MoreHorizontal;
  }
}

function activityColor(type: string) {
  switch (type) {
    case 'call':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'email':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'meeting':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'task':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'note':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'document':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'status_change':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

interface ActivityTimelineProps {
  activities?: Activity[];
  loading?: boolean;
  emptyText?: string;
  onAddNote?: (data: { method: string; subject: string; notes: string }) => void | Promise<void>;
  noteLabel?: string;
  actorName?: string;
  actorAvatarUrl?: string | null;
}

export function ActivityTimeline({
  activities = [],
  loading,
  emptyText = 'No activity recorded yet.',
  onAddNote,
  noteLabel = 'Add a note',
  actorName,
  actorAvatarUrl,
}: ActivityTimelineProps) {
  const [method, setMethod] = useState('note');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const handleSubmit = async () => {
    if (!onAddNote || !notes.trim()) return;
    await onAddNote({ method, subject: subject.trim() || 'Note', notes: notes.trim() });
    setNotes('');
    setSubject('');
    setMethod('note');
  };

  return (
    <div className="space-y-6">
      {onAddNote && (
        <div className="nm-raised-sm rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <PersonAvatar name={actorName} avatar_url={actorAvatarUrl} size="sm" />
            <div className="flex-1 text-sm font-medium">{noteLabel}</div>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write a note..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={!notes.trim()}>
              Add activity
            </Button>
          </div>
        </div>
      )}

      <div className="relative pl-4 border-l border-border/60 space-y-6">
        {loading ? (
          <div className="text-sm text-muted-foreground py-2">Loading activity...</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">{emptyText}</div>
        ) : (
          sorted.map((a) => {
            const Icon = activityIcon(a.activity_type || 'note');
            const color = activityColor(a.activity_type || 'note');
            const actor =
              a.owner?.name ||
              `${a.owner?.first_name || ''} ${a.owner?.last_name || ''}`.trim() ||
              a.contact?.name ||
              'System';
            return (
              <div key={a.id} className="relative pl-6">
                <span
                  className={`absolute -left-[21px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background ${color}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{a.subject || 'Activity'}</span>
                    <span className="text-xs text-muted-foreground">· {formatDateTime(a.created_at)}</span>
                  </div>
                  {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PersonAvatar name={actor} avatar_url={a.owner?.avatar} size="sm" />
                    <span>{actor}</span>
                    {a.status && <span className="capitalize">· {a.status}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
