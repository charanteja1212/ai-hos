"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShieldCheck,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { CONSENT_PURPOSES, HEALTH_INFO_TYPES } from "@/lib/abdm/config"
import type { HealthConsent, HealthInfoType } from "@/types/database"

interface ConsentManagerProps {
  tenantId: string
  patientPhone: string
  patientAbha?: string | null
}

export function ConsentManager({ tenantId, patientPhone, patientAbha }: ConsentManagerProps) {
  const [consents, setConsents] = useState<HealthConsent[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  // New consent form
  const [purpose, setPurpose] = useState<HealthConsent["purpose"]>("CAREMGT")
  const [selectedHiTypes, setSelectedHiTypes] = useState<HealthInfoType[]>(["OPConsultation", "Prescription"])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expiry, setExpiry] = useState("")
  const [requesterName, setRequesterName] = useState("")

  const fetchConsents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-consents", tenantId, patientPhone }),
      })
      const data = await res.json()
      setConsents(data.consents || [])
    } catch {
      toast.error("Failed to load consents")
    } finally {
      setLoading(false)
    }
  }, [tenantId, patientPhone])

  useEffect(() => { fetchConsents() }, [fetchConsents])

  const handleCreate = useCallback(async () => {
    if (!requesterName.trim()) {
      toast.error("Enter requester name")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-consent",
          tenantId,
          patientPhone,
          patientAbha,
          purpose,
          hiTypes: selectedHiTypes,
          dateRangeFrom: dateFrom || undefined,
          dateRangeTo: dateTo || undefined,
          expiry: expiry || undefined,
          requesterName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Consent request created")
      setCreateOpen(false)
      setRequesterName("")
      fetchConsents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create consent")
    } finally {
      setCreating(false)
    }
  }, [tenantId, patientPhone, patientAbha, purpose, selectedHiTypes, dateFrom, dateTo, expiry, requesterName, fetchConsents])

  const handleUpdateStatus = useCallback(async (consentId: string, status: string) => {
    setUpdating(consentId)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-consent", tenantId, consentId, status }),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast.success(`Consent ${status.toLowerCase()}`)
      fetchConsents()
    } catch {
      toast.error("Failed to update consent")
    } finally {
      setUpdating(null)
    }
  }, [tenantId, fetchConsents])

  const toggleHiType = (type: HealthInfoType) => {
    setSelectedHiTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    REQUESTED: { color: "bg-amber-100 text-amber-800", icon: <Clock className="w-3 h-3" /> },
    GRANTED: { color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="w-3 h-3" /> },
    DENIED: { color: "bg-red-100 text-red-800", icon: <XCircle className="w-3 h-3" /> },
    EXPIRED: { color: "bg-gray-100 text-gray-600", icon: <AlertTriangle className="w-3 h-3" /> },
    REVOKED: { color: "bg-orange-100 text-orange-800", icon: <XCircle className="w-3 h-3" /> },
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Health Data Consents ({consents.length})
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="w-3 h-3" /> New Consent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Create Consent Request
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Purpose</Label>
                  <Select value={purpose} onValueChange={(v) => setPurpose(v as HealthConsent["purpose"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSENT_PURPOSES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Health Information Types</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {HEALTH_INFO_TYPES.map((hi) => (
                      <Badge
                        key={hi.value}
                        variant={selectedHiTypes.includes(hi.value as HealthInfoType) ? "default" : "outline"}
                        className="cursor-pointer text-[10px]"
                        onClick={() => toggleHiType(hi.value as HealthInfoType)}
                      >
                        {hi.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Requester Name</Label>
                  <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Hospital or doctor name" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date From</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date To</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Consent Expiry</Label>
                  <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </div>

                <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Create Consent Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : consents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No consent records</p>
        ) : (
          <div className="space-y-3">
            {consents.map((consent) => {
              const sc = statusConfig[consent.status] || statusConfig.REQUESTED
              return (
                <div key={consent.consent_id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{consent.requester_name}</span>
                    </div>
                    <Badge className={`${sc.color} border-0 gap-1 text-[10px]`}>
                      {sc.icon} {consent.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {consent.hi_types.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                    ))}
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    Purpose: {CONSENT_PURPOSES.find((p) => p.code === consent.purpose)?.label || consent.purpose}
                    {consent.expiry && ` | Expires: ${new Date(consent.expiry).toLocaleDateString("en-IN")}`}
                  </div>

                  {consent.status === "REQUESTED" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-7 text-xs gap-1"
                        disabled={updating === consent.consent_id}
                        onClick={() => handleUpdateStatus(consent.consent_id, "GRANTED")}
                      >
                        {updating === consent.consent_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Grant
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs gap-1"
                        disabled={updating === consent.consent_id}
                        onClick={() => handleUpdateStatus(consent.consent_id, "DENIED")}
                      >
                        <XCircle className="w-3 h-3" /> Deny
                      </Button>
                    </div>
                  )}

                  {consent.status === "GRANTED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs gap-1 text-orange-600 border-orange-200"
                      disabled={updating === consent.consent_id}
                      onClick={() => handleUpdateStatus(consent.consent_id, "REVOKED")}
                    >
                      {updating === consent.consent_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      Revoke Consent
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
