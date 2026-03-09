import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _token: string | null = null
let _client: SupabaseClient | null = null

/**
 * Set the Supabase auth token globally.
 * Called by SupabaseAuthProvider when the session loads.
 * All subsequent createBrowserClient() calls will use this token.
 */
export function setSupabaseToken(token: string | null) {
  if (token === _token) return
  _token = token
  _client = null // force recreation with new token
}

/**
 * Create a browser Supabase client.
 * If a global token has been set (via setSupabaseToken), the client
 * includes it as Authorization header — enabling RLS policies.
 * Otherwise falls back to anon key (pre-auth, login pages).
 */
export function createBrowserClient(): SupabaseClient {
  if (_client) return _client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    ...(_token && {
      global: {
        headers: { Authorization: `Bearer ${_token}` },
      },
    }),
  })
  return _client
}

/**
 * Create an explicitly authenticated Supabase client.
 * Used when you have a token and want a fresh client instance.
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
