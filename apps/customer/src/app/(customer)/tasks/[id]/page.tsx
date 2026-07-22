'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { PriorityBadge } from '@/components/design-system/PriorityBadge';
import { fetchCustomerTask, createCustomerTaskComment } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ListTodo, ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerTaskDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-task', id, token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const res = await fetchCustomerTask(token, id);
      return res.data || res;
    },
    enabled: !!token && !!id,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => createCustomerTaskComment(token!, id, content),
    onSuccess: () => {
      toast.success('Comment posted');
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['customer-task', id] });
    },
    onError: () => toast.error('Failed to post comment'),
  });

  const task = data;

  if (isLoading) {
    return (
      <PageShell title="Task" icon={ListTodo}>
        <Skeleton className="h-48 rounded-2xl" />
      </PageShell>
    );
  }

  if (!task) {
    return (
      <PageShell title="Task" icon={ListTodo}>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </PageShell>
    );
  }

  const comments = (task.task_comments ?? []).slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <PageShell
      title={task.title}
      icon={ListTodo}
      description={`Task #${task.id}`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground whitespace-pre-line">{task.description || 'No description.'}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between"><span className="text-muted-foreground">Project</span> <span>{task.crm_projects?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start</span> <span>{formatDate(task.start_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due</span> <span>{formatDate(task.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Completed</span> <span>{formatDate(task.completed_at)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated</span> <span>{task.estimated_hours ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Actual</span> <span>{task.actual_hours ?? '-'}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(() => {
              const assignee = (task as any).profiles_project_tasks_assigned_toToprofiles;
              const name = assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() || assignee.email : `User ${task.assigned_to ?? '-'}`;
              return <div className="flex justify-between"><span className="text-muted-foreground">Assignee</span> <span>{name}</span></div>;
            })()}
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span> <span>{formatDate(task.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Updated</span> <span>{formatDate(task.updated_at)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length > 0 ? (
            <ul className="space-y-4">
              {comments.map((comment: any) => {
                const author = comment.profiles;
                const name = author ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email : 'Unknown';
                return (
                  <li key={comment.id} className="flex gap-3">
                    <PersonAvatar name={name} avatar_url={author?.avatar} size="sm" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-line">{comment.content}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No comments yet.</p>
          )}

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => commentMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || commentMutation.isPending}
                size="sm"
              >
                <Send className="mr-1 h-4 w-4" /> Post Comment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
