"use client"

import { useMemo } from "react"
import { useSession } from "next-auth/react"
import { createBrowserClient, createAuthClient } from "@/lib/supabase/client"

/**
 * Returns an authenticated Supabase client using the session's custom JWT.
 * If no session/token is available, falls back to the default browser client.
 *
 * Usage:
 *   const supabase = useSupabase()
 *   const { data } = await supabase.from("appointments").select("*")
 *   // RLS automatically filters by tenant_id from the JWT claims
 */
export function useSupabase() {
  const { data: session } = useSession()
  const token = (session as unknown as Record<string, unknown>)?.supabaseAccessToken as
    | string
    | undefined

  return useMemo(() => {
    if (token) {
      return createAuthClient(token)
    }
    return createBrowserClient()
  }, [token])
}
