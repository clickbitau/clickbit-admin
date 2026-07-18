'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bug, ArrowLeft, Plus, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createBugReport, fetchBugReportRepos } from '@/lib/api';
import type { BugReportCategory, BugReportPriority } from '@/types/bug-reports';

const categories: BugReportCategory[] = ['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'];
const priorities: BugReportPriority[] = ['low', 'medium', 'high', 'critical'];

export default function NewBugReportPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReportCategory>('other');
  const [priority, setPriority] = useState<BugReportPriority>('medium');
  const [errorMessage, setErrorMessage] = useState('');
  const [targetRepo, setTargetRepo] = useState('');
  const [customRepo, setCustomRepo] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);

  const reposQuery = useQuery({
    queryKey: ['bug-report-repos', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBugReportRepos(token);
    },
    enabled: !!token,
  });

  const repos = reposQuery.data?.data ?? [];
  const selectedRepo = targetRepo === 'custom' ? customRepo : targetRepo;
  const isAdminOrManager = ['admin', 'manager'].includes(String(user?.role).toLowerCase());

  const mutation = useMutation({
    mutationFn: () =>
      createBugReport(token!, {
        title,
        description,
        category,
        priority,
        error_message: errorMessage || undefined,
        target_repo: selectedRepo || undefined,
        require_approval: isAdminOrManager ? requireApproval : undefined,
      }),
    onSuccess: (res) => {
      toast.success('Bug report created');
      router.push(`/admin/bug-reports/${res.data.id}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create bug report'),
  });

  const valid = title.trim() && description.trim();

  return (
    <PageShell
      title="New Bug Report"
      icon={Bug}
      description="Manually file a bug report and route it to the right repository"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/bug-reports"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the bug" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Steps to reproduce, expected vs actual behaviour, impact..." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="repo">Target repository</Label>
          {reposQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading repos...</div>
          ) : repos.length > 0 ? (
            <>
              <Select value={targetRepo} onValueChange={(v) => { setTargetRepo(v); if (v !== 'custom') setCustomRepo(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      <span className="font-medium">{repo.name}</span>
                      {repo.description && <span className="ml-2 text-xs text-muted-foreground">{repo.description}</span>}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Other (enter manually) <ChevronDown className="ml-1 h-3 w-3 inline" /></SelectItem>
                </SelectContent>
              </Select>
              {targetRepo === 'custom' && (
                <Input value={customRepo} onChange={(e) => setCustomRepo(e.target.value)} placeholder="owner/repo" className="mt-2" />
              )}
            </>
          ) : (
            <Input value={customRepo} onChange={(e) => { setTargetRepo('custom'); setCustomRepo(e.target.value); }} placeholder="owner/repo" />
          )}
          <p className="text-xs text-muted-foreground">Select where the fix should be implemented.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="error">Error message / logs</Label>
          <Textarea id="error" value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} rows={3} placeholder="Optional stack trace or error text" />
        </div>

        {isAdminOrManager && (
          <div className="flex items-center gap-2">
            <input
              id="require-approval"
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="require-approval" className="font-normal">Require approval before Devin starts fixing</Label>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link href="/admin/bug-reports">Cancel</Link></Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
