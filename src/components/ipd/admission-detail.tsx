"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import {
  Activity,
  ArrowRight,
  BedDouble,
  Calendar,
  ClipboardList,
  IndianRupee,
  Receipt,
  Stethoscope,
  User,
} from "lucide-react"
import { useTenant } from "@/hooks/use-tenant"
import { PrintButton } from "@/components/print/print-button"
import { PrintLayout } from "@/components/print/print-layout"
import { DischargeSummaryPrint } from "@/components/print/discharge-summary-print"
import type { Admission, DailyCharge, NursingNote, TransferRecord } from "@/types/database"

interface AdmissionDetailProps {
  admission: Admission | null
  open: boolean
  onClose: () => void
  tenantId?: string
}

const STATUS_COLORS: Record<string, string> = {
  admitted: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  discharged: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  transferred: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
}

const NOTE_TYPE_COLORS: Record<string, string> = {
  vitals: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  observation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medication: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  general: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

const CHARGE_COLORS: Record<string, string> = {
  bed: "bg-blue-100 text-blue-700",
  medicine: "bg-purple-100 text-purple-700",
  procedure: "bg-orange-100 text-orange-700",
  consumable: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-700",
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

function daysStayed(admission: Admission) {
  const start = admission.admission_date
    ? new Date(admission.admission_date)
    : admission.created_at ? new Date(admission.created_at) : new Date()
  const end = admission.actual_discharge ? new Date(admission.actual_discharge) : new Date()
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function AdmissionDetail({ admission, open, onClose, tenantId }: AdmissionDetailProps) {
  const { tenant } = useTenant(tenantId)
  if (!admission) return null

  const notes: NursingNote[] = [...(admission.nursing_notes || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const transfers: TransferRecord[] = [...(admission.transfer_history || [])].sort(
    (a, b) => new Date(b.transferred_at).getTime() - new Date(a.transferred_at).getTime()
  )
  const charges: DailyCharge[] = admission.daily_charges || []
  const days = daysStayed(admission)

  return (
    <PremiumDialog
      open={open}
      onOpenChange={onClose}
      title="Admission Details"
      subtitle={admission.admission_id}
      icon={<ClipboardList className="w-5 h-5" />}
      gradient="gradient-purple"
      maxWidth="sm:max-w-3xl"
    >
      <Tabs defaultValue="overview" className="max-h-[70vh] overflow-y-auto">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="overview" className="flex-1 text-xs gap-1">
            <User className="w-3 h-3" /> Overview
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 text-xs gap-1">
            <Activity className="w-3 h-3" /> Notes
            {notes.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{notes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="charges" className="flex-1 text-xs gap-1">
            <Receipt className="w-3 h-3" /> Charges
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex-1 text-xs gap-1">
            <ArrowRight className="w-3 h-3" /> Transfers
            {transfers.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{transfers.length}</Badge>
            )}
          </TabsTrigger>
          {admission.status === "discharged" && admission.discharge_summary && (
            <TabsTrigger value="discharge" className="flex-1 text-xs gap-1">
              <Stethoscope className="w-3 h-3" /> Discharge
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-3">
          <div className="rounded-xl gradient-blue p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">
                {(admission.patient_name || "P")[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-lg">{admission.patient_name}</p>
                <p className="text-sm text-white/70">{admission.patient_phone}</p>
              </div>
              <div className="ml-auto text-right">
                <Badge className={`${STATUS_COLORS[admission.status]} border-0`}>
                  {admission.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={<BedDouble className="w-4 h-4" />} label="Ward / Bed" value={`${admission.ward} — ${admission.bed_number}`} />
            <InfoCard icon={<Stethoscope className="w-4 h-4" />} label="Doctor" value={admission.doctor_name || "—"} />
            <InfoCard icon={<ClipboardList className="w-4 h-4" />} label="Diagnosis" value={admission.diagnosis || "—"} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Length of Stay" value={`${days} day${days !== 1 ? "s" : ""}`} />
            <InfoCard
              icon={<Calendar className="w-4 h-4" />}
              label="Admitted"
              value={admission.admission_date?.split("T")[0] || admission.created_at?.split("T")[0] || "—"}
            />
            <InfoCard
              icon={<Calendar className="w-4 h-4" />}
              label={admission.status === "discharged" ? "Discharged" : "Expected Discharge"}
              value={admission.status === "discharged"
                ? admission.actual_discharge || "—"
                : admission.expected_discharge || "—"}
            />
          </div>

          {admission.notes && (
            <div className="glass rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{admission.notes}</p>
            </div>
          )}
        </TabsContent>

        {/* Nursing Notes */}
        <TabsContent value="notes">
          {notes.length === 0 ? (
            <EmptyState icon={<Activity className="w-8 h-8" />} text="No nursing notes" />
          ) : (
            <div className="space-y-2">
              {notes.map((n, i) => (
                <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${NOTE_TYPE_COLORS[n.type]}`}>{n.type}</Badge>
                      <span className="text-[10px] text-muted-foreground">{n.author}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatTs(n.timestamp)}</span>
                  </div>
                  {n.vitals && (
                    <div className="flex gap-2 flex-wrap">
                      {n.vitals.bp_systolic && <VitalChip label="BP" value={`${n.vitals.bp_systolic}/${n.vitals.bp_diastolic}`} />}
                      {n.vitals.pulse && <VitalChip label="Pulse" value={String(n.vitals.pulse)} />}
                      {n.vitals.temperature && <VitalChip label="Temp" value={`${n.vitals.temperature}°`} />}
                      {n.vitals.spo2 && <VitalChip label="SpO2" value={`${n.vitals.spo2}%`} />}
                      {n.vitals.respiratory_rate && <VitalChip label="RR" value={String(n.vitals.respiratory_rate)} />}
                    </div>
                  )}
                  {n.medications_given && n.medications_given.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {n.medications_given.map((m, j) => (
                        <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{n.note}</p>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Charges */}
        <TabsContent value="charges">
          {charges.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} text="No additional charges" />
          ) : (
            <div className="space-y-2">
              {charges.map((c, i) => (
                <div key={i} className="flex items-center justify-between glass rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-[10px] ${CHARGE_COLORS[c.category] || ""}`}>{c.category}</Badge>
                    <div>
                      <p className="text-xs font-medium">{c.description}</p>
                      <p className="text-[10px] text-muted-foreground">{c.date}</p>
                    </div>
                  </div>
                  <p className="text-xs font-mono font-semibold flex items-center gap-0.5">
                    <IndianRupee className="w-3 h-3" />{c.amount.toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
              <div className="flex justify-between p-3 glass rounded-xl font-semibold text-sm">
                <span>Total</span>
                <span className="font-mono flex items-center gap-0.5">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {charges.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Transfers */}
        <TabsContent value="transfers">
          {transfers.length === 0 ? (
            <EmptyState icon={<ArrowRight className="w-8 h-8" />} text="No transfers" />
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">{t.from_ward} / {t.from_bed}</Badge>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">{t.to_ward} / {t.to_bed}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatTs(t.transferred_at)} — by {t.transferred_by}
                  </p>
                  {t.reason && <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>}
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Discharge Summary */}
        {admission.status === "discharged" && admission.discharge_summary && (
          <TabsContent value="discharge" className="space-y-3">
            <div className="space-y-3">
              <SummaryField label="Final Diagnosis" value={admission.discharge_summary.final_diagnosis} />
              <SummaryField label="Treatment Given" value={admission.discharge_summary.treatment_given} />
              {admission.discharge_summary.medications_on_discharge.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5">Medications on Discharge</p>
                  <div className="space-y-1">
                    {admission.discharge_summary.medications_on_discharge.map((m, i) => (
                      <div key={i} className="glass rounded-lg p-2 text-xs flex items-center gap-2">
                        <span className="font-medium">{m.medicine}</span>
                        <span className="text-muted-foreground">{m.dosage}</span>
                        <span className="text-muted-foreground">{m.frequency}</span>
                        <span className="text-muted-foreground">{m.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SummaryField label="Follow-up Instructions" value={admission.discharge_summary.follow_up_instructions} />
              {admission.discharge_summary.follow_up_date && (
                <SummaryField label="Follow-up Date" value={admission.discharge_summary.follow_up_date} />
              )}
              <p className="text-[10px] text-muted-foreground">
                Discharged by: {admission.discharge_summary.discharged_by}
              </p>

              <PrintButton documentTitle={`Discharge-${admission.admission_id}`} label="Print Discharge Summary">
                <PrintLayout tenant={tenant} title="DISCHARGE SUMMARY" subtitle={admission.admission_id}>
                  <DischargeSummaryPrint admission={admission} />
                </PrintLayout>
              </PrintButton>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </PremiumDialog>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <div className="mx-auto mb-2 opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  )
}
