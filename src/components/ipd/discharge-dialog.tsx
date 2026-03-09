"use client"

import { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { BedDouble, IndianRupee, Loader2, LogOut, Minus, Plus } from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { getTodayIST } from "@/lib/utils/date"
import { useWardBeds } from "@/hooks/use-ward-beds"
import type { Admission, DailyCharge, DischargeSummary } from "@/types/database"

interface DischargeDialogProps {
  admission: Admission | null
  tenantId: string
  open: boolean
  onClose: () => void
  onDischarged: () => void
  userName?: string
}

interface DischargeMed {
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

export function DischargeDialog({ admission, tenantId, open, onClose, onDischarged, userName }: DischargeDialogProps) {
  const { wards } = useWardBeds(tenantId)

  const [finalDiagnosis, setFinalDiagnosis] = useState("")
  const [treatmentGiven, setTreatmentGiven] = useState("")
  const [followUpInstructions, setFollowUpInstructions] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [meds, setMeds] = useState<DischargeMed[]>([])
  const [discharging, setDischarging] = useState(false)

  // Pre-fill on open
  const initRef = useState(false)
  if (admission && !initRef[0]) {
    if (admission.diagnosis) setFinalDiagnosis(admission.diagnosis)
    initRef[1](true)
  }

  // Calculate billing
  const billing = useMemo(() => {
    if (!admission) return { bedTotal: 0, chargesTotal: 0, grandTotal: 0, daysStayed: 0 }

    const admDate = admission.admission_date
      ? new Date(admission.admission_date)
      : admission.created_at ? new Date(admission.created_at) : new Date()
    const now = new Date()
    const daysStayed = Math.max(1, Math.ceil((now.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)))

    const wardConfig = admission.ward ? wards[admission.ward] : null
    const dailyRate = wardConfig?.daily_rate || 500
    const bedTotal = dailyRate * daysStayed

    const charges: DailyCharge[] = admission.daily_charges || []
    const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)

    return { bedTotal, chargesTotal, grandTotal: bedTotal + chargesTotal, daysStayed, dailyRate }
  }, [admission, wards])

  const addMed = () => setMeds([...meds, { medicine: "", dosage: "", frequency: "", duration: "" }])
  const removeMed = (i: number) => setMeds(meds.filter((_, idx) => idx !== i))
  const updateMed = (i: number, field: keyof DischargeMed, value: string) => {
    const updated = [...meds]
    updated[i] = { ...updated[i], [field]: value }
    setMeds(updated)
  }

  const handleDischarge = useCallback(async () => {
    if (!admission) return
    setDischarging(true)
    const supabase = createBrowserClient()

    try {
      // Pre-check: ensure admission is still in "admitted" status
      const { data: current } = await supabase
        .from("admissions")
        .select("status")
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", tenantId)
        .single()
      if (current?.status === "discharged") {
        toast.error("Already discharged")
        return
      }

      const summary: DischargeSummary = {
        final_diagnosis: finalDiagnosis || admission.diagnosis || "",
        treatment_given: treatmentGiven,
        medications_on_discharge: meds.filter((m) => m.medicine.trim()),
        follow_up_instructions: followUpInstructions,
        follow_up_date: followUpDate || undefined,
        discharged_by: userName || "Staff",
      }

      const { error } = await supabase
        .from("admissions")
        .update({
          status: "discharged",
          actual_discharge: getTodayIST(),
          discharge_summary: summary,
        })
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", tenantId)

      if (error) throw error

      // Auto-generate admission invoice
      const items: { description: string; amount: number; quantity: number }[] = [
        {
          description: `Bed Charges — ${admission.ward} (${billing.daysStayed} days @ Rs ${billing.dailyRate}/day)`,
          amount: billing.bedTotal,
          quantity: 1,
        },
      ]

      // Add daily charges as line items
      const dailyCharges: DailyCharge[] = admission.daily_charges || []
      for (const charge of dailyCharges) {
        items.push({
          description: `${charge.description} (${charge.category})`,
          amount: charge.amount,
          quantity: 1,
        })
      }

      if (billing.grandTotal > 0) {
        await supabase.from("invoices").insert({
          invoice_id: `INV-A-${Date.now()}`,
          tenant_id: tenantId,
          patient_phone: admission.patient_phone,
          patient_name: admission.patient_name,
          type: "admission",
          admission_id: admission.admission_id,
          items,
          subtotal: billing.grandTotal,
          tax: 0,
          discount: 0,
          total: billing.grandTotal,
          payment_status: "unpaid",
        })
      }

      toast.success(`${admission.patient_name} discharged successfully`)

      createNotification({
        tenantId,
        type: "patient_discharged",
        title: "Patient discharged",
        message: `${admission.patient_name} discharged from ${admission.ward}`,
        targetRole: "ADMIN",
        referenceId: admission.admission_id,
        referenceType: "admission",
      })
      createNotification({
        tenantId,
        type: "patient_discharged",
        title: "Patient discharged",
        message: `${admission.patient_name} discharged from ${admission.ward}`,
        targetRole: "RECEPTION",
        referenceId: admission.admission_id,
        referenceType: "admission",
      })

      onDischarged()
      onClose()
    } catch (err) {
      console.error("[discharge] Failed:", err)
      toast.error("Failed to discharge patient")
    } finally {
      setDischarging(false)
    }
  }, [admission, finalDiagnosis, treatmentGiven, meds, followUpInstructions, followUpDate, userName, billing, tenantId, onDischarged, onClose])

  return (
    <PremiumDialog
      open={open}
      onOpenChange={onClose}
      title="Discharge Patient"
      subtitle={admission?.admission_id}
      icon={<LogOut className="w-5 h-5" />}
      gradient="gradient-green"
      maxWidth="sm:max-w-2xl"
    >
      {admission && (
        <div className="space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Patient info */}
          <div className="rounded-xl gradient-blue p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <BedDouble className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">{admission.patient_name}</p>
                <p className="text-sm text-white/70">{admission.ward} — Bed {admission.bed_number}</p>
                <p className="text-xs text-white/50">
                  Doctor: {admission.doctor_name} | {billing.daysStayed} day{billing.daysStayed !== 1 ? "s" : ""} stay
                </p>
              </div>
            </div>
          </div>

          {/* Discharge Summary Form */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Discharge Summary</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Final Diagnosis</Label>
              <Input
                value={finalDiagnosis}
                onChange={(e) => setFinalDiagnosis(e.target.value)}
                placeholder="Final diagnosis"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Treatment Given</Label>
              <Textarea
                value={treatmentGiven}
                onChange={(e) => setTreatmentGiven(e.target.value)}
                placeholder="Summary of treatment provided during stay"
                rows={2}
              />
            </div>

            {/* Medications on discharge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Medications on Discharge</Label>
                <Button variant="ghost" size="sm" onClick={addMed} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              {meds.map((med, i) => (
                <div key={i} className="grid grid-cols-[1fr_0.7fr_0.7fr_0.5fr_auto] gap-1.5 items-end">
                  <div className="space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Medicine</Label>}
                    <Input className="h-8 text-xs" placeholder="Medicine" value={med.medicine} onChange={(e) => updateMed(i, "medicine", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Dosage</Label>}
                    <Input className="h-8 text-xs" placeholder="500mg" value={med.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Frequency</Label>}
                    <Input className="h-8 text-xs" placeholder="BD" value={med.frequency} onChange={(e) => updateMed(i, "frequency", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Duration</Label>}
                    <Input className="h-8 text-xs" placeholder="5 days" value={med.duration} onChange={(e) => updateMed(i, "duration", e.target.value)} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeMed(i)} className="h-8 w-8 text-red-500">
                    <Minus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Follow-up Instructions</Label>
              <Textarea
                value={followUpInstructions}
                onChange={(e) => setFollowUpInstructions(e.target.value)}
                placeholder="Post-discharge care instructions, diet, activity restrictions..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Follow-up Date</Label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>

          {/* Billing Preview */}
          <div className="glass rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4" /> Billing Preview
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Bed Charges ({billing.daysStayed} days)</span>
                <span className="font-mono">Rs {billing.bedTotal.toLocaleString("en-IN")}</span>
              </div>
              {(admission.daily_charges || []).length > 0 && (
                <div className="flex justify-between">
                  <span>Additional Charges ({(admission.daily_charges || []).length} items)</span>
                  <span className="font-mono">Rs {billing.chargesTotal.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-sm">
                <span>Total</span>
                <span className="font-mono flex items-center gap-0.5">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {billing.grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              Invoice will be auto-generated
            </Badge>
          </div>

          <Button onClick={handleDischarge} disabled={discharging} className="w-full">
            {discharging ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            Confirm Discharge
          </Button>
        </div>
      )}
    </PremiumDialog>
  )
}
