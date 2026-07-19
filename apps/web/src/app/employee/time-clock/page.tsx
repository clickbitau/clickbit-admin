'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/design-system/DataTable';
import { Pagination } from '@/components/design-system/Pagination';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { fetchTimeClockStatus, clockIn, clockOut, startBreak, endBreak, fetchEmployeeMe, fetchTimesheets } from '@/lib/api';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { Clock, Play, Square, Coffee, Utensils } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeTimeClockPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const meQuery = useQuery({
    queryKey: ['employee-me', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchEmployeeMe(token);
    },
    enabled: !!token,
  });

  const statusQuery = useQuery({
    queryKey: ['time-clock-status', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockStatus(token);
    },
    enabled: !!token,
  });

  const timesheetsQuery = useQuery({
    queryKey: ['employee-timesheets', token, page],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimesheets(token, { page, limit: 10 });
    },
    enabled: !!token,
  });

  const clockInMutation = useMutation({
    mutationFn: () => clockIn(token!),
    onSuccess: () => {
      toast.success('Clocked in');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['employee-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Clock in failed'),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => clockOut(token!),
    onSuccess: () => {
      toast.success('Clocked out');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['employee-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Clock out failed'),
  });

  const startBreakMutation = useMutation({
    mutationFn: (breakType?: string) => startBreak(token!, breakType),
    onSuccess: () => {
      toast.success('Break started');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Start break failed'),
  });

  const endBreakMutation = useMutation({
    mutationFn: () => endBreak(token!),
    onSuccess: () => {
      toast.success('Break ended');
      queryClient.invalidateQueries({ queryKey: ['time-clock-status'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'End break failed'),
  });

  const status = statusQuery.data?.data;
  const isClockedIn = !!status?.clockedIn;
  const isOnBreak = !!status?.isOnBreak;

  if (statusQuery.isLoading || meQuery.isLoading) {
    return (
      <PageShell title="Time Clock" icon={Clock}>
        <Skeleton className="h-40 rounded-2xl" />
      </PageShell>
    );
  }

  return (
    <PageShell title="Time Clock" icon={Clock} description="Clock in/out and view your recent entries.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="nm-raised lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isClockedIn ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                <Clock className="h-10 w-10" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{isClockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out'}</p>
                {isClockedIn && status?.activeEntry?.clock_in_time && (
                  <p className="text-sm text-muted-foreground">Since {formatDateTime(status.activeEntry.clock_in_time)}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {!isClockedIn ? (
                  <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
                    <Play className="mr-1 h-4 w-4" /> Clock In
                  </Button>
                ) : (
                  <>
                    {isOnBreak ? (
                      <Button onClick={() => endBreakMutation.mutate()} disabled={endBreakMutation.isPending}>
                        <Coffee className="mr-1 h-4 w-4" /> End Break
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending} variant="default">
                          <Square className="mr-1 h-4 w-4" /> Clock Out
                        </Button>
                        <Button variant="outline" onClick={() => startBreakMutation.mutate('lunch')} disabled={startBreakMutation.isPending}>
                          <Utensils className="mr-1 h-4 w-4" /> Start Break
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Time</span> <span>{formatDuration((status?.todaySummary?.totalMinutes || 0) * 60)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Breaks</span> <span>{formatDuration((status?.todaySummary?.breakMinutes || 0) * 60)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Entries</span> <span>{status?.todaySummary?.entriesCount ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="nm-raised">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'clock_in', label: 'Clock In' },
              { key: 'clock_out', label: 'Clock Out' },
              { key: 'duration', label: 'Duration' },
              { key: 'status', label: 'Status' },
            ]}
            data={timesheetsQuery.data?.data ?? []}
            keyExtractor={(e) => e.id}
            loading={timesheetsQuery.isLoading}
            emptyText="No time entries found."
            renderRow={(e: any) => [
              <span key="date">{formatDate(e.clock_in_time)}</span>,
              <span key="clock_in">{formatDateTime(e.clock_in_time)}</span>,
              <span key="clock_out">{e.clock_out_time ? formatDateTime(e.clock_out_time) : '-'}</span>,
              <span key="duration">{e.total_minutes ? formatDuration(Number(e.total_minutes) * 60) : '-'}</span>,
              <StatusBadge key="status" status={e.status} />,
            ]}
          />
          {timesheetsQuery.data?.pagination && (
            <Pagination
              currentPage={page}
              totalPages={timesheetsQuery.data.pagination.pages}
              totalItems={timesheetsQuery.data.pagination.total}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
