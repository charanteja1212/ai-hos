"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, UserCheck, Printer, Check } from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { printToken } from "@/lib/print-token"
import { useTenant } from "@/hooks/use-tenant"
import type { Appointment } from "@/types/database"

interface CheckInDialogProps {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
  tenantId: string
}

interface CheckInResult {
  queueNumber: number
  estimatedWait: number
  waitingAhead: number
}

export function CheckInDialog({ appointment, open, onClose, tenantId }: CheckInDialogProps) {
  const { tenant } = useTenant(tenantId)
  const [loading, setLoading] = useState(false)
  const [priority, setPriority] = useState("0")
  const [result, setResult] = useState<CheckInResult | null>(null)

  // Reset state when dialog opens for a different patient
  useEffect(() => {
    if (open) {
      setPriority("0")
      setResult(null)
    }
  }, [open])

  const handleCheckIn = async () => {
    if (!appointment) return
    setLoading(true)

    const supabase = createBrowserClient()
    const today = getTodayIST()
    const now = new Date().toISOString()

    try {
      // Guard: prevent double check-in
      if (appointment.check_in_status === "checked_in") {
        toast.error("Patient is already checked in")
        setLoading(false)
        return
      }
      const { data: existingQueue } = await supabase
        .from("queue_entries")
        .select("queue_id")
        .eq("booking_id", appointment.booking_id)
        .eq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle()
      if (existingQueue) {
        toast.error("Queue entry already exists for this appointment")
        setLoading(false)
        return
      }

      // Get waiting-ahead count for estimated wait (before insert)
      const { count: waitingAhead } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("date", today)
        .eq("doctor_id", appointment.doctor_id)
        .eq("status", "waiting")

      // Dynamic estimated wait: fetch avg consult time for this doctor from today's completed entries
      const { data: completedEntries } = await supabase
        .from("queue_entries")
        .select("consultation_start, consultation_end")
        .eq("tenant_id", tenantId)
        .eq("doctor_id", appointment.doctor_id)
        .eq("date", today)
        .eq("status", "completed")
        .not("consultation_start", "is", null)
        .not("consultation_end", "is", null)

      let avgConsultMin = 15 // default fallback
      if (completedEntries && completedEntries.length > 0) {
        const durations = completedEntries
          .map((e) => (new Date(e.consultation_end!).getTime() - new Date(e.consultation_start!).getTime()) / 60000)
          .filter((d) => d > 0 && d <= 120)
        if (durations.length > 0) {
          avgConsultMin = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        }
      }
      const estimatedWait = (waitingAhead || 0) * avgConsultMin

      // Insert queue entry first with temporary queue_number = 0
      const queueEntryId = `Q-${Date.now()}`
      const { error: queueError } = await supabase.from("queue_entries").insert({
        queue_id: queueEntryId,
        tenant_id: tenantId,
        booking_id: appointment.booking_id,
        patient_phone: appointment.patient_phone,
        patient_name: appointment.patient_name,
        doctor_id: appointment.doctor_id,
        doctor_name: appointment.doctor_name,
        queue_number: 0,
        status: "waiting",
        check_in_time: now,
        walk_in: false,
        priority: parseInt(priority),
        estimated_wait_minutes: estimatedWait,
        date: today,
      })

      if (queueError) throw queueError

      // Count all entries for this tenant+date AFTER insert to get actual position (race-safe)
      const { count: actualCount } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("date", today)

      const queueNumber = actualCount || 1

      // Update queue entry with the real queue number
      await supabase
        .from("queue_entries")
        .update({ queue_number: queueNumber })
        .eq("queue_id", queueEntryId)
        .eq("tenant_id", tenantId)

      // Update appointment status
      const { error: apptError } = await supabase
        .from("appointments")
        .update({
          check_in_status: "checked_in",
          arrival_time: now,
          queue_number: queueNumber,
        })
        .eq("booking_id", appointment.booking_id)
        .eq("tenant_id", tenantId)

      if (apptError) {
        console.error("Appointment update failed:", apptError)
      }

      createNotification({
        tenantId,
        type: "queue_checkin",
        title: "Patient checked in",
        message: `${appointment.patient_name} is waiting (Queue #${queueNumber})`,
        targetRole: "DOCTOR",
        targetUserId: appointment.doctor_id,
        referenceId: appointment.booking_id,
        referenceType: "queue_entry",
      })

      // Send WhatsApp token notification to patient (fire-and-forget)
      fetch("/api/queue/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: appointment.patient_phone,
          patient_name: appointment.patient_name,
          queue_number: queueNumber,
          doctor_name: appointment.doctor_name,
          hospital_name: tenant?.hospital_name || "Hospital",
          estimated_wait: estimatedWait,
          waiting_ahead: waitingAhead || 0,
          queue_url: `${window.location.origin}/queue/${tenantId}`,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => toast.warning("Queue assigned but WhatsApp notification may not have been sent"))

      setResult({ queueNumber, estimatedWait, waitingAhead: waitingAhead || 0 })
      toast.success(`${appointment.patient_name} checked in — Queue #${queueNumber}`)
    } catch {
      toast.error("Failed to check in patient")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!appointment || !result) return
    const now = new Date()
    printToken({
      hospitalName: tenant?.hospital_name || "Hospital",
      tokenNumber: result.queueNumber,
      patientName: appointment.patient_name,
      doctorName: appointment.doctor_name,
      date: getTodayIST(),
      time: now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      estimatedWait: result.estimatedWait,
      waitingAhead: result.waitingAhead,
      priority: parseInt(priority),
    })
  }

  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? "Check-In Complete" : "Check In Patient"}</DialogTitle>
        </DialogHeader>

        {result ? (
          /* ---- SUCCESS: Premium token card ---- */
          <div className="space-y-4 -mt-2">
            {/* Card */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Dark header strip */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-white tracking-wide uppercase">
                  {tenant?.hospital_name || "Hospital"}
                </span>
                <span className="text-[9px] font-semibold text-slate-400 bg-white/10 px-2 py-0.5 rounded">OPD</span>
              </div>

              {/* Token circle section */}
              <div className={`text-center py-5 ${
                parseInt(priority) === 2 ? "bg-red-50" : parseInt(priority) === 1 ? "bg-amber-50" : "bg-teal-50"
              }`}>
                <p className={`text-[10px] font-bold tracking-[3px] uppercase mb-2 ${
                  parseInt(priority) === 2 ? "text-red-600" : parseInt(priority) === 1 ? "text-amber-600" : "text-teal-600"
                }`}>
                  Your Token
                </p>
                <div className={`w-[88px] h-[88px] rounded-full border-[3px] flex items-center justify-center mx-auto bg-white shadow-md ${
                  parseInt(priority) === 2 ? "border-red-500" : parseInt(priority) === 1 ? "border-amber-500" : "border-teal-500"
                }`}>
                  <span className={`text-[40px] font-black leading-none tracking-tight ${
                    parseInt(priority) === 2 ? "text-red-600" : parseInt(priority) === 1 ? "text-amber-600" : "text-teal-600"
                  }`}>
                    {result.queueNumber}
                  </span>
                </div>
                {parseInt(priority) > 0 && (
                  <span className={`inline-block mt-2.5 text-[8px] font-extrabold tracking-[2px] px-3 py-1 rounded-full text-white ${
                    parseInt(priority) === 2 ? "bg-red-500" : "bg-amber-500"
                  }`}>
                    {parseInt(priority) === 2 ? "EMERGENCY" : "URGENT"}
                  </span>
                )}
              </div>

              {/* Patient info grid */}
              <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="col-span-2">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Patient</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{appointment.patient_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Doctor</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{appointment.doctor_name}</p>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="border-t border-dashed border-slate-200 mx-4" />

              {/* Wait stats */}
              <div className="flex items-center justify-center gap-6 py-3">
                <div className="text-center">
                  <p className={`text-xl font-black leading-none ${
                    parseInt(priority) === 2 ? "text-red-600" : parseInt(priority) === 1 ? "text-amber-600" : "text-teal-600"
                  }`}>
                    {result.estimatedWait > 0 ? `~${result.estimatedWait}` : "0"}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Min Wait</p>
                </div>
                <div className="w-px h-7 bg-slate-200" />
                <div className="text-center">
                  <p className={`text-xl font-black leading-none ${
                    parseInt(priority) === 2 ? "text-red-600" : parseInt(priority) === 1 ? "text-amber-600" : "text-teal-600"
                  }`}>
                    {result.waitingAhead}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Ahead</p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 text-center">
                <p className="text-[9px] text-slate-400 font-medium">
                  Please wait in the lobby &bull; <span className="font-bold text-slate-500">Watch the display screen</span>
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" className="flex-1 h-10">
                <Printer className="w-4 h-4 mr-2" />
                Print Token
              </Button>
              <Button onClick={onClose} className="flex-1 h-10 bg-slate-900 hover:bg-slate-800">
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* ---- FORM: Check-in view ---- */
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 space-y-1">
              <p className="font-semibold">{appointment.patient_name}</p>
              <p className="text-sm text-muted-foreground">
                {appointment.doctor_name} — {appointment.specialty}
              </p>
              <p className="text-sm text-muted-foreground">
                {appointment.time} • {appointment.booking_id}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">Urgent</SelectItem>
                  <SelectItem value="2">Emergency (Front of queue)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCheckIn} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="w-4 h-4 mr-2" />
              )}
              Check In
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
