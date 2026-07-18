'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchCustomerProjects } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/format';
import { FolderKanban, Calendar, Clock, CheckCircle, AlertCircle, Pause, XCircle, ArrowRight, Search } from 'lucide-react';
import { useDebounce } from '@/lib/useDebounce';

const STATUS_OPTIONS = ['all', 'not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];

function ProjectStatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'in_progress': return <Clock className="h-5 w-5 text-blue-500" />;
    case 'on_hold': return <Pause className="h-5 w-5 text-yellow-500" />;
    case 'cancelled': return <XCircle className="h-5 w-5 text-red-500" />;
    default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
  }
}

export default function CustomerProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-projects', token, status, debouncedSearch, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchCustomerProjects(token, { status, search: debouncedSearch, page, limit: 12 });
    },
    enabled: !!token,
  });

  const projects = (data?.data ?? []) as any[];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 12 };

  return (
    <PageShell title="Projects" icon={FolderKanban} description="Track your project progress">
      <div className="flex flex-wrap gap-3">
        <div className="relative sm:max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                status === s
                  ? 'nm-inset-sm text-primary'
                  : 'nm-raised-sm text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No projects found.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="nm-raised hover:nm-raised-lg transition-all cursor-pointer group"
                onClick={() => router.push(`/customer/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ProjectStatusIcon status={project.status} />
                      <CardTitle className="text-base font-medium line-clamp-1">{project.name}</CardTitle>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.project_number && <p className="text-xs text-muted-foreground">{project.project_number}</p>}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground line-clamp-2">{project.description || 'No description.'}</p>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{project.progress_percentage ?? 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, project.progress_percentage ?? 0))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Start {formatDate(project.start_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due {formatDate(project.due_date)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="font-medium">{project.budget ? formatCurrency(project.budget, project.currency || 'AUD') : '-'}</span>
                    <span className="text-primary flex items-center text-xs group-hover:underline">View <ArrowRight className="ml-1 h-3 w-3" /></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)
            </p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
