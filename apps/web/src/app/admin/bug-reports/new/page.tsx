'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Bug, ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createBugReport } from '@/lib/api';
import type { BugReportCategory, BugReportPriority } from '@/types/bug-reports';

const categories: BugReportCategory[] = ['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'];
const priorities: BugReportPriority[] = ['low', 'medium', 'high', 'critical'];

export default function NewBugReportPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReportCategory>('other');
  const [priority, setPriority] = useState<BugReportPriority>('medium');
  const [errorMessage, setErrorMessage] = useState('');
  const [targetRepo, setTargetRepo] = useState('clickbitau/clickbit');

  const mutation = useMutation({
    mutationFn: () =>
      createBugReport(token!, {
        title,
        description,
        category,
        priority,
        error_message: errorMessage || undefined,
        target_repo: targetRepo || undefined,
      }),
    onSuccess: (res) => {
      toast.success('Bug report created');
      router.push(`/admin/bug-reports/${res.data.id}`);
    },
    onError: () => toast.error('Failed to create bug report'),
  });

  const valid = title.trim() && description.trim();

  return (
    <PageShell
      title="New Bug Report"
      icon={Bug}
      description="Manually file a Devin bug report"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/bug-reports"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Steps to reproduce, expected vs actual behaviour" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as BugReportCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as BugReportPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="error">Error message</Label>
          <Textarea id="error" value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} rows={3} placeholder="Optional stack trace or error text" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="repo">Target repo</Label>
          <Input id="repo" value={targetRepo} onChange={(e) => setTargetRepo(e.target.value)} placeholder="owner/repo" />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link href="/admin/bug-reports">Cancel</Link></Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}><Plus className="mr-1 h-4 w-4" /> Create</Button>
        </div>
      </div>
    </PageShell>
  );
}
