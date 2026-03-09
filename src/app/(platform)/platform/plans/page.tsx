"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CreditCard,
  Check,
  X,
  Building2,
  Users,
  GitBranch,
  Stethoscope,
  CalendarDays,
  ArrowUpCircle,
  Loader2,
} from "lucide-react"
import {
  TIER_FEATURES,
  TIER_LIMITS,
  getTierInfo,
  type Tier,
} from "@/lib/platform/features"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SessionUser } from "@/types/auth"

interface ClientWithTier {
  client_id: string
  name: string
  status: string
  tier: Tier
}

const TIER_COLORS: Record<Tier, { gradient: string }> = {
  basic: { gradient: "gradient-green" },
  medium: { gradient: "gradient-blue" },
  enterprise: { gradient: "gradient-purple" },
}

const FEATURE_LABELS: Record<string, string> = {
  whatsapp_bot: "WhatsApp Bot",
  multi_language: "Multi-Language",
  lab_module: "Lab Module",
  pharmacy_module: "Pharmacy",
  ipd_module: "IPD / Inpatient",
  multi_branch: "Multi-Branch",
  gpt4_clinical: "GPT-4 Clinical AI",
  whisper_voice_rx: "Voice Prescriptions",
  predictive_noshow: "No-Show Prediction",
  revenue_leak_detector: "Revenue Leak Detector",
  telemedicine: "Telemedicine",
  abdm_integration: "ABDM Integration",
  iot_gateway: "IoT Gateway",
  white_label: "White Label",
  ai_agents: "AI Agents",
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  trial: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
}

export default function PlansPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined

  const [clients, setClients] = useState<ClientWithTier[]>([])
  const [loading, setLoading] = useState(true)
  const [changingTier, setChangingTier] = useState<string | null>(null)

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  const fetchClients = useCallback(async () => {
    const supabase = createBrowserClient()

    const [clientsRes, configsRes] = await Promise.all([
      supabase.from("clients").select("client_id, name, status").order("name"),
      supabase.from("client_configs").select("client_id, tier"),
    ])

    const configMap = new Map<string, Tier>()
    for (const c of configsRes.data || []) {
      configMap.set(c.client_id, (c.tier as Tier) || "basic")
    }

    const merged: ClientWithTier[] = (clientsRes.data || []).map((c) => ({
      ...c,
      tier: configMap.get(c.client_id) || "basic",
    }))

    setClients(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleTierChange = async (clientId: string, newTier: Tier) => {
    setChangingTier(clientId)
    const supabase = createBrowserClient()

    const features = TIER_FEATURES[newTier]
    const limits = TIER_LIMITS[newTier]

    const { error } = await supabase.from("client_configs").upsert(
      { client_id: clientId, tier: newTier, features, limits },
      { onConflict: "client_id" }
    )

    if (error) {
      console.error("[plans] tier change error:", error.message)
      toast.error("Failed to update tier")
    } else {
      toast.success(`Tier updated to ${getTierInfo(newTier).name}`)
      setClients((prev) =>
        prev.map((c) => (c.client_id === clientId ? { ...c, tier: newTier } : c))
      )
    }
    setChangingTier(null)
  }

  const tiers: Tier[] = ["basic", "medium", "enterprise"]

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[500px] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<CreditCard className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Subscription Plans"
        subtitle="Manage client tiers and feature access"
        badge={
          <Badge variant="secondary" className="text-xs">
            {clients.length} clients
          </Badge>
        }
      />

      {/* Tier Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tiers.map((tier, idx) => {
          const info = getTierInfo(tier)
          const features = TIER_FEATURES[tier]
          const limits = TIER_LIMITS[tier]
          const colors = TIER_COLORS[tier]
          const tierClients = clients.filter((c) => c.tier === tier)

          return (
            <motion.div
              key={tier}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`relative overflow-hidden ${tier === "enterprise" ? "ring-2 ring-purple-300" : ""}`}>
                <div className={`${colors.gradient} p-5 text-white`}>
                  <h3 className="text-lg font-bold">{info.name}</h3>
                  <p className="text-sm opacity-80 mt-0.5">{info.description}</p>
                  <p className="text-2xl font-black mt-2">
                    Rs {info.price}
                    <span className="text-sm font-normal opacity-70">/month</span>
                  </p>
                </div>

                <CardContent className="p-5 space-y-5">
                  {/* Limits */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limits</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{limits.max_doctors >= 999 ? "Unlimited" : limits.max_doctors} doctors</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{limits.max_branches >= 999 ? "Unlimited" : limits.max_branches} branches</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{limits.max_staff >= 999 ? "Unlimited" : limits.max_staff} staff</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{limits.max_appointments_per_day >= 9999 ? "Unlimited" : limits.max_appointments_per_day} appts/day</span>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
                    <div className="space-y-1">
                      {Object.entries(features).map(([key, enabled]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          {enabled ? (
                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className={enabled ? "text-foreground" : "text-muted-foreground/50"}>
                            {FEATURE_LABELS[key] || key}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clients on this tier */}
                  <div className="border-t border-border/50 pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Clients ({tierClients.length})
                    </p>
                    {tierClients.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic">No clients on this plan</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {tierClients.map((c) => (
                          <div
                            key={c.client_id}
                            className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-muted/50 cursor-pointer text-xs"
                            onClick={() => router.push(`/platform/clients/${c.client_id}`)}
                          >
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{c.name}</span>
                            </div>
                            <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[c.status] || ""}`}>
                              {c.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Tier Assignment Table */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpCircle className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Manage Client Tiers</h3>
          </div>

          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No clients yet. Create one from the Clients page.
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => {
                const colors = TIER_COLORS[client.tier]
                return (
                  <div
                    key={client.client_id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${colors.gradient} flex items-center justify-center text-white text-xs font-bold`}>
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.client_id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {changingTier === client.client_id && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                      <Select
                        value={client.tier}
                        onValueChange={(v) => handleTierChange(client.client_id, v as Tier)}
                        disabled={changingTier === client.client_id}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
