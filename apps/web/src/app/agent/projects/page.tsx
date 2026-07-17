'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchAgentPortalProjects } from '@/lib/api';
import { FolderKanban, ChevronLeft, ChevronRight, Clock, DollarSign } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | Date) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU');
}

function daysUntil(value?: string | Date) {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days;
}

export default function AgentProjectsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-projects', token, page],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalProjects(token, { page, limit: 25 }); },
    enabled: !!token,
  });

  const projects = (data?.data || []) as Array<{
    id: number; name: string; status?: string; budget?: number; total_budget_spent?: number; expected_completion?: string; customer_id?: number; company_id?: number;
  }>;
  const pagination = (data?.pagination || { currentPage: 1, totalPages: 1 }) as { currentPage: number; totalPages: number };

  if (isLoading) {
    return <div className="p-4 space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderKanban className="w-7 h-7 text-orange-500" />
          Projects
        </h1>
        <p className="text-muted-foreground mt-1">Active projects for your clients</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-12 text-center text-muted-foreground">
              <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-medium mb-1">No projects found</h3>
              <p className="text-sm">Projects linked to your clients will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => {
            const spent = project.total_budget_spent || 0;
            const budget = project.budget || 0;
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const days = daysUntil(project.expected_completion);
            return (
              <Link key={project.id} href={`/agent/projects/${project.id}`} className="block group">
                <Card className="h-full hover:border-primary/50 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                      <Badge variant="outline" className="capitalize">{project.status || 'active'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-4 h-4" /> Budget</span>
                      <span className="font-medium">{formatCurrency(budget)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pct}% spent</span>
                      <span>{formatCurrency(spent)}</span>
                    </div>
                    {days !== null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {days > 0 ? `${days} days remaining` : days === 0 ? 'Due today' : `${Math.abs(days)} days overdue`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
