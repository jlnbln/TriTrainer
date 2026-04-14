import { createClient } from '@supabase/supabase-js';

/**
 * Creates a bare Supabase client (no cookie auth) for querying publicly readable tables.
 * Safe to use inside `unstable_cache` callbacks where request context is unavailable.
 */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
