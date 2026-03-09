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
  Receipt,
  Printer,
  Building2,
  IndianRupee,
  Stethoscope,
  Pill,
  TestTube,
  BedDouble,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePatientInvoices } from "@/hooks/use-patient-invoices"
import { useTenant } from "@/hooks/use-tenant"
import { PrintLayout } from "@/components/print/print-layout"
import { InvoicePrint } from "@/components/print/invoice-print"
import type { SessionUser } from "@/types/auth"
import type { Invoice } from "@/types/database"

const paymentColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}

const typeIcons: Record<string, React.ElementType> = {
  consultation: Stethoscope,
  pharmacy: Pill,
  lab: TestTube,
  admission: BedDouble,
  procedure: Receipt,
}

type Tab = "all" | "unpaid" | "paid"

export default function PatientInvoicesPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const { invoices, hospitalNames, isLoading } = usePatientInvoices(phone)
  const [tab, setTab] = useState<Tab>("all")
  const [selected, setSelected] = useState<Invoice | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const { tenant: printTenant } = useTenant(printInvoice?.tenant_id || undefined)
  const [readyToPrint, setReadyToPrint] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${printInvoice?.invoice_id || ""}`,
    onAfterPrint: () => { setPrintInvoice(null); setReadyToPrint(false) },
  })

  useEffect(() => {
    if (readyToPrint && printInvoice && printTenant) {
      handlePrint()
      setReadyToPrint(false)
    }
  }, [readyToPrint, printInvoice, printTenant, handlePrint])

  const filtered = invoices.filter((inv) => {
    if (tab === "unpaid") return inv.payment_status === "unpaid"
    if (tab === "paid") return inv.payment_status === "paid"
    return true
  })

  const totalUnpaid = invoices
    .filter((inv) => inv.payment_status === "unpaid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0)

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "paid", label: "Paid" },
  ]

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Bills & Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoices
          {totalUnpaid > 0 && (
            <span className="text-red-500 ml-2">
              (Rs {totalUnpaid.toLocaleString("en-IN")} unpaid)
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No invoices found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv, i) => {
            const Icon = typeIcons[inv.type || "consultation"] || Receipt
            return (
              <motion.div
                key={inv.invoice_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelected(inv)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium capitalize">{inv.type || "Invoice"}</p>
                          <Badge className={cn("text-[10px] shrink-0", paymentColors[inv.payment_status] || "")}>
                            {inv.payment_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                          </span>
                          {inv.tenant_id && hospitalNames[inv.tenant_id] && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {hospitalNames[inv.tenant_id]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold flex items-center gap-0.5">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {(inv.total || 0).toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{inv.invoice_id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono">{selected.invoice_id}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selected.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.created_at ? new Date(selected.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""}
                  </p>
                </div>
                <Badge className={cn("text-xs", paymentColors[selected.payment_status] || "")}>
                  {selected.payment_status}
                </Badge>
              </div>

              {/* Line items */}
              {selected.items && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Items</p>
                  {(selected.items as { description: string; amount: number; quantity?: number }[]).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                      <div>
                        <p>{item.description}</p>
                        {item.quantity && item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        )}
                      </div>
                      <p className="font-medium flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {(item.amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="space-y-1 pt-2 border-t">
                {(selected.tax || 0) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax</span>
                    <span>Rs {(selected.tax || 0).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {(selected.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>- Rs {(selected.discount || 0).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total</span>
                  <span className="flex items-center gap-0.5">
                    <IndianRupee className="w-4 h-4" />
                    {(selected.total || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setPrintInvoice(selected)
                  setReadyToPrint(true)
                }}
              >
                <Printer className="w-4 h-4" /> Print Invoice
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden print portal */}
      {printInvoice &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
            <div ref={printRef}>
              <PrintLayout
                tenant={printTenant}
                title="Invoice"
                subtitle={printInvoice.invoice_id}
              >
                <InvoicePrint invoice={printInvoice} />
              </PrintLayout>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
