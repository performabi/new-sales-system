// src/lib/supabaseAdmin.ts
// Service-role Supabase client — server-side only (bypasses RLS)
import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client using the SERVICE_ROLE secret.
 * Lazy-loaded so env vars are read at runtime, not at Vite config time.
 */
export function getSupabaseAdmin() {
  const supabaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    '';
  const serviceRoleKey =
    (typeof process !== 'undefined' && process.env?.SERVICE_ROLE) || '';

  if (!supabaseUrl) {
    throw new Error('Supabase URL (VITE_SUPABASE_URL) is required.');
  }
  if (!serviceRoleKey) {
    throw new Error('Supabase SERVICE_ROLE key is required.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
