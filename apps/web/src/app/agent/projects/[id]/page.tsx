'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchAgentPortalProject } from '@/lib/api';
import { FolderKanban, DollarSign, Calendar, Clock, User } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | Date) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AgentProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['agent-project', token, id],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalProject(token, id); },
    enabled: !!token && !!id,
  });

  const project = data?.data as {
    id?: number; name?: string; status?: string; budget?: number; total_budget_spent?: number;
    expected_completion?: string; description?: string; start_date?: string; customer_id?: number;
    company_id?: number; progress?: number;
  } | undefined;

  if (isLoading) {
    return <div className="p-4 space-y-6"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }

  if (!project) {
    return <div className="p-4 text-muted-foreground">Project not found.</div>;
  }

  const spent = project.total_budget_spent || 0;
  const budget = project.budget || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : project.progress || 0;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FolderKanban className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">{project.name || `Project #${id}`}</h1>
          <Badge variant="outline" className="capitalize mt-1">{project.status || 'active'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /> Budget</div>
            <div className="text-2xl font-bold">{formatCurrency(budget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><User className="w-4 h-4" /> Spent</div>
            <div className="text-2xl font-bold">{formatCurrency(spent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="w-4 h-4" /> Progress</div>
            <div className="text-2xl font-bold">{pct}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" /> Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Start date</span><span>{formatDate(project.start_date)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Expected completion</span><span>{formatDate(project.expected_completion)}</span></div>
        </CardContent>
      </Card>

      {project.description && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{project.description}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
