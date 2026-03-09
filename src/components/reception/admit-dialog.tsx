"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, BedDouble, IndianRupee } from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { useWardBeds } from "@/hooks/use-ward-beds"

interface AdmitDialogProps {
  patientPhone: string
  patientName: string
  doctorId?: string
  doctorName?: string
  bookingId?: string
  tenantId: string
  open: boolean
  onClose: () => void
}

export function AdmitDialog({
  patientPhone,
  patientName,
  doctorId,
  doctorName,
  bookingId,
  tenantId,
  open,
  onClose,
}: AdmitDialogProps) {
  const { wards, bedMap, mutate: mutateBeds } = useWardBeds(tenantId)
  const [loading, setLoading] = useState(false)
  const [ward, setWard] = useState("")
  const [bedNumber, setBedNumber] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [expectedDays, setExpectedDays] = useState("3")

  const availableBeds = ward ? (bedMap[ward] || []).filter((b) => b.status === "available") : []
  const wardConfig = ward ? wards[ward] : null

  const handleAdmit = async () => {
    if (!ward || !bedNumber) {
      toast.error("Please select ward and bed")
      return
    }
    const daysNum = parseInt(expectedDays)
    if (!daysNum || daysNum < 1) {
      toast.error("Expected stay must be at least 1 day")
      return
    }
    setLoading(true)

    const supabase = createBrowserClient()
    const expectedDischarge = new Date()
    expectedDischarge.setDate(expectedDischarge.getDate() + daysNum)

    try {
      const { error } = await supabase.from("admissions").insert({
        admission_id: `ADM-${Date.now()}`,
        tenant_id: tenantId,
        patient_phone: patientPhone,
        patient_name: patientName,
        doctor_id: doctorId,
        doctor_name: doctorName,
        ward,
        bed_number: bedNumber,
        diagnosis,
        expected_discharge: expectedDischarge.toISOString().split("T")[0],
        status: "admitted",
        from_appointment: bookingId,
      })

      if (error) throw error

      // Update appointment if exists
      if (bookingId) {
        const { error: apptError } = await supabase
          .from("appointments")
          .update({ check_in_status: "admitted" })
          .eq("booking_id", bookingId)
          .eq("tenant_id", tenantId)
        if (apptError) console.error("Appointment update failed:", apptError)
      }

      createNotification({
        tenantId,
        type: "new_admission",
        title: "New patient admitted",
        message: `${patientName} admitted to ${ward} — Bed ${bedNumber}`,
        targetRole: "ADMIN",
        referenceType: "admission",
      })

      toast.success(`${patientName} admitted to ${ward} — Bed ${bedNumber}`)
      mutateBeds()
      onClose()
    } catch (err) {
      toast.error("Failed to admit patient")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Admit Patient (OP → IP)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="font-semibold">{patientName}</p>
            <p className="text-sm text-muted-foreground">{patientPhone}</p>
            {doctorName && <p className="text-sm text-muted-foreground">Doctor: {doctorName}</p>}
          </div>

          {/* Ward selector */}
          <div className="space-y-2">
            <Label>Ward *</Label>
            <Select
              value={ward}
              onValueChange={(v) => {
                setWard(v)
                setBedNumber("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(wards).map(([name, config]) => {
                  const avail = (bedMap[name] || []).filter((b) => b.status === "available").length
                  return (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        {name}
                        <span className="text-muted-foreground text-xs">
                          {avail} avail · Rs {config.daily_rate}/day
                        </span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Bed picker */}
          {ward && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Bed *</Label>
                {wardConfig && (
                  <Badge variant="secondary" className="text-[10px]">
                    <IndianRupee className="w-2.5 h-2.5 mr-0.5" />
                    {wardConfig.daily_rate}/day
                  </Badge>
                )}
              </div>
              {availableBeds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No available beds in this ward</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {availableBeds.map((b) => (
                    <button
                      key={b.bed}
                      type="button"
                      onClick={() => setBedNumber(b.bed)}
                      className={cn(
                        "rounded-lg p-2 text-center text-xs font-mono border transition-all",
                        "bg-green-50 border-green-200 hover:border-green-400 dark:bg-green-950/20 dark:border-green-800",
                        "hover:shadow-md hover:scale-[1.02]",
                        bedNumber === b.bed && "ring-2 ring-primary ring-offset-1 border-primary"
                      )}
                    >
                      {b.bed}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Diagnosis</Label>
            <Input
              placeholder="Provisional diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expected Stay (days)</Label>
            <Input
              type="number"
              value={expectedDays}
              onChange={(e) => setExpectedDays(e.target.value)}
              min="1"
            />
          </div>

          <Button onClick={handleAdmit} disabled={loading || !ward || !bedNumber} className="w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <BedDouble className="w-4 h-4 mr-2" />
            )}
            Admit Patient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
