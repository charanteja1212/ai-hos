"use client"

import { useState, useEffect } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GitBranch, Check } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import type { UserRole } from "@/types/auth"

interface Branch {
  tenant_id: string
  hospital_name: string
  city: string | null
  branch_code: string | null
}

interface BranchSwitcherProps {
  role: UserRole
  clientId: string
  collapsed: boolean
}

export function BranchSwitcher({ role, clientId, collapsed }: BranchSwitcherProps) {
  const { activeTenantId, setActiveBranch } = useBranch()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  // Only show for CLIENT_ADMIN and SUPER_ADMIN
  const canSwitch = role === "CLIENT_ADMIN" || role === "SUPER_ADMIN"

  useEffect(() => {
    if (!canSwitch) return
    const fetchBranches = async () => {
      const supabase = createBrowserClient()
      let query = supabase
        .from("tenants")
        .select("tenant_id, hospital_name, city, branch_code")
        .eq("status", "active")
        .order("hospital_name")

      if (role === "CLIENT_ADMIN" && clientId) {
        query = query.eq("client_id", clientId)
      }

      const { data } = await query
      setBranches(data || [])
      setLoading(false)
    }
    fetchBranches()
  }, [clientId, role, canSwitch])

  if (!canSwitch) return null
  if (loading || branches.length <= 1) return null

  const activeBranch = branches.find((b) => b.tenant_id === activeTenantId)

  const handleChange = (tenantId: string) => {
    const branch = branches.find((b) => b.tenant_id === tenantId)
    if (branch) {
      setActiveBranch(branch.tenant_id, branch.hospital_name)
    }
  }

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-b border-border/50">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center cursor-pointer mx-auto">
              <GitBranch className="w-4 h-4 text-primary" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">{activeBranch?.hospital_name || "Select Branch"}</p>
            {activeBranch?.city && (
              <p className="text-xs text-muted-foreground">{activeBranch.city}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="px-3 py-2 border-b border-border/50"
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
          Branch
        </p>
        <Select value={activeTenantId} onValueChange={handleChange}>
          <SelectTrigger className="h-9 rounded-xl bg-accent/30 border-0 text-sm gap-2 focus:ring-1 focus:ring-primary/30">
            <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.tenant_id} value={branch.tenant_id}>
                <div className="flex items-center gap-2">
                  <span className="truncate">
                    {branch.hospital_name}
                    {branch.city && (
                      <span className="text-muted-foreground"> — {branch.city}</span>
                    )}
                  </span>
                  {branch.tenant_id === activeTenantId && (
                    <Check className="w-3 h-3 text-primary shrink-0 ml-auto" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>
    </AnimatePresence>
  )
}
