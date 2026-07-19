'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createAnnouncement } from '@/lib/api';
import type { Announcement } from '@/types/hr';
import { ArrowLeft, Megaphone, Plus } from 'lucide-react';

const types = ['general', 'urgent', 'policy', 'event', 'achievement', 'training', 'safety', 'reminder'];
const priorities = ['low', 'normal', 'high', 'critical'];
const targetTypes = ['all', 'department', 'position', 'employees', 'managers'];
const statuses = ['draft', 'scheduled', 'published', 'archived'];

export default function AdminNewAnnouncementPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Announcement>>({
    type: 'general',
    priority: 'normal',
    target_type: 'all',
    status: 'published',
    send_email: false,
    send_push_notification: false,
    visible_to_customers: false,
    visible_to_agents: false,
    visible_to_guests: false,
    allow_comments: false,
    allow_reactions: false,
    require_acknowledgment: false,
    is_pinned: false,
  });

  const mutation = useMutation({
    mutationFn: () => createAnnouncement(token!, form),
    onSuccess: (data: any) => {
      toast.success('Announcement created');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      const id = data?.id || data?.data?.id;
      router.push(id ? `/admin/hr/announcements/${id}` : '/admin/hr/announcements');
    },
    onError: () => toast.error('Failed to create announcement'),
  });

  return (
    <PageShell
      title="New Announcement"
      icon={Megaphone}
      description="Publish a company-wide announcement"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/announcements"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card className="nm-raised">
        <CardHeader><CardTitle>Announcement</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Type</Label>
            <select value={form.type || 'general'} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Priority</Label>
            <select value={form.priority || 'normal'} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><Label>Target type</Label>
            <select value={form.target_type || 'all'} onChange={(e) => setForm({ ...form, target_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Status</Label>
            <select value={form.status || 'published'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Publish at</Label><Input type="datetime-local" value={form.publish_at || ''} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} /></div>
          <div><Label>Expires at</Label><Input type="datetime-local" value={form.expires_at || ''} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
          <div><Label>Acknowledgment deadline</Label><Input type="datetime-local" value={form.acknowledgment_deadline || ''} onChange={(e) => setForm({ ...form, acknowledgment_deadline: e.target.value })} /></div>
          <div className="md:col-span-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} /> Send email</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.send_push_notification} onChange={(e) => setForm({ ...form, send_push_notification: e.target.checked })} /> Push notification</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.visible_to_customers} onChange={(e) => setForm({ ...form, visible_to_customers: e.target.checked })} /> Customers</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.visible_to_agents} onChange={(e) => setForm({ ...form, visible_to_agents: e.target.checked })} /> Agents</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} /> Pinned</label>
          </div>
          <div className="md:col-span-2"><Label>Content</Label><Textarea value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => form.title && form.content && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Announcement
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
