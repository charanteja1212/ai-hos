"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { useFeatures } from "@/components/providers/features-context"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Users,
  Stethoscope,
  GitBranch,
  CalendarDays,
  Shield,
  Crown,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getTierInfo, TIER_FEATURES, TIER_LIMITS } from "@/lib/platform/features"
import type { TierFeatures, TierLimits, Tier } from "@/lib/platform/features"
import type { SessionUser } from "@/types/auth"

interface UsageCounts {
  doctors: number
  branches: number
  staff: number
  patients: number
  todayAppointments: number
}

const TIER_ICONS: Record<string, React.ElementType> = {
  basic: Shield,
  medium: Zap,
  enterprise: Crown,
}

const TIER_COLORS: Record<string, string> = {
  basic: "bg-green-500/10 text-green-600 border-green-200",
  medium: "bg-blue-500/10 text-blue-600 border-blue-200",
  enterprise: "bg-purple-500/10 text-purple-600 border-purple-200",
}

const FEATURE_LABELS: Record<keyof TierFeatures, string> = {
  whatsapp_bot: "WhatsApp Bot",
  multi_language: "Multi-Language",
  lab_module: "Lab Module",
  pharmacy_module: "Pharmacy Module",
  ipd_module: "Inpatient (IPD)",
  multi_branch: "Multi-Branch",
  gpt4_clinical: "GPT-4 Clinical AI",
  whisper_voice_rx: "Voice Prescription",
  predictive_noshow: "Predictive No-Show",
  revenue_leak_detector: "Revenue Leak Detector",
  telemedicine: "Telemedicine",
  abdm_integration: "ABDM Integration",
  iot_gateway: "IoT Gateway",
  white_label: "White Label",
  ai_agents: "AI Agents",
}

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId } = useBranch()
  const { tier, features, limits, loading: featuresLoading } = useFeatures()

  const [usage, setUsage] = useState<UsageCounts | null>(null)
  const [loading, setLoading] = useState(true)

  const tenantId = activeTenantId || user?.tenantId
  const clientId = user?.clientId

  useEffect(() => {
    if (!tenantId || !clientId) return
    const supabase = createBrowserClient()
    const today = new Date().toISOString().split("T")[0]

    Promise.all([
      supabase.from("doctors").select("doctor_id", { count: "exact", head: true }).eq("client_id", clientId),
      supabase.from("tenants").select("tenant_id", { count: "exact", head: true }).eq("client_id", clientId),
      supabase.from("staff").select("staff_id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "active"),
      supabase.from("patients").select("phone", { count: "exact", head: true }).eq("client_id", clientId),
      supabase.from("appointments").select("booking_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("date", today).eq("status", "confirmed"),
    ]).then(([docs, branches, staff, patients, todayAppts]) => {
      setUsage({
        doctors: docs.count || 0,
        branches: branches.count || 0,
        staff: staff.count || 0,
        patients: patients.count || 0,
        todayAppointments: todayAppts.count || 0,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [tenantId, clientId])

  if (loading || featuresLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const tierInfo = getTierInfo(tier)
  const TierIcon = TIER_ICONS[tier] || Shield
  const effectiveLimits = limits as TierLimits
  const effectiveFeatures = features as TierFeatures

  const usageItems = [
    { label: "Doctors", icon: Stethoscope, current: usage?.doctors || 0, max: effectiveLimits.max_doctors, color: "text-green-600" },
    { label: "Branches", icon: GitBranch, current: usage?.branches || 0, max: effectiveLimits.max_branches, color: "text-blue-600" },
    { label: "Staff", icon: Users, current: usage?.staff || 0, max: effectiveLimits.max_staff, color: "text-purple-600" },
    { label: "Today's Appointments", icon: CalendarDays, current: usage?.todayAppointments || 0, max: effectiveLimits.max_appointments_per_day, color: "text-amber-600" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<CreditCard className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Subscription"
        subtitle="Your plan, usage, and features"
      />

      {/* Current Plan Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={cn("border-2", TIER_COLORS[tier])}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", TIER_COLORS[tier])}>
                <TierIcon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{tierInfo.name} Plan</h2>
                  <Badge variant="secondary" className={cn("text-xs", TIER_COLORS[tier])}>Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{tierInfo.description}</p>
                <p className="text-sm font-medium mt-1">₹{tierInfo.price}/month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Usage Meters */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Usage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {usageItems.map((item, i) => {
            const pct = item.max > 0 ? Math.min(100, Math.round((item.current / item.max) * 100)) : 0
            const isNearLimit = pct >= 80
            return (
              <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <item.icon className={cn("w-4 h-4", item.color)} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <span className="text-sm font-mono">
                        {item.current}
                        <span className="text-muted-foreground"> / {item.max >= 999 ? "∞" : item.max}</span>
                      </span>
                    </div>
                    <Progress value={pct} className={cn("h-2", isNearLimit && "[&>div]:bg-amber-500")} />
                    {isNearLimit && item.max < 999 && (
                      <p className="text-[10px] text-amber-600 mt-1">Approaching limit — consider upgrading</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Features Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Features</h3>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(Object.keys(FEATURE_LABELS) as (keyof TierFeatures)[]).map((key) => {
                const enabled = effectiveFeatures[key]
                return (
                  <div key={key} className="flex items-center gap-2 py-1.5">
                    {enabled ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className={cn("text-sm", !enabled && "text-muted-foreground/50")}>
                      {FEATURE_LABELS[key]}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA for non-enterprise */}
      {tier !== "enterprise" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-dashed border-2 border-primary/20">
            <CardContent className="p-6 text-center">
              <Crown className="w-8 h-8 mx-auto text-primary/40 mb-2" />
              <h3 className="font-semibold">Need more?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to {tier === "basic" ? "Medium" : "Enterprise"} for more doctors, branches, and advanced features.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Contact your platform administrator to change plans.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
