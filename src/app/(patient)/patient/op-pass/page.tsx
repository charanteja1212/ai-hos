"use client"

import { useSession } from "next-auth/react"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  QrCode,
  CalendarDays,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"
import type { OPPass } from "@/types/database"

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  expired: { label: "Expired", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  used: { label: "Used", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: Clock },
}

function isPassActive(pass: OPPass): boolean {
  const today = new Date().toISOString().split("T")[0]
  return pass.status === "active" && pass.valid_until >= today
}

function daysRemaining(validUntil: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(validUntil)
  end.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function OPPassPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { data: passes, isLoading } = useSWR(
    phone ? `patient-op-passes-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("op_passes")
        .select("*")
        .eq("patient_phone", phone!)
        .order("valid_until", { ascending: false })
        .limit(20)

      if (error) throw error

      // Fetch hospital names
      const tenantIds = [...new Set((data || []).map((p) => p.tenant_id).filter(Boolean))]
      let hospitalNames: Record<string, string> = {}
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("tenant_id, hospital_name")
          .in("tenant_id", tenantIds)
        hospitalNames = Object.fromEntries(
          (tenants || []).map((t: { tenant_id: string; hospital_name: string }) => [t.tenant_id, t.hospital_name])
        )
      }

      return { passes: (data || []) as OPPass[], hospitalNames }
    },
    { revalidateOnFocus: true, refreshInterval: 30000 }
  )

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  const opPasses = passes?.passes || []
  const hospitalNames = passes?.hospitalNames || {}
  const activePasses = opPasses.filter(isPassActive)
  const expiredPasses = opPasses.filter((p) => !isPassActive(p))

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">OP Passes</h1>
        <p className="text-sm text-muted-foreground">
          {activePasses.length > 0
            ? `${activePasses.length} active pass${activePasses.length > 1 ? "es" : ""}`
            : "No active passes"}
        </p>
      </div>

      {opPasses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No OP passes</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              OP passes are issued when you book an appointment
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Passes */}
          {activePasses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Active</h2>
              {activePasses.map((pass, i) => (
                <OPPassCard key={pass.op_pass_id} pass={pass} index={i} hospitalName={hospitalNames[pass.tenant_id || ""]} />
              ))}
            </div>
          )}

          {/* Expired/Used Passes */}
          {expiredPasses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Past</h2>
              {expiredPasses.map((pass, i) => (
                <OPPassCard key={pass.op_pass_id} pass={pass} index={i} hospitalName={hospitalNames[pass.tenant_id || ""]} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OPPassCard({ pass, index, hospitalName }: { pass: OPPass; index: number; hospitalName?: string }) {
  const active = isPassActive(pass)
  const days = daysRemaining(pass.valid_until)
  const status = active ? statusConfig.active : (pass.status === "expired" ? statusConfig.expired : statusConfig.used)
  const StatusIcon = status?.icon || Clock

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={cn(
        "overflow-hidden transition-shadow",
        active ? "shadow-md border-green-200 dark:border-green-900/50" : "opacity-70"
      )}>
        {active && (
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
        )}
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            {/* QR Code area */}
            <div className="shrink-0">
              {pass.qr_code_url ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-white p-1 border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pass.qr_code_url}
                    alt="OP Pass QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted/50 flex items-center justify-center border">
                  <QrCode className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Pass details */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-muted-foreground">{pass.op_pass_id}</p>
                <Badge className={cn("text-[10px] shrink-0 gap-1", status?.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {status?.label}
                </Badge>
              </div>

              <p className="text-sm font-semibold">{pass.patient_name}</p>

              {hospitalName && (
                <p className="text-xs text-muted-foreground">{hospitalName}</p>
              )}

              <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {pass.valid_from} — {pass.valid_until}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {pass.reschedules_remaining} reschedules left
                </span>
              </div>

              {active && days <= 3 && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {days === 0 ? "Expires today" : `Expires in ${days} day${days > 1 ? "s" : ""}`}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
