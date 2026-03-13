import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

/**
 * Kept for backwards compatibility — no-op since RLS is disabled.
 */
export function setSupabaseToken(_token: string | null) {}

/**
 * Create a browser Supabase client using the anon key.
 * RLS is disabled — tenant isolation is handled in code via tenant_id filters.
 */
export function createBrowserClient(): SupabaseClient {
  if (_client) return _client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  _client = createClient(supabaseUrl, supabaseAnonKey)
  return _client
}

/**
 * Create an explicitly authenticated Supabase client.
 */
export function createAuthClient(token: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}
