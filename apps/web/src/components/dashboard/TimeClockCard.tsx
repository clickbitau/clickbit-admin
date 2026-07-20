'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  fetchTimeClockStatus,
} from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { Clock, Coffee, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

function getPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' am', ' AM')
    .replace(' pm', ' PM');
}

export function TimeClockCard({ token }: { token?: string | null }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['admin-time-clock-status', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const res = await fetchTimeClockStatus(token);
      return res.data;
    },
    enabled: !!token,
  });

  const activeEntry = statusData?.activeEntry;
  const onBreak = activeEntry?.isOnBreak || !!activeEntry?.breakStartTime;

  const elapsedSeconds = useMemo(() => {
    if (!activeEntry?.clockInTime) return 0;
    const start = new Date(activeEntry.clockInTime);
    const totalBreakSeconds = (activeEntry.totalBreakMinutes ?? 0) * 60;
    const raw = Math.floor((now.getTime() - start.getTime()) / 1000);
    return Math.max(0, raw - totalBreakSeconds);
  }, [activeEntry, now]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-time-clock-status', token] });
    queryClient.invalidateQueries({ queryKey: ['hr-dashboard', token] });
  };

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      let location;
      try {
        location = await getPosition();
      } catch {
        location = undefined;
      }
      return clockIn(token, { gps_lat: location?.latitude, gps_lng: location?.longitude });
    },
    onSuccess: () => {
      toast.success('Clocked in');
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Clock in failed'),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return clockOut(token);
    },
    onSuccess: () => {
      toast.success('Clocked out');
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Clock out failed'),
  });

  const breakMutation = useMutation({
    mutationFn: async (action: 'start' | 'end') => {
      if (!token) throw new Error('No token');
      return action === 'start' ? startBreak(token) : endBreak(token);
    },
    onSuccess: (_, action) => {
      toast.success(action === 'start' ? 'Break started' : 'Break ended');
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Break action failed'),
  });

  return (
    <Card className="nm-raised">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" /> Time Clock
        </CardTitle>
        <span className="text-2xl font-semibold tabular-nums">{formatTime(now)}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : activeEntry?.clockInTime ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {onBreak ? 'On Break' : 'Clocked In'}
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    · {formatTime(new Date(activeEntry.clockInTime))}
                  </span>
                </p>
                <p className="text-2xl font-semibold tabular-nums">{formatDuration(elapsedSeconds)}</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2">
              {onBreak ? (
                <Button size="sm" onClick={() => breakMutation.mutate('end')} disabled={breakMutation.isPending}>
                  <Coffee className="mr-1 h-4 w-4" /> End Break
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => breakMutation.mutate('start')} disabled={breakMutation.isPending}>
                  <Coffee className="mr-1 h-4 w-4" /> Start Break
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}>
                <Square className="mr-1 h-4 w-4" /> Clock Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">You are not clocked in</p>
              <p className="text-xs text-muted-foreground">
                {now.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <Button size="sm" onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
              <Play className="mr-1 h-4 w-4" /> Clock In
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
