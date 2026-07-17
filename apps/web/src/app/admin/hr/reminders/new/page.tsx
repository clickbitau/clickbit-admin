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
import { createReminder } from '@/lib/api';
import type { Reminder } from '@/types/hr';
import { ArrowLeft, Bell, Plus } from 'lucide-react';

const triggerTypes = ['payment', 'project', 'regular'];
const statuses = ['initiation', 'pending', 'complete'];

export default function AdminNewReminderPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<Reminder>>({
    trigger_type: 'regular',
    status: 'pending',
    send_email: false,
  });

  const mutation = useMutation({
    mutationFn: () => createReminder(token!, form),
    onSuccess: (data: any) => {
      toast.success('Reminder created');
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      const id = data?.id || data?.data?.id;
      router.push(id ? `/admin/hr/reminders/${id}` : '/admin/hr/reminders');
    },
    onError: () => toast.error('Failed to create reminder'),
  });

  return (
    <PageShell
      title="New Reminder"
      icon={Bell}
      description="Schedule a reminder for a person or event"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/reminders"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Reminder</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div><Label>Trigger type</Label>
            <select value={form.trigger_type || 'regular'} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {triggerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Status</Label>
            <select value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Reminder date</Label><Input type="datetime-local" value={form.reminder_date || ''} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></div>
          <div><Label>Assigned to (user ID)</Label><Input type="number" value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div><Label>Reference type</Label><Input value={form.reference_type || ''} onChange={(e) => setForm({ ...form, reference_type: e.target.value })} /></div>
          <div><Label>Reference ID</Label><Input type="number" value={form.reference_id || ''} onChange={(e) => setForm({ ...form, reference_id: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} id="sendEmail" /><Label htmlFor="sendEmail">Send email</Label></div>
          <div className="md:col-span-2">
            <Button onClick={() => form.title && form.reminder_date && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Reminder
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
