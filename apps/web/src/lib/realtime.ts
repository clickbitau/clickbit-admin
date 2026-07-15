'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

interface UseRealtimeRefreshOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export function useRealtimeRefresh(
  tables: string[],
  queryKey: string[],
  options: UseRealtimeRefreshOptions = {},
) {
  const { enabled = true, debounceMs = 500 } = options;
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !supabase || tables.length === 0 || queryKey.length === 0) return;

    const channel = supabase.channel('crm-realtime');

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey });
          }, debounceMs);
        },
      );
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Realtime subscription error for tables:', tables);
      }
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase?.removeChannel(channel);
    };
  }, [enabled, tables, queryKey, debounceMs, queryClient]);
}
