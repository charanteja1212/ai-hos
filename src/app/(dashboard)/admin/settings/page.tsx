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
  BedDouble,
  Building2,
  Minus,
  Phone,
  MapPin,
  IndianRupee,
  Lock,
  Loader2,
  Plus,
  Save,
  Globe,
  Settings,
} from "lucide-react"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

import type { Tenant, WardConfig } from "@/types/database"

interface WardRow {
  name: string
  beds: string
  dailyRate: string
  type: WardConfig["type"]
}

const WARD_TYPES: WardConfig["type"][] = [
  "general", "semi_private", "private", "icu", "nicu", "maternity", "pediatric", "surgical"
]

const DEFAULT_WARD_ROWS: WardRow[] = [
  { name: "General Ward", beds: "GW-1,GW-2,GW-3,GW-4,GW-5,GW-6,GW-7,GW-8,GW-9,GW-10", dailyRate: "500", type: "general" },
  { name: "Semi-Private", beds: "SP-1,SP-2,SP-3,SP-4,SP-5,SP-6", dailyRate: "1000", type: "semi_private" },
  { name: "Private", beds: "PV-1,PV-2,PV-3,PV-4", dailyRate: "2000", type: "private" },
  { name: "ICU", beds: "ICU-1,ICU-2,ICU-3,ICU-4,ICU-5,ICU-6", dailyRate: "5000", type: "icu" },
  { name: "NICU", beds: "NICU-1,NICU-2,NICU-3,NICU-4", dailyRate: "4000", type: "nicu" },
  { name: "Maternity", beds: "MAT-1,MAT-2,MAT-3,MAT-4,MAT-5,MAT-6", dailyRate: "1500", type: "maternity" },
  { name: "Pediatric", beds: "PED-1,PED-2,PED-3,PED-4,PED-5,PED-6", dailyRate: "1000", type: "pediatric" },
  { name: "Surgical", beds: "SUR-1,SUR-2,SUR-3,SUR-4", dailyRate: "3000", type: "surgical" },
]

export default function SettingsPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [hospitalName, setHospitalName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [consultationFee, setConsultationFee] = useState("200")
  const [currency, setCurrency] = useState("INR")
  const [adminPin, setAdminPin] = useState("")
  const [receptionPin, setReceptionPin] = useState("")

  // Ward config
  const [wardRows, setWardRows] = useState<WardRow[]>([])
  const [savingWards, setSavingWards] = useState(false)
  const [wardDeleteIdx, setWardDeleteIdx] = useState<number | null>(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createBrowserClient()
    supabase
      .from("tenants")
      .select("*")
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        if (data) {
          const t = data as Tenant
          setTenant(t)
          setHospitalName(t.hospital_name || "")
          setAddress(t.address || "")
          setPhone(t.phone || "")
          setTimezone(t.timezone || "Asia/Kolkata")
          setConsultationFee(String(t.consultation_fee || 200))
          setCurrency(t.currency || "INR")
          // Load ward config
          if (t.ward_beds) {
            const rows: WardRow[] = Object.entries(t.ward_beds).map(([name, config]) => ({
              name,
              beds: config.beds.join(","),
              dailyRate: String(config.daily_rate),
              type: config.type,
            }))
            setWardRows(rows)
          } else {
            setWardRows(DEFAULT_WARD_ROWS)
          }
        }
        setLoading(false)
      })
  }, [tenantId])

  const handleSave = useCallback(async () => {
    // Validate PIN format (4-6 digits)
    if (adminPin && !/^\d{4,6}$/.test(adminPin)) {
      toast.error("Admin PIN must be 4-6 digits")
      return
    }
    if (receptionPin && !/^\d{4,6}$/.test(receptionPin)) {
      toast.error("Reception PIN must be 4-6 digits")
      return
    }
    // Validate consultation fee bounds
    const fee = parseInt(consultationFee)
    if (isNaN(fee) || fee < 0 || fee > 100000) {
      toast.error("Consultation fee must be between 0 and 100,000")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    const updates: Record<string, unknown> = {
      hospital_name: hospitalName,
      address: address || null,
      phone: phone || null,
      timezone,
      consultation_fee: parseInt(consultationFee) || 200,
      currency,
    }

    if (adminPin) updates.admin_pin = adminPin
    if (receptionPin) updates.reception_pin = receptionPin

    try {
      const { error } = await supabase
        .from("tenants")
        .update(updates)
        .eq("tenant_id", tenantId)

      if (error) throw error
      toast.success("Settings saved")
      setAdminPin("")
      setReceptionPin("")
    } catch (err) {
      console.error("[settings] Failed to save settings:", err)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }, [hospitalName, address, phone, timezone, consultationFee, currency, adminPin, receptionPin, tenantId])

  const hasChanges = useMemo(() => {
    if (!tenant) return false
    return (
      hospitalName !== (tenant.hospital_name || "") ||
      address !== (tenant.address || "") ||
      phone !== (tenant.phone || "") ||
      timezone !== (tenant.timezone || "Asia/Kolkata") ||
      consultationFee !== String(tenant.consultation_fee || 200) ||
      currency !== (tenant.currency || "INR") ||
      adminPin !== "" ||
      receptionPin !== ""
    )
  }, [tenant, hospitalName, address, phone, timezone, consultationFee, currency, adminPin, receptionPin])

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
        icon={<Settings className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Hospital Settings"
        subtitle={`Configure ${tenant?.hospital_name || "hospital"} settings — Tenant: ${tenantId}`}
        action={hasChanges ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
            Unsaved changes
          </Badge>
        ) : undefined}
      />

      {/* Basic Info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white"><Building2 className="w-3.5 h-3.5" /></div>
            Hospital Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Hospital Name</Label>
            <Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Address
            </Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Phone className="w-3 h-3" /> Phone
              </Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <Globe className="w-3 h-3" /> Timezone
              </Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Financial */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-green flex items-center justify-center text-white"><IndianRupee className="w-3.5 h-3.5" /></div>
            Financial Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Default Consultation Fee</Label>
              <Input type="number" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" />
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white"><Lock className="w-3.5 h-3.5" /></div>
            Security / PINs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Leave blank to keep current PINs unchanged.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Admin PIN</Label>
              <Input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="New admin PIN" maxLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Reception PIN</Label>
              <Input type="password" value={receptionPin} onChange={(e) => setReceptionPin(e.target.value)} placeholder="New reception PIN" maxLength={6} />
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Ward & Bed Configuration */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-orange flex items-center justify-center text-white"><BedDouble className="w-3.5 h-3.5" /></div>
            Ward & Bed Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Configure wards, bed labels, and daily rates. Beds are comma-separated.
          </p>

          {wardRows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.5fr_0.5fr_0.7fr_auto] gap-2 items-end">
              <div className="space-y-0.5">
                {i === 0 && <Label className="text-[10px]">Ward Name</Label>}
                <Input
                  className="h-8 text-xs"
                  placeholder="Ward name"
                  value={row.name}
                  onChange={(e) => {
                    const updated = [...wardRows]
                    updated[i] = { ...updated[i], name: e.target.value }
                    setWardRows(updated)
                  }}
                />
              </div>
              <div className="space-y-0.5">
                {i === 0 && <Label className="text-[10px]">Beds (comma-separated)</Label>}
                <Input
                  className="h-8 text-xs"
                  placeholder="GW-1,GW-2,GW-3"
                  value={row.beds}
                  onChange={(e) => {
                    const updated = [...wardRows]
                    updated[i] = { ...updated[i], beds: e.target.value }
                    setWardRows(updated)
                  }}
                />
              </div>
              <div className="space-y-0.5">
                {i === 0 && <Label className="text-[10px]">Rate/Day</Label>}
                <Input
                  className="h-8 text-xs"
                  type="number"
                  placeholder="500"
                  value={row.dailyRate}
                  onChange={(e) => {
                    const updated = [...wardRows]
                    updated[i] = { ...updated[i], dailyRate: e.target.value }
                    setWardRows(updated)
                  }}
                />
              </div>
              <div className="space-y-0.5">
                {i === 0 && <Label className="text-[10px]">Type</Label>}
                <select
                  className="h-8 text-xs w-full rounded-md border border-input bg-transparent px-2"
                  value={row.type}
                  onChange={(e) => {
                    const updated = [...wardRows]
                    updated[i] = { ...updated[i], type: e.target.value as WardConfig["type"] }
                    setWardRows(updated)
                  }}
                >
                  {WARD_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500"
                onClick={() => setWardDeleteIdx(i)}
              >
                <Minus className="w-3 h-3" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWardRows([...wardRows, { name: "", beds: "", dailyRate: "500", type: "general" }])}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Ward
            </Button>
            <Button
              size="sm"
              disabled={savingWards}
              className="text-xs"
              onClick={async () => {
                setSavingWards(true)
                const supabase = createBrowserClient()
                const wardBeds: Record<string, WardConfig> = {}
                for (const row of wardRows) {
                  if (!row.name.trim()) continue
                  wardBeds[row.name.trim()] = {
                    beds: row.beds.split(",").map((b) => b.trim()).filter(Boolean),
                    daily_rate: parseInt(row.dailyRate) || 500,
                    type: row.type,
                  }
                }
                try {
                  const { error } = await supabase
                    .from("tenants")
                    .update({ ward_beds: wardBeds })
                    .eq("tenant_id", tenantId)
                  if (error) throw error
                  toast.success("Ward configuration saved")
                } catch (err) {
                  console.error("[settings] Failed to save ward config:", err)
                  toast.error("Failed to save ward config")
                } finally {
                  setSavingWards(false)
                }
              }}
            >
              {savingWards ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save Wards
            </Button>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <Button
        onClick={() => {
          const hasSensitiveChange = adminPin !== "" || receptionPin !== "" || consultationFee !== String(tenant?.consultation_fee || 200)
          if (hasSensitiveChange) {
            setShowSaveConfirm(true)
          } else {
            handleSave()
          }
        }}
        disabled={saving || !hasChanges}
        size="lg"
        className={`w-full ${hasChanges ? "gradient-blue text-white hover:opacity-90" : ""}`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        {hasChanges ? "Save Settings" : "No Changes"}
      </Button>
      </motion.div>

      <ConfirmDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        title="Confirm Sensitive Changes"
        description={
          [
            adminPin ? "Admin PIN will be changed." : "",
            receptionPin ? "Reception PIN will be changed." : "",
            consultationFee !== String(tenant?.consultation_fee || 200) ? `Consultation fee will change to Rs ${consultationFee}.` : "",
          ].filter(Boolean).join(" ")
        }
        confirmLabel="Save Changes"
        onConfirm={() => { setShowSaveConfirm(false); handleSave() }}
      />

      <ConfirmDialog
        open={wardDeleteIdx !== null}
        onOpenChange={(open) => { if (!open) setWardDeleteIdx(null) }}
        title="Remove Ward"
        description={wardDeleteIdx !== null ? `Are you sure you want to remove "${wardRows[wardDeleteIdx]?.name || "this ward"}"? This won't take effect until you save.` : ""}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (wardDeleteIdx !== null) {
            setWardRows(wardRows.filter((_, idx) => idx !== wardDeleteIdx))
            setWardDeleteIdx(null)
          }
        }}
      />
    </div>
  )
}
