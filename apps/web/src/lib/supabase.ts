import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

let clientPromise: Promise<SupabaseClient | null> | null = null;

async function fetchPublicConfig() {
  try {
    const { data } = await axios.get('/api/auth/config');
    return data?.data || {};
  } catch {
    return {};
  }
}

async function createSupabaseClient(): Promise<SupabaseClient | null> {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const config = await fetchPublicConfig();
    url = url || config?.supabaseUrl;
    key = key || config?.supabaseAnonKey;
  }

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = createSupabaseClient();
  }
  return clientPromise;
}
