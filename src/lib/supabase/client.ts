import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _anonClient: SupabaseClient | null = null
let _authClient: SupabaseClient | null = null
let _currentToken: string | null = null

/**
 * Set the Supabase JWT token for authenticated access.
 * Called from useSupabaseToken hook when session is available.
 */
export function setSupabaseToken(token: string | null) {
  if (token === _currentToken) return
  _currentToken = token
  _authClient = null // force re-creation with new token
}

/**
 * Create a browser Supabase client.
 * If a JWT token has been set via setSupabaseToken(), uses authenticated role
 * with tenant-scoped RLS. Otherwise falls back to anon key (read-only).
 */
export function createBrowserClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Prefer authenticated client when token is available
  if (_currentToken) {
    if (_authClient) return _authClient
    _authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${_currentToken}` },
      },
    })
    return _authClient
  }

  // Fallback: anon client (public pages like /wa/book, /queue, /rx)
  if (_anonClient) return _anonClient
  _anonClient = createClient(supabaseUrl, supabaseAnonKey)
  return _anonClient
}

/**
 * Create an explicitly authenticated Supabase client with a specific token.
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
