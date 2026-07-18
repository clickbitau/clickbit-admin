'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Coffee, MapPin, Play, Square, Users } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { clockIn, clockOut, endBreak, fetchTimeClockActive, fetchTimeClockStatus, startBreak } from '@/lib/api';

function formatDuration(minutes?: number | null) {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function AdminHrTimeClockPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['time-clock-status', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockStatus(token);
    },
    enabled: !!token,
  });

  const status = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['time-clock-status', token] });
    queryClient.invalidateQueries({ queryKey: ['time-clock-active', token] });
  };

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ['time-clock-active', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchTimeClockActive(token);
    },
    enabled: !!token && isManager,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      const body: Record<string, unknown> = {};
      if (location) {
        body.latitude = String(location.latitude);
        body.longitude = String(location.longitude);
        body.address = location.address;
      }
      return clockIn(token, body);
    },
    onSuccess: refresh,
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return clockOut(token, location ? { latitude: String(location.latitude), longitude: String(location.longitude), address: location.address } : {});
    },
    onSuccess: refresh,
  });

  const breakStartMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return startBreak(token, 'general');
    },
    onSuccess: refresh,
  });

  const breakEndMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return endBreak(token);
    },
    onSuccess: refresh,
  });

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
    );
  };

  const activeCount = (activeData?.data || []).length;
  const onBreakCount = (activeData?.data || []).filter((e: any) => e.is_on_break).length;

  const statCards = [
    { label: 'Clocked In', value: status?.clockedIn ? 'Yes' : 'No', icon: Clock, accent: status?.clockedIn ? ('success' as const) : undefined },
    { label: 'On Break', value: status?.isOnBreak ? 'Yes' : 'No', icon: Coffee, accent: status?.isOnBreak ? ('warning' as const) : undefined },
    { label: 'Today Worked', value: formatDuration(status?.todaySummary?.totalMinutes), icon: Clock },
    { label: 'Breaks', value: formatDuration(status?.todaySummary?.breakMinutes), icon: Coffee },
    ...(isManager ? [{ label: 'Active Employees', value: activeCount, icon: Users, accent: activeCount ? ('primary' as const) : undefined }] : []),
    ...(isManager ? [{ label: 'On Break (team)', value: onBreakCount, icon: Coffee, accent: onBreakCount ? ('warning' as const) : undefined }] : []),
  ];

  const activeEntry = status?.activeEntry;

  return (
    <PageShell title="Time Clock" icon={Clock} description="Clock in and out, track breaks, and view today's summary.">
      <StatCards cards={statCards} />

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-destructive">Failed to load time clock status.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}

          {!isLoading && status && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={status.clockedIn ? 'default' : 'secondary'}>{status.clockedIn ? 'Clocked In' : 'Clocked Out'}</Badge>
                {status.isOnBreak && <Badge variant="outline">On Break</Badge>}
                {location && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" /> {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </Badge>
                )}
              </div>

              {activeEntry && (
                <div className="text-sm text-muted-foreground">
                  Active entry since {new Date(activeEntry.clock_in_time).toLocaleString()}
                  {activeEntry.clock_in_address ? ` — ${activeEntry.clock_in_address}` : ''}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={captureLocation} variant="outline" disabled={locating}>
                  <MapPin className="mr-2 h-4 w-4" />
                  {locating ? 'Locating...' : location ? 'Update Location' : 'Capture Location'}
                </Button>

                {!status.clockedIn ? (
                  <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
                    <Play className="mr-2 h-4 w-4" /> Clock In
                  </Button>
                ) : (
                  <Button onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending} variant="destructive">
                    <Square className="mr-2 h-4 w-4" /> Clock Out
                  </Button>
                )}

                {status.clockedIn && !status.isOnBreak && (
                  <Button onClick={() => breakStartMutation.mutate()} disabled={breakStartMutation.isPending} variant="outline">
                    <Coffee className="mr-2 h-4 w-4" /> Start Break
                  </Button>
                )}

                {status.clockedIn && status.isOnBreak && (
                  <Button onClick={() => breakEndMutation.mutate()} disabled={breakEndMutation.isPending} variant="default">
                    <Coffee className="mr-2 h-4 w-4" /> End Break
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Active Employees</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive && <Skeleton className="h-20" />}
            {!loadingActive && activeData?.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No one is currently clocked in.</p>
            )}
            {!loadingActive && activeData?.data && activeData.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeData.data.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employee_name}</TableCell>
                      <TableCell>{new Date(entry.clock_in_time).toLocaleString()}</TableCell>
                      <TableCell>{entry.formatted_duration}</TableCell>
                      <TableCell>
                        {entry.is_on_break ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">On Break</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>{entry.department}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
