"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Shield,
  Save,
  Loader2,
  Building2,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Server,
  FileJson2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"
import { SectionHeader } from "@/components/shared/section-header"
import { FeatureGate } from "@/components/shared/feature-gate"

export default function AbdmSettingsPage() {
  return (
    <FeatureGate feature="abdm_integration" featureName="ABDM / ABHA Integration">
      <AbdmSettingsContent />
    </FeatureGate>
  )
}

function AbdmSettingsContent() {
  const { activeTenantId: tenantId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ABDM config
  const [abdmEnabled, setAbdmEnabled] = useState(false)
  const [facilityId, setFacilityId] = useState("")
  const [hipId, setHipId] = useState("")
  const [hiuId, setHiuId] = useState("")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox")

  // Stats
  const [stats, setStats] = useState({ linkedPatients: 0, totalConsents: 0, healthRecords: 0 })

  // Original values for change detection
  const [original, setOriginal] = useState<{
    abdmEnabled: boolean; facilityId: string; hipId: string; hiuId: string; clientId: string; clientSecret: string; environment: "sandbox" | "production"
  }>({
    abdmEnabled: false, facilityId: "", hipId: "", hiuId: "", clientId: "", clientSecret: "", environment: "sandbox"
  })

  useEffect(() => {
    if (!tenantId) return
    const supabase = createBrowserClient()

    // Load tenant ABDM config
    supabase
      .from("tenants")
      .select("abdm_enabled, abdm_facility_id, abdm_hip_id, abdm_hiu_id, abdm_client_id, abdm_client_secret, abdm_environment")
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        if (data) {
          const vals = {
            abdmEnabled: data.abdm_enabled || false,
            facilityId: data.abdm_facility_id || "",
            hipId: data.abdm_hip_id || "",
            hiuId: data.abdm_hiu_id || "",
            clientId: data.abdm_client_id || "",
            clientSecret: data.abdm_client_secret || "",
            environment: (data.abdm_environment || "sandbox") as "sandbox" | "production",
          }
          setAbdmEnabled(vals.abdmEnabled)
          setFacilityId(vals.facilityId)
          setHipId(vals.hipId)
          setHiuId(vals.hiuId)
          setClientId(vals.clientId)
          setClientSecret(vals.clientSecret)
          setEnvironment(vals.environment)
          setOriginal(vals)
        }
        setLoading(false)
      })

    // Load stats
    Promise.all([
      supabase.from("patients").select("phone", { count: "exact", head: true }).eq("tenant_id", tenantId).not("abha_number", "is", null),
      supabase.from("health_consents").select("consent_id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("health_records").select("record_id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]).then(([pRes, cRes, rRes]) => {
      setStats({
        linkedPatients: pRes.count || 0,
        totalConsents: cRes.count || 0,
        healthRecords: rRes.count || 0,
      })
    }).catch(() => {
      // Tables might not exist yet — that's OK
    })
  }, [tenantId])

  const hasChanges = useMemo(() => {
    return (
      abdmEnabled !== original.abdmEnabled ||
      facilityId !== original.facilityId ||
      hipId !== original.hipId ||
      hiuId !== original.hiuId ||
      clientId !== original.clientId ||
      clientSecret !== original.clientSecret ||
      environment !== original.environment
    )
  }, [abdmEnabled, facilityId, hipId, hiuId, clientId, clientSecret, environment, original])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const supabase = createBrowserClient()

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          abdm_enabled: abdmEnabled,
          abdm_facility_id: facilityId || null,
          abdm_hip_id: hipId || null,
          abdm_hiu_id: hiuId || null,
          abdm_client_id: clientId || null,
          abdm_client_secret: clientSecret || null,
          abdm_environment: environment,
        })
        .eq("tenant_id", tenantId)

      if (error) throw error

      toast.success("ABDM settings saved")
      setOriginal({ abdmEnabled, facilityId, hipId, hiuId, clientId, clientSecret, environment })
    } catch (err) {
      console.error("[abdm] Save failed:", err)
      toast.error("Failed to save ABDM settings")
    } finally {
      setSaving(false)
    }
  }, [abdmEnabled, facilityId, hipId, hiuId, clientId, clientSecret, environment, tenantId])

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        variant="glass"
        icon={<Shield className="w-6 h-6" />}
        gradient="gradient-green"
        title="ABDM / ABHA Integration"
        subtitle="Configure Ayushman Bharat Digital Mission integration for health data exchange"
        action={hasChanges ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
            Unsaved changes
          </Badge>
        ) : undefined}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="card-hover">
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.linkedPatients}</p>
              <p className="text-[10px] text-muted-foreground">ABHA Linked</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="card-hover">
            <CardContent className="p-4 text-center">
              <ShieldCheck className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.totalConsents}</p>
              <p className="text-[10px] text-muted-foreground">Consents</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <Card className="card-hover">
            <CardContent className="p-4 text-center">
              <FileJson2 className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.healthRecords}</p>
              <p className="text-[10px] text-muted-foreground">FHIR Records</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Enable Toggle */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${abdmEnabled ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">ABDM Integration</p>
                  <p className="text-xs text-muted-foreground">Enable ABHA linking, consent management, and health record exchange</p>
                </div>
              </div>
              <Switch checked={abdmEnabled} onCheckedChange={setAbdmEnabled} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {abdmEnabled && (
        <>
          {/* Facility Registration */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  Facility Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Register your facility on the Health Facility Registry (HFR) at{" "}
                  <span className="font-mono text-foreground">facilitysbx.abdm.gov.in</span> to get these IDs.
                </p>
                <div className="space-y-1.5">
                  <Label>HFR Facility ID</Label>
                  <Input value={facilityId} onChange={(e) => setFacilityId(e.target.value)} placeholder="e.g. IN0410000123" className="font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>HIP ID (Provider)</Label>
                    <Input value={hipId} onChange={(e) => setHipId(e.target.value)} placeholder="Health Info Provider" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>HIU ID (User)</Label>
                    <Input value={hiuId} onChange={(e) => setHiuId(e.target.value)} placeholder="Health Info User" className="font-mono" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Gateway Credentials */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  Gateway Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Client ID</Label>
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ABDM Gateway Client ID" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Client Secret</Label>
                  <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="ABDM Gateway Client Secret" className="font-mono" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Environment */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center text-white">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-amber-500" /> Sandbox (Testing)
                      </span>
                    </SelectItem>
                    <SelectItem value="production">
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-emerald-500" /> Production (Live)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${environment === "production" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {environment === "production" ? (
                    <>
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Production mode connects to live ABDM gateway. Ensure your facility is registered and credentials are valid.</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Sandbox mode uses ABDM test environment. All data is test data and will not appear in real ABHA records.</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Save Button */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          size="lg"
          className={`w-full ${hasChanges ? "gradient-green text-white hover:opacity-90" : ""}`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {hasChanges ? "Save ABDM Settings" : "No Changes"}
        </Button>
      </motion.div>
    </div>
  )
}
