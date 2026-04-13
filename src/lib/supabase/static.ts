import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key, bypassing RLS.
 * Used inside `unstable_cache` callbacks where request context (cookies) is unavailable.
 * Only use for reading publicly accessible training plan data — never for user mutations.
 */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}
