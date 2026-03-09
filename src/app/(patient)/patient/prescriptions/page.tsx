"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useReactToPrint } from "react-to-print"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Search,
  Printer,
  Stethoscope,
  Pill,
  Building2,
} from "lucide-react"
import { usePatientPrescriptions } from "@/hooks/use-patient-prescriptions"
import { useTenant } from "@/hooks/use-tenant"
import { PrintLayout } from "@/components/print/print-layout"
import { PrescriptionPrint } from "@/components/print/prescription-print"
import type { SessionUser } from "@/types/auth"
import type { Prescription, PrescriptionItem } from "@/types/database"

export default function PatientPrescriptionsPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { prescriptions, hospitalNames, isLoading } = usePatientPrescriptions(phone)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Prescription | null>(null)

  // Print support
  const printRef = useRef<HTMLDivElement>(null)
  const [printRx, setPrintRx] = useState<Prescription | null>(null)
  const { tenant: printTenant } = useTenant(printRx?.tenant_id || undefined)
  const [readyToPrint, setReadyToPrint] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Prescription-${printRx?.prescription_id || ""}`,
    onAfterPrint: () => { setPrintRx(null); setReadyToPrint(false) },
  })

  useEffect(() => {
    if (readyToPrint && printRx && printTenant) {
      handlePrint()
      setReadyToPrint(false)
    }
  }, [readyToPrint, printRx, printTenant, handlePrint])

  const filtered = prescriptions.filter((rx) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      rx.doctor_name?.toLowerCase().includes(q) ||
      rx.diagnosis?.toLowerCase().includes(q) ||
      (rx.items as PrescriptionItem[])?.some((item) =>
        item.medicine_name?.toLowerCase().includes(q)
      )
    )
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Prescriptions</h1>
        <p className="text-sm text-muted-foreground">{prescriptions.length} prescriptions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by doctor, diagnosis, or medicine..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Prescription List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No prescriptions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((rx, i) => (
            <motion.div
              key={rx.prescription_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(rx)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Stethoscope className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rx.doctor_name}</p>
                        {rx.diagnosis && (
                          <p className="text-xs text-muted-foreground mt-0.5">{rx.diagnosis}</p>
                        )}
                        {rx.tenant_id && hospitalNames[rx.tenant_id] && (
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-1">
                            <Building2 className="w-3 h-3" />
                            {hospitalNames[rx.tenant_id]}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(rx.created_at || "").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {rx.items && (
                    <div className="flex flex-wrap gap-1 mt-3 ml-13">
                      {(rx.items as PrescriptionItem[]).map((item, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] gap-1">
                          <Pill className="w-2.5 h-2.5" />
                          {item.medicine_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Prescription Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                <p className="font-semibold">{selected.doctor_name}</p>
                {selected.diagnosis && (
                  <p className="text-sm text-muted-foreground">Diagnosis: {selected.diagnosis}</p>
                )}
                {selected.symptoms && (
                  <p className="text-sm text-muted-foreground">Symptoms: {selected.symptoms}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(selected.created_at || "").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              {/* Vitals */}
              {selected.vitals && Object.keys(selected.vitals as Record<string, unknown>).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Vitals</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(selected.vitals as Record<string, unknown>)
                      .filter(([, v]) => v)
                      .map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-medium">{String(value)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Medicines */}
              {selected.items && (
                <div>
                  <p className="text-sm font-medium mb-2">Medicines</p>
                  <div className="space-y-2">
                    {(selected.items as PrescriptionItem[]).map((item, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-purple-500" />
                          {item.medicine_name}
                        </p>
                        <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-muted-foreground">
                          {item.dosage && <span>Dosage: {item.dosage}</span>}
                          {item.frequency && <span>Freq: {item.frequency}</span>}
                          {item.duration && <span>Duration: {item.duration}</span>}
                          {item.quantity && <span>Qty: {item.quantity}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setPrintRx(selected)
                  setReadyToPrint(true)
                }}
              >
                <Printer className="w-4 h-4" /> Print Prescription
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden print portal */}
      {printRx &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
            <div ref={printRef}>
              <PrintLayout
                tenant={printTenant}
                title="Prescription"
                subtitle={printRx.prescription_id}
              >
                <PrescriptionPrint prescription={printRx} />
              </PrintLayout>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
