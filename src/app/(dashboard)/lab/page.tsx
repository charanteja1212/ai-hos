"use client"

import { useState, useCallback } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLabOrders } from "@/hooks/use-lab-orders"
import { formatDate } from "@/lib/utils/date"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/reception/stat-card"
import { StatusPipeline } from "@/components/ui/status-pipeline"
import { ViewToggle } from "@/components/ui/view-toggle"
import { KanbanColumn } from "@/components/pharmacy/kanban-column"
import { LabKanbanCard } from "@/components/lab/lab-kanban-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TestTube,
  Search,
  MoreVertical,
  Clock,
  CheckCircle2,
  Loader2,
  Beaker,
  FileText,
  FlaskConical,
  Download,
} from "lucide-react"
import { useTenant } from "@/hooks/use-tenant"
import { PrintButton } from "@/components/print/print-button"
import { PrintLayout } from "@/components/print/print-layout"
import { LabReportPrint } from "@/components/print/lab-report-print"
import { createNotification } from "@/lib/notifications"
import type { LabOrder } from "@/types/database"
import type { ViewMode } from "@/components/ui/view-toggle"
import { humanizeStatus, statusColors, formatPhone } from "@/lib/utils/format"

const LAB_STEPS = ["Ordered", "Collected", "Processing", "Completed"]
function getLabStep(status: string): number {
  const map: Record<string, number> = { ordered: 0, sample_collected: 1, processing: 2, completed: 3 }
  return map[status] ?? 0
}

export default function LabPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null)
  const [resultValues, setResultValues] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { tenant } = useTenant(tenantId)

  const { orders, isLoading, mutate } = useLabOrders(tenantId, viewMode === "table" ? statusFilter : "all")
  const { orders: allOrders } = useLabOrders(tenantId, "all")

  const filterBySearch = (o: LabOrder) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      o.patient_name?.toLowerCase().includes(q) ||
      o.patient_phone?.toLowerCase().includes(q) ||
      o.order_id?.toLowerCase().includes(q) ||
      o.doctor_name?.toLowerCase().includes(q)
    )
  }

  const filtered = orders.filter(filterBySearch)
  const ordered = allOrders.filter((o) => o.status === "ordered" && filterBySearch(o))
  const collected = allOrders.filter((o) => o.status === "sample_collected" && filterBySearch(o))
  const processing = allOrders.filter((o) => o.status === "processing" && filterBySearch(o))
  const completed = allOrders.filter((o) => o.status === "completed" && filterBySearch(o))

  const orderedCount = allOrders.filter((o) => o.status === "ordered").length
  const inProgressCount = allOrders.filter((o) => o.status === "sample_collected" || o.status === "processing").length
  const completedCount = allOrders.filter((o) => o.status === "completed").length

  const updateStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      setUpdating(true)
      const supabase = createBrowserClient()

      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === "sample_collected") {
        updateData.sample_collected_at = new Date().toISOString()
      }

      try {
        const { error } = await supabase
          .from("lab_orders")
          .update(updateData)
          .eq("order_id", orderId)
          .eq("tenant_id", tenantId)

        if (error) throw error
        toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
        mutate()
      } catch (err) {
        console.error("[lab] Failed to update status:", err)
        toast.error("Failed to update status")
      } finally {
        setUpdating(false)
      }
    },
    [mutate, tenantId]
  )

  const handleKanbanAction = useCallback(
    (orderId: string, action: string) => {
      if (action === "collect") {
        updateStatus(orderId, "sample_collected")
      } else if (action === "results") {
        const order = allOrders.find((o) => o.order_id === orderId)
        if (order) {
          setSelectedOrder(order)
          const vals: Record<string, string> = {}
          order.tests?.forEach((t) => { vals[t.test_name] = "" })
          setResultValues(vals)
        }
      }
    },
    [updateStatus, allOrders]
  )

  const submitResults = useCallback(async () => {
    if (!selectedOrder) return
    setUpdating(true)
    const supabase = createBrowserClient()

    try {
      const results: Record<string, unknown> = {}
      selectedOrder.tests?.forEach((test) => {
        if (resultValues[test.test_name]) {
          results[test.test_name] = resultValues[test.test_name]
        }
      })

      const updatedTests = selectedOrder.tests?.map((test) => ({
        ...test,
        status: resultValues[test.test_name] ? "completed" : test.status,
        result: resultValues[test.test_name] || undefined,
      }))

      const allComplete = updatedTests?.every((t) => t.status === "completed")

      const { error } = await supabase
        .from("lab_orders")
        .update({
          results,
          tests: updatedTests,
          status: allComplete ? "completed" : "processing",
          results_uploaded_at: new Date().toISOString(),
        })
        .eq("order_id", selectedOrder.order_id)
        .eq("tenant_id", tenantId)

      if (error) throw error

      // Auto-generate lab invoice when all tests complete (idempotent — uses order_id)
      if (allComplete) {
        const testNames = (selectedOrder.tests || []).map(t => t.test_name)
        const { data: testPriceData } = await supabase.from("lab_tests")
          .select("test_name, price").eq("tenant_id", tenantId)
          .in("test_name", testNames)
        const priceMap: Record<string, number> = {}
        ;(testPriceData || []).forEach((t: { test_name: string; price: number }) => {
          priceMap[t.test_name] = t.price
        })
        const invoiceItems = testNames.map(name => ({
          description: name,
          amount: priceMap[name] || 0,
          quantity: 1,
        }))
        const labTotal = invoiceItems.reduce((s, i) => s + i.amount, 0)
        if (labTotal > 0) {
          const invoiceId = `INV-L-${selectedOrder.order_id}`

          // Pre-check: skip if invoice already exists (idempotency guard)
          const { data: existingInv } = await supabase
            .from("invoices")
            .select("invoice_id")
            .eq("invoice_id", invoiceId)
            .maybeSingle()

          if (!existingInv) {
            const { error: invError } = await supabase.from("invoices").insert({
              invoice_id: invoiceId,
              tenant_id: tenantId,
              patient_phone: selectedOrder.patient_phone,
              patient_name: selectedOrder.patient_name,
              type: "lab",
              items: invoiceItems,
              subtotal: labTotal,
              tax: 0,
              discount: 0,
              total: labTotal,
              payment_status: "unpaid",
            })
            if (invError) {
              console.error("Lab invoice creation failed:", invError)
              toast.error("Results saved but invoice creation failed")
            }
          }
        }
      }

      // Notify doctor when all results are complete
      if (allComplete) {
        createNotification({
          tenantId,
          type: "lab_completed",
          title: "Lab results ready",
          message: `Results for ${selectedOrder.patient_name} are complete`,
          targetRole: "DOCTOR",
          targetUserId: selectedOrder.doctor_id,
          referenceId: selectedOrder.order_id,
          referenceType: "lab_order",
        })
      }

      toast.success("Results saved")
      setSelectedOrder(null)
      setResultValues({})
      mutate()
    } catch (err) {
      console.error("[lab] Failed to save results:", err)
      toast.error("Failed to save results")
    } finally {
      setUpdating(false)
    }
  }, [selectedOrder, resultValues, mutate, tenantId])

  const exportCSV = useCallback(() => {
    if (allOrders.length === 0) {
      toast.error("No data to export")
      return
    }
    setExporting(true)
    const rows: string[][] = [
      ["Order ID", "Date", "Patient Name", "Patient Phone", "Doctor", "Tests", "Status", "Results"],
    ]
    for (const o of allOrders) {
      const results = (o.results || {}) as Record<string, string>
      rows.push([
        o.order_id,
        o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN") : "",
        o.patient_name || "",
        o.patient_phone || "",
        o.doctor_name || "",
        (o.tests || []).map(t => t.test_name).join("; "),
        o.status,
        Object.entries(results).map(([k, v]) => `${k}: ${v}`).join("; "),
      ])
    }
    const csv = rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lab_orders_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Downloaded successfully")
    setExporting(false)
  }, [allOrders])

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Lab Management"
        subtitle="Lab orders, sample collection & results"
        action={
          <Button onClick={exportCSV} disabled={exporting} variant="outline" size="sm" className="gap-2 rounded-xl">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="New Orders" value={orderedCount} gradient="gradient-orange" icon={<Clock className="w-10 h-10" />} index={0} />
        <StatCard label="In Progress" value={inProgressCount} gradient="gradient-blue" icon={<FlaskConical className="w-10 h-10" />} index={1} />
        <StatCard label="Completed" value={completedCount} gradient="gradient-green" icon={<CheckCircle2 className="w-10 h-10" />} index={2} />
        <StatCard label="Total" value={allOrders.length} gradient="gradient-purple" icon={<TestTube className="w-10 h-10" />} index={3} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ViewToggle value={viewMode} onChange={setViewMode} options={["board", "table"]} />
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 input-focus-glow"
            placeholder="Search patient, doctor, or order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {viewMode === "table" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="sample_collected">Sample Collected</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {viewMode === "board" && (
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-10 rounded-xl" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-32 rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KanbanColumn
              title="Ordered"
              count={ordered.length}
              dotColor="bg-amber-500"
              headerBg="bg-amber-50 dark:bg-amber-900/10"
              countBg="bg-amber-100 dark:bg-amber-900/30"
              countText="text-amber-700 dark:text-amber-300"
              emptyIcon={<Clock className="w-8 h-8" />}
              emptyTitle="No new orders"
              emptyDescription="Orders will appear here"
            >
              <AnimatePresence mode="popLayout">
                {ordered.map((order) => (
                  <LabKanbanCard key={order.order_id} order={order} onAction={handleKanbanAction} onSelect={(o) => {
                    setSelectedOrder(o); setResultValues({})
                  }} />
                ))}
              </AnimatePresence>
            </KanbanColumn>

            <KanbanColumn
              title="Collected"
              count={collected.length}
              dotColor="bg-blue-500"
              headerBg="bg-blue-50 dark:bg-blue-900/10"
              countBg="bg-blue-100 dark:bg-blue-900/30"
              countText="text-blue-700 dark:text-blue-300"
              emptyIcon={<Beaker className="w-8 h-8" />}
              emptyTitle="No samples"
              emptyDescription="Collected samples appear here"
            >
              <AnimatePresence mode="popLayout">
                {collected.map((order) => (
                  <LabKanbanCard key={order.order_id} order={order} onAction={handleKanbanAction} onSelect={(o) => {
                    setSelectedOrder(o)
                    const vals: Record<string, string> = {}
                    o.tests?.forEach((t) => { vals[t.test_name] = "" })
                    setResultValues(vals)
                  }} />
                ))}
              </AnimatePresence>
            </KanbanColumn>

            <KanbanColumn
              title="Processing"
              count={processing.length}
              dotColor="bg-purple-500 animate-pulse"
              headerBg="bg-purple-50 dark:bg-purple-900/10"
              countBg="bg-purple-100 dark:bg-purple-900/30"
              countText="text-purple-700 dark:text-purple-300"
              emptyIcon={<FlaskConical className="w-8 h-8" />}
              emptyTitle="Nothing processing"
              emptyDescription="In-progress tests appear here"
            >
              <AnimatePresence mode="popLayout">
                {processing.map((order) => (
                  <LabKanbanCard key={order.order_id} order={order} onAction={handleKanbanAction} onSelect={(o) => {
                    setSelectedOrder(o)
                    const vals: Record<string, string> = {}
                    o.tests?.forEach((t) => { vals[t.test_name] = "" })
                    setResultValues(vals)
                  }} />
                ))}
              </AnimatePresence>
            </KanbanColumn>

            <KanbanColumn
              title="Completed"
              count={completed.length}
              dotColor="bg-green-500"
              headerBg="bg-green-50 dark:bg-green-900/10"
              countBg="bg-green-100 dark:bg-green-900/30"
              countText="text-green-700 dark:text-green-300"
              emptyIcon={<CheckCircle2 className="w-8 h-8" />}
              emptyTitle="No completed"
              emptyDescription="Completed orders appear here"
            >
              <AnimatePresence mode="popLayout">
                {completed.map((order) => (
                  <LabKanbanCard key={order.order_id} order={order} onSelect={(o) => {
                    setSelectedOrder(o); setResultValues({})
                  }} />
                ))}
              </AnimatePresence>
            </KanbanColumn>
          </div>
        )
      )}

      {viewMode === "table" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                        <TestTube className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      </motion.div>
                      <p className="font-medium">No lab orders found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Orders will appear here when created</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order, idx) => (
                    <motion.tr
                      key={order.order_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{order.patient_name}</p>
                          <p className="text-xs text-muted-foreground">{formatPhone(order.patient_phone)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.doctor_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {order.tests?.slice(0, 3).map((test, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {test.test_name}
                            </Badge>
                          ))}
                          {order.tests && order.tests.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{order.tests.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPipeline steps={LAB_STEPS} currentStep={getLabStep(order.status)} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.created_at ? formatDate(order.created_at.split("T")[0]) : "\u2014"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {order.status === "ordered" && (
                              <DropdownMenuItem onClick={() => updateStatus(order.order_id, "sample_collected")} disabled={updating}>
                                <Beaker className="w-4 h-4 mr-2 text-blue-500" />
                                Collect Sample
                              </DropdownMenuItem>
                            )}
                            {(order.status === "sample_collected" || order.status === "processing") && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                const vals: Record<string, string> = {}
                                order.tests?.forEach((t) => { vals[t.test_name] = "" })
                                setResultValues(vals)
                              }}>
                                <FileText className="w-4 h-4 mr-2 text-green-500" />
                                Enter Results
                              </DropdownMenuItem>
                            )}
                            {order.status === "completed" && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setResultValues({})
                              }}>
                                <FileText className="w-4 h-4 mr-2 text-purple-500" />
                                View Results
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <PremiumDialog
        open={!!selectedOrder}
        onOpenChange={() => { setSelectedOrder(null); setResultValues({}) }}
        title={selectedOrder?.status === "completed" ? "Lab Results" : "Enter Results"}
        subtitle="Test results and sample tracking"
        icon={<FlaskConical className="w-5 h-5" />}
        gradient="bg-gradient-to-r from-purple-600 to-indigo-600"
      >
          {selectedOrder && (
            <div className="space-y-4">
              <StatusPipeline steps={LAB_STEPS} currentStep={getLabStep(selectedOrder.status)} />

              <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                <div className="flex justify-between">
                  <p className="font-semibold">{selectedOrder.patient_name}</p>
                  <Badge variant="secondary" className={statusColors[selectedOrder.status] || ""}>
                    {humanizeStatus(selectedOrder.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Doctor: {selectedOrder.doctor_name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.order_id}</p>
              </div>

              <div className="space-y-3">
                {selectedOrder.tests?.map((test, idx) => (
                  <motion.div
                    key={test.test_name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {idx + 1}
                      </div>
                      <Label className="text-sm font-medium">{test.test_name}</Label>
                      <Badge variant={test.status === "completed" ? "default" : "outline"} className="text-[10px] ml-auto">
                        {humanizeStatus(test.status)}
                      </Badge>
                    </div>
                    {selectedOrder.status === "completed" ? (
                      <div className="px-3 py-2 rounded-lg bg-muted/30 text-sm ml-8">
                        {selectedOrder.results?.[test.test_name] as string || "No result"}
                      </div>
                    ) : (
                      <Input
                        className="ml-8"
                        placeholder={`Enter result for ${test.test_name}`}
                        value={resultValues[test.test_name] || ""}
                        onChange={(e) => setResultValues({ ...resultValues, [test.test_name]: e.target.value })}
                      />
                    )}
                  </motion.div>
                ))}
              </div>

              {selectedOrder.status !== "completed" ? (
                <Button onClick={submitResults} disabled={updating} className="w-full">
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Save Results
                </Button>
              ) : (
                <PrintButton
                  documentTitle={`Lab-${selectedOrder.order_id}`}
                  label="Print Lab Report"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                >
                  <PrintLayout tenant={tenant} title="Lab Report" subtitle={selectedOrder.order_id}>
                    <LabReportPrint order={selectedOrder} />
                  </PrintLayout>
                </PrintButton>
              )}
            </div>
          )}
      </PremiumDialog>
    </div>
  )
}
