import { createClient, SupabaseClient } from '@supabase/supabase-js';

type AnySchemaClient = SupabaseClient<any, any, any>;

let publicClient: AnySchemaClient | null = null;
const schemaClients: Record<string, AnySchemaClient> = {};

export function getSupabaseClient(schema?: string): AnySchemaClient {
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!url || !anonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env file.',
    );
  }

  if (!schema) {
    if (publicClient) return publicClient;
    publicClient = createClient(url, anonKey);
    return publicClient;
  }

  if (schemaClients[schema]) return schemaClients[schema];

  schemaClients[schema] = createClient(url, anonKey, {
    db: { schema },
  });
  return schemaClients[schema];
}
