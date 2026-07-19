'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createEmployeeItSupportTicket } from '@/lib/api';
import { Headset } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeItSupportPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const mutation = useMutation({
    mutationFn: () => createEmployeeItSupportTicket(token!, { subject, description, priority }),
    onSuccess: () => {
      toast.success('IT support ticket submitted');
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
      setSubject('');
      setDescription('');
      setPriority('medium');
      router.push('/employee/dashboard');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit ticket'),
  });

  const canSubmit = subject.trim() && description.trim() && token;

  return (
    <PageShell title="IT Support" icon={Headset} description="Submit an internal IT support request.">
      <Card className="nm-raised max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">New IT Support Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Laptop not working" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" rows={6} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push('/employee/dashboard')}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
