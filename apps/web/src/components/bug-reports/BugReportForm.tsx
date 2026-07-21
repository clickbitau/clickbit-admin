'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createBugReport, fetchBugReportRepos } from '@/lib/api';
import { Bug, Loader2, Plus, ChevronDown } from 'lucide-react';
import type { BugReportCategory, BugReportPriority } from '@/types/bug-reports';

const categories: BugReportCategory[] = ['invoice', 'dashboard', 'login', 'crm', 'hr', 'payments', 'other', 'mobile', 'deploy'];
const priorities: BugReportPriority[] = ['low', 'medium', 'high', 'critical'];

interface BugReportFormProps {
  token: string;
  user?: any;
  onSuccess?: (report: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function BugReportForm({ token, user, onSuccess, onCancel, initial }: BugReportFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState<BugReportCategory>(initial?.category || 'other');
  const [priority, setPriority] = useState<BugReportPriority>(initial?.priority || 'medium');
  const [errorMessage, setErrorMessage] = useState(initial?.error_message || '');
  const [targetRepo, setTargetRepo] = useState(initial?.target_repo || '');
  const [customRepo, setCustomRepo] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);

  const reposQuery = useQuery({
    queryKey: ['bug-report-repos', token],
    queryFn: () => fetchBugReportRepos(token),
    enabled: !!token,
  });

  const repos = reposQuery.data?.data ?? [];
  const selectedRepo = targetRepo === 'custom' ? customRepo : targetRepo;
  const isAdminOrManager = ['admin', 'manager'].includes(String(user?.role).toLowerCase());

  const mutation = useMutation({
    mutationFn: () =>
      createBugReport(token, {
        title,
        description,
        category,
        priority,
        error_message: errorMessage || undefined,
        target_repo: selectedRepo || undefined,
        require_approval: isAdminOrManager ? requireApproval : undefined,
      }),
    onSuccess: (res: any) => {
      toast.success('Bug report created');
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      onSuccess?.(res?.data);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create bug report'),
  });

  const valid = title.trim() && description.trim();

  return (
    <div className="space-y-5 max-w-3xl">
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
                {repos.map((repo: any) => (
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
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          Create
        </Button>
      </div>
    </div>
  );
}
