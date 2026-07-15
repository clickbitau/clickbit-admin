'use client';

import { useEffect } from 'react';
import { supabase } from './supabase';

export function useRealtimeRefresh(
  channelName: string,
  tables: string[],
  onChange: () => void,
) {
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public' },
        (payload: { table?: string }) => {
          if (payload.table && tables.includes(payload.table)) {
            onChange();
          }
        },
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [channelName, tables, onChange]);
}
