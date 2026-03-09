"use client"

import { useState, useRef, useEffect } from "react"
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
  TestTube,
  Printer,
  Building2,
  CheckCircle2,
  Clock,
  Beaker,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePatientLabOrders } from "@/hooks/use-patient-lab-orders"
import { useTenant } from "@/hooks/use-tenant"
import { PrintLayout } from "@/components/print/print-layout"
import { LabReportPrint } from "@/components/print/lab-report-print"
import type { SessionUser } from "@/types/auth"
import type { LabOrder } from "@/types/database"

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ordered: { label: "Ordered", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  sample_collected: { label: "Collected", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Beaker },
  processing: { label: "Processing", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: TestTube },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
}

export default function PatientLabPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { orders, hospitalNames, isLoading } = usePatientLabOrders(phone)
  const [selected, setSelected] = useState<LabOrder | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null)
  const { tenant: printTenant } = useTenant(printOrder?.tenant_id || undefined)
  const [readyToPrint, setReadyToPrint] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `LabReport-${printOrder?.order_id || ""}`,
    onAfterPrint: () => { setPrintOrder(null); setReadyToPrint(false) },
  })

  useEffect(() => {
    if (readyToPrint && printOrder && printTenant) {
      handlePrint()
      setReadyToPrint(false)
    }
  }, [readyToPrint, printOrder, printTenant, handlePrint])

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Lab Results</h1>
        <p className="text-sm text-muted-foreground">{orders.length} lab orders</p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TestTube className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No lab orders found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order, i) => {
            const cfg = statusConfig[order.status] || statusConfig.ordered
            return (
              <motion.div
                key={order.order_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelected(order)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <TestTube className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {(order.tests || []).map((t: { test_name: string }) => t.test_name).join(", ")}
                          </p>
                          <Badge className={cn("text-[10px] shrink-0", cfg.color)}>
                            {cfg.label}
                          </Badge>
                        </div>
                        {order.doctor_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">Dr. {order.doctor_name}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                          </span>
                          {order.tenant_id && hospitalNames[order.tenant_id] && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {hospitalNames[order.tenant_id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Lab Order Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lab Results</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                {selected.doctor_name && (
                  <p className="text-sm">Referred by: <span className="font-medium">Dr. {selected.doctor_name}</span></p>
                )}
                <p className="text-xs text-muted-foreground font-mono">{selected.order_id}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.created_at ? new Date(selected.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </p>
              </div>

              {/* Test Results */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Test Results</p>
                {(selected.tests || []).map((test, i) => {
                  const results = (selected.results || {}) as Record<string, string | number>
                  const result = results[test.test_name]
                  const testStatus = statusConfig[test.status] || statusConfig.ordered

                  return (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{test.test_name}</p>
                        <Badge className={cn("text-[10px]", testStatus.color)}>
                          {testStatus.label}
                        </Badge>
                      </div>
                      {result !== undefined && (
                        <p className="text-lg font-bold mt-1">{String(result)}</p>
                      )}
                      {(test as unknown as { normal_range?: string }).normal_range && (
                        <p className="text-xs text-muted-foreground">Normal range: {(test as unknown as { normal_range?: string }).normal_range}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {selected.notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </div>
              )}

              {selected.status === "completed" && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setPrintOrder(selected)
                    setReadyToPrint(true)
                  }}
                >
                  <Printer className="w-4 h-4" /> Print Report
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden print portal */}
      {printOrder &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
            <div ref={printRef}>
              <PrintLayout
                tenant={printTenant}
                title="Lab Report"
                subtitle={printOrder.order_id}
              >
                <LabReportPrint order={printOrder} />
              </PrintLayout>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
