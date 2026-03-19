"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useReactToPrint } from "react-to-print"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BedDouble,
  Printer,
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"
import { PrintLayout } from "@/components/print/print-layout"
import { DischargeSummaryPrint } from "@/components/print/discharge-summary-print"
import { usePersonFilter, PersonSelectorBar } from "@/components/patient/person-filter"
import type { SessionUser } from "@/types/auth"
import type { Admission } from "@/types/database"

const statusConfig: Record<string, { label: string; color: string }> = {
  admitted: { label: "Admitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  discharged: { label: "Discharged", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  transferred: { label: "Transferred", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function daysStayed(admission: Admission) {
  const start = admission.admission_date
    ? new Date(admission.admission_date)
    : admission.created_at ? new Date(admission.created_at) : new Date()
  const end = admission.actual_discharge ? new Date(admission.actual_discharge) : new Date()
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function PatientAdmissionsPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { data: rawAdmissions, isLoading } = useSWR(
    phone ? `patient-admissions-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()
      // Fetch admissions across all tenants for this patient phone
      const phones = [phone!, phone!.replace(/^\+?91/, ""), `+91${phone!.replace(/^\+?91/, "")}`]
      const { data } = await supabase
        .from("admissions")
        .select("*")
        .in("patient_phone", phones)
        .order("created_at", { ascending: false })
      return (data || []) as Admission[]
    },
    { refreshInterval: 30000 }
  )

  const { filterByPerson } = usePersonFilter()
  const admissions = filterByPerson((rawAdmissions || []) as unknown as Record<string, unknown>[]) as unknown as Admission[]

  const [selected, setSelected] = useState<Admission | null>(null)

  // Print discharge summary
  const printRef = useRef<HTMLDivElement>(null)
  const [printAdmission, setPrintAdmission] = useState<Admission | null>(null)
  const { tenant: printTenant } = useTenant(printAdmission?.tenant_id || undefined)
  const [readyToPrint, setReadyToPrint] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Discharge-${printAdmission?.admission_id || ""}`,
    onAfterPrint: () => { setPrintAdmission(null); setReadyToPrint(false) },
  })

  // Trigger print when tenant data is loaded
  if (printAdmission && printTenant && !readyToPrint) {
    setReadyToPrint(true)
    setTimeout(() => handlePrint(), 200)
  }

  const activeCount = admissions.filter((a) => a.status === "admitted").length
  const dischargedCount = admissions.filter((a) => a.status === "discharged").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admissions</h1>
          <p className="text-sm text-muted-foreground">Your hospital admission history and discharge summaries</p>
        </div>
        <PersonSelectorBar />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{admissions.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{dischargedCount}</p>
            <p className="text-xs text-muted-foreground">Discharged</p>
          </CardContent>
        </Card>
      </div>

      {/* Admission List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : admissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BedDouble className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No admission records found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Hospital admissions will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admissions.map((admission, idx) => {
            const status = statusConfig[admission.status] || statusConfig.admitted
            const days = daysStayed(admission)
            return (
              <motion.div
                key={admission.admission_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className="cursor-pointer card-hover border-border/60"
                  onClick={() => setSelected(admission)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                          <BedDouble className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {admission.diagnosis || "Admission"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {admission.doctor_name ? `Dr. ${admission.doctor_name}` : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(admission.admission_date || admission.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className={cn("text-[10px] border-0", status.color)}>
                              {status.label}
                            </Badge>
                            {admission.ward && (
                              <span className="text-[10px] text-muted-foreground">
                                {admission.ward} {admission.bed_number ? `/ Bed ${admission.bed_number}` : ""}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {days} day{days !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Admission Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5" />
                  Admission Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* ID and Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{selected.admission_id}</span>
                  <Badge variant="secondary" className={cn("border-0", statusConfig[selected.status]?.color)}>
                    {statusConfig[selected.status]?.label || selected.status}
                  </Badge>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem icon={<Stethoscope className="w-3.5 h-3.5" />} label="Doctor" value={selected.doctor_name ? `Dr. ${selected.doctor_name}` : "—"} />
                  <InfoItem icon={<BedDouble className="w-3.5 h-3.5" />} label="Ward / Bed" value={`${selected.ward || "—"} / ${selected.bed_number || "—"}`} />
                  <InfoItem icon={<Calendar className="w-3.5 h-3.5" />} label="Admitted" value={formatDate(selected.admission_date || selected.created_at)} />
                  <InfoItem icon={<Calendar className="w-3.5 h-3.5" />} label="Discharged" value={selected.actual_discharge ? formatDate(selected.actual_discharge) : "Still admitted"} />
                  <InfoItem icon={<Clock className="w-3.5 h-3.5" />} label="Length of Stay" value={`${daysStayed(selected)} day${daysStayed(selected) !== 1 ? "s" : ""}`} />
                  <InfoItem icon={<FileText className="w-3.5 h-3.5" />} label="Diagnosis" value={selected.diagnosis || "—"} />
                </div>

                {/* Discharge Summary */}
                {selected.discharge_summary && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Discharge Summary</h4>
                    <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
                      {selected.discharge_summary.final_diagnosis && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Final Diagnosis</span>
                          <p className="text-foreground">{selected.discharge_summary.final_diagnosis}</p>
                        </div>
                      )}
                      {selected.discharge_summary.treatment_given && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Treatment Given</span>
                          <p className="text-foreground">{selected.discharge_summary.treatment_given}</p>
                        </div>
                      )}
                      {selected.discharge_summary.medications_on_discharge && selected.discharge_summary.medications_on_discharge.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Medications on Discharge</span>
                          <div className="mt-1 space-y-1">
                            {selected.discharge_summary.medications_on_discharge.map((med, i) => (
                              <p key={i} className="text-foreground text-xs">
                                {med.medicine} — {med.dosage}, {med.frequency}, {med.duration}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {selected.discharge_summary.follow_up_instructions && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Follow-up Instructions</span>
                          <p className="text-foreground">{selected.discharge_summary.follow_up_instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selected.notes}</p>
                  </div>
                )}

                {/* Daily Charges */}
                {selected.daily_charges && selected.daily_charges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Daily Charges</h4>
                    <div className="space-y-1">
                      {selected.daily_charges.map((charge, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                          <span className="text-muted-foreground">{charge.description}</span>
                          <span className="font-medium">Rs {charge.amount.toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm font-semibold pt-1">
                        <span>Total</span>
                        <span>Rs {selected.daily_charges.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Print Discharge Summary */}
                {selected.status === "discharged" && selected.discharge_summary && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPrintAdmission(selected)
                      setSelected(null)
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print Discharge Summary
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden print portal */}
      {printAdmission && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <div ref={printRef}>
            <PrintLayout
              tenant={printTenant}
              title="Discharge Summary"
            >
              <DischargeSummaryPrint admission={printAdmission} />
            </PrintLayout>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
