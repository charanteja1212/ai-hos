"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { SessionUser } from "@/types/auth"

interface BranchContextValue {
  activeTenantId: string
  activeBranchName: string
  clientId: string
  clientName: string
  setActiveBranch: (tenantId: string, name: string) => void
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [activeTenantId, setActiveTenantId] = useState(user.tenantId)
  const [activeBranchName, setActiveBranchName] = useState(user.hospitalName || "")

  // Cache of validated tenant IDs for this client
  const validatedBranches = useRef<Set<string>>(new Set())

  // Restore persisted branch for CLIENT_ADMIN / SUPER_ADMIN
  useEffect(() => {
    if (user.role === "CLIENT_ADMIN" || user.role === "SUPER_ADMIN") {
      try {
        const key = `active_branch_${user.clientId || "platform"}`
        const saved = localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.tenantId) {
            // For CLIENT_ADMIN, validate ownership before restoring
            if (user.role === "CLIENT_ADMIN" && user.clientId) {
              const supabase = createBrowserClient()
              supabase
                .from("tenants")
                .select("tenant_id")
                .eq("tenant_id", parsed.tenantId)
                .eq("client_id", user.clientId)
                .single()
                .then(({ data }) => {
                  if (data) {
                    validatedBranches.current.add(parsed.tenantId)
                    setActiveTenantId(parsed.tenantId)
                    setActiveBranchName(parsed.name || "")
                  }
                  // If not found, stays on default (session tenantId)
                })
            } else {
              // SUPER_ADMIN: no restriction
              setActiveTenantId(parsed.tenantId)
              setActiveBranchName(parsed.name || "")
            }
          }
        }
      } catch (err) {
        console.error("[branch-provider] Failed to restore persisted branch:", err)
      }
    }
  }, [user.role, user.clientId])

  const setActiveBranch = useCallback(async (tenantId: string, name: string) => {
    // For CLIENT_ADMIN, validate that the branch belongs to their client
    if (user.role === "CLIENT_ADMIN" && user.clientId && !validatedBranches.current.has(tenantId)) {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("tenants")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .eq("client_id", user.clientId)
        .single()

      if (!data) return // Reject unauthorized branch switch

      validatedBranches.current.add(tenantId)
    }

    setActiveTenantId(tenantId)
    setActiveBranchName(name)
    try {
      const key = `active_branch_${user.clientId || "platform"}`
      localStorage.setItem(key, JSON.stringify({ tenantId, name }))
    } catch (err) {
      console.error("[branch-provider] Failed to persist branch selection:", err)
    }
  }, [user.clientId, user.role])

  return (
    <BranchContext.Provider
      value={{
        activeTenantId,
        activeBranchName,
        clientId: user.clientId || "",
        clientName: user.clientName || "",
        setActiveBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext)
  if (!ctx) {
    // Fallback for pages not wrapped in BranchProvider (e.g., platform pages)
    return {
      activeTenantId: "",
      activeBranchName: "",
      clientId: "",
      clientName: "",
      setActiveBranch: () => {},
    }
  }
  return ctx
}
