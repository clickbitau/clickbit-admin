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
import { createPublicHoliday } from '@/lib/api';
import type { PublicHoliday } from '@/types/hr';
import { ArrowLeft, Calendar, Plus } from 'lucide-react';

export default function AdminNewPublicHolidayPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<PublicHoliday>>({
    is_recurring: false,
  });

  const mutation = useMutation({
    mutationFn: () => createPublicHoliday(token!, form),
    onSuccess: (data: any) => {
      toast.success('Public holiday created');
      queryClient.invalidateQueries({ queryKey: ['public-holidays'] });
      const id = data?.id || data?.data?.id;
      router.push(id ? `/admin/hr/public-holidays/${id}` : '/admin/hr/public-holidays');
    },
    onError: () => toast.error('Failed to create public holiday'),
  });

  return (
    <PageShell
      title="New Public Holiday"
      icon={Calendar}
      description="Add a public holiday to the calendar"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hr/public-holidays"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Public Holiday</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Holiday date</Label><Input type="date" value={form.holiday_date || ''} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} id="recurring" /><Label htmlFor="recurring">Recurring annually</Label></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => form.name && form.holiday_date && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Public Holiday
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
