"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { usePharmacyOrders } from "@/hooks/use-pharmacy"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/reception/stat-card"
import { StatusPipeline } from "@/components/ui/status-pipeline"
import { KanbanColumn } from "@/components/pharmacy/kanban-column"
import { OrderKanbanCard } from "@/components/pharmacy/order-kanban-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  Pill,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"
import { createNotification } from "@/lib/notifications"
import type { PharmacyOrder } from "@/types/database"
import { buildInvoiceData, type TenantTaxConfig } from "@/lib/billing/tax"
import { humanizeStatus, statusColors, formatPhone } from "@/lib/utils/format"

const PHARMACY_STEPS = ["Pending", "Preparing", "Ready", "Dispensed"]
function getPharmacyStep(status: string): number {
  const map: Record<string, number> = { pending: 0, preparing: 1, ready: 2, dispensed: 3 }
  return map[status] ?? 0
}

export default function PharmacyPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<PharmacyOrder | null>(null)
  const [updating, setUpdating] = useState(false)

  const { orders: allOrders, isLoading, mutate } = usePharmacyOrders(tenantId, "all")

  const filterBySearch = (o: PharmacyOrder) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      o.patient_name?.toLowerCase().includes(q) ||
      o.patient_phone?.toLowerCase().includes(q) ||
      o.order_id?.toLowerCase().includes(q)
    )
  }

  const pending = allOrders.filter((o) => o.status === "pending" && filterBySearch(o))
  const preparing = allOrders.filter((o) => o.status === "preparing" && filterBySearch(o))
  const ready = allOrders.filter((o) => o.status === "ready" && filterBySearch(o))
  const dispensed = allOrders.filter((o) => o.status === "dispensed" && filterBySearch(o))

  const updateStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      setUpdating(true)
      const supabase = createBrowserClient()

      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === "dispensed") {
        updateData.dispensed_at = new Date().toISOString()
        updateData.prepared_by = user?.name || "Staff"
      }

      try {
        const { error } = await supabase
          .from("pharmacy_orders")
          .update(updateData)
          .eq("order_id", orderId)
          .eq("tenant_id", tenantId)

        if (error) throw error

        // Auto-generate pharmacy invoice on dispense (idempotent — uses order_id)
        if (newStatus === "dispensed") {
          const order = allOrders.find(o => o.order_id === orderId)
          if (order && order.total_amount > 0) {
            const invoiceId = `INV-P-${orderId}`

            // Pre-check: skip if invoice already exists (idempotency guard)
            const { data: existingInv } = await supabase
              .from("invoices")
              .select("invoice_id")
              .eq("invoice_id", invoiceId)
              .maybeSingle()

            if (!existingInv) {
              const items = (order.items || []).map(item => ({
                description: `${item.medicine_name} (${item.dosage}, ${item.frequency}, ${item.duration})`,
                amount: order.total_amount / (order.items?.length || 1),
                quantity: item.quantity ? parseInt(String(item.quantity)) || 1 : 1,
              }))
              // Fetch tenant GST config
              const { data: tenantConfig } = await supabase
                .from("tenants")
                .select("enable_gst, gst_percentage, gstin, hsn_code, state_code")
                .eq("tenant_id", tenantId)
                .single()
              const taxConfig: TenantTaxConfig | null = tenantConfig?.enable_gst
                ? tenantConfig as TenantTaxConfig
                : null
              const pharmInvoice = buildInvoiceData({
                invoice_id: invoiceId,
                tenant_id: tenantId,
                patient_phone: order.patient_phone || "",
                patient_name: order.patient_name,
                type: "pharmacy",
                items,
                payment_status: "unpaid",
              }, taxConfig)
              const { error: invError } = await supabase.from("invoices").insert(pharmInvoice)
              if (invError) {
                console.error("Pharmacy invoice creation failed:", invError)
                toast.error("Order dispensed but invoice creation failed")
              }
            }
          }
        }

        // Notify relevant roles
        const order = allOrders.find(o => o.order_id === orderId)
        if (order && newStatus === "ready") {
          createNotification({
            tenantId,
            type: "pharmacy_ready",
            title: "Medicine ready for pickup",
            message: `Order for ${order.patient_name} is ready`,
            targetRole: "RECEPTION",
            referenceId: orderId,
            referenceType: "pharmacy_order",
          })
        }
        if (order && newStatus === "dispensed") {
          createNotification({
            tenantId,
            type: "pharmacy_dispensed",
            title: "Medicine dispensed",
            message: `Order for ${order.patient_name} dispensed`,
            targetRole: "ADMIN",
            referenceId: orderId,
            referenceType: "pharmacy_order",
          })
        }

        toast.success(`Order ${newStatus}`)
        setSelectedOrder(null)
        mutate()
      } catch (err) {
        console.error("[pharmacy] Failed to update order:", err)
        toast.error("Failed to update order")
      } finally {
        setUpdating(false)
      }
    },
    [user, mutate, allOrders, tenantId]
  )

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Pharmacy"
        subtitle="Prescription orders & dispensing"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending" value={pending.length} gradient="gradient-orange" icon={<Clock className="w-10 h-10" />} index={0} />
        <StatCard label="Preparing" value={preparing.length} gradient="gradient-blue" icon={<Package className="w-10 h-10" />} index={1} />
        <StatCard label="Ready" value={ready.length} gradient="gradient-green" icon={<CheckCircle2 className="w-10 h-10" />} index={2} />
        <StatCard label="Total" value={allOrders.length} gradient="gradient-purple" icon={<ShoppingBag className="w-10 h-10" />} index={3} />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 input-focus-glow"
          placeholder="Search patient, phone, or order ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 rounded-xl" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-36 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Column */}
          <KanbanColumn
            title="Pending"
            count={pending.length}
            dotColor="bg-amber-500"
            headerBg="bg-amber-50 dark:bg-amber-900/10"
            countBg="bg-amber-100 dark:bg-amber-900/30"
            countText="text-amber-700 dark:text-amber-300"
            emptyIcon={<Clock className="w-8 h-8" />}
            emptyTitle="No pending orders"
            emptyDescription="New orders will appear here"
          >
            <AnimatePresence mode="popLayout">
              {pending.map((order) => (
                <OrderKanbanCard
                  key={order.order_id}
                  order={order}
                  onAdvance={updateStatus}
                  onSelect={setSelectedOrder}
                />
              ))}
            </AnimatePresence>
          </KanbanColumn>

          {/* Preparing Column */}
          <KanbanColumn
            title="Preparing"
            count={preparing.length}
            dotColor="bg-blue-500 animate-pulse"
            headerBg="bg-blue-50 dark:bg-blue-900/10"
            countBg="bg-blue-100 dark:bg-blue-900/30"
            countText="text-blue-700 dark:text-blue-300"
            emptyIcon={<Package className="w-8 h-8" />}
            emptyTitle="Nothing being prepared"
            emptyDescription="Start preparing from pending"
          >
            <AnimatePresence mode="popLayout">
              {preparing.map((order) => (
                <OrderKanbanCard
                  key={order.order_id}
                  order={order}
                  onAdvance={updateStatus}
                  onSelect={setSelectedOrder}
                />
              ))}
            </AnimatePresence>
          </KanbanColumn>

          {/* Ready Column */}
          <KanbanColumn
            title="Ready"
            count={ready.length}
            dotColor="bg-green-500"
            headerBg="bg-green-50 dark:bg-green-900/10"
            countBg="bg-green-100 dark:bg-green-900/30"
            countText="text-green-700 dark:text-green-300"
            emptyIcon={<CheckCircle2 className="w-8 h-8" />}
            emptyTitle="Nothing ready"
            emptyDescription="Ready orders appear here"
          >
            <AnimatePresence mode="popLayout">
              {ready.map((order) => (
                <OrderKanbanCard
                  key={order.order_id}
                  order={order}
                  onAdvance={updateStatus}
                  onSelect={setSelectedOrder}
                />
              ))}
            </AnimatePresence>
          </KanbanColumn>

          {/* Dispensed Column */}
          <KanbanColumn
            title="Dispensed"
            count={dispensed.length}
            dotColor="bg-gray-400"
            headerBg="bg-gray-50 dark:bg-gray-900/10"
            countBg="bg-gray-100 dark:bg-gray-900/30"
            countText="text-gray-700 dark:text-gray-300"
            emptyIcon={<ShoppingBag className="w-8 h-8" />}
            emptyTitle="No dispensed orders"
            emptyDescription="Completed orders appear here"
          >
            <AnimatePresence mode="popLayout">
              {dispensed.map((order) => (
                <OrderKanbanCard
                  key={order.order_id}
                  order={order}
                  onSelect={setSelectedOrder}
                />
              ))}
            </AnimatePresence>
          </KanbanColumn>
        </div>
      )}

      {/* Order Detail Dialog */}
      <PremiumDialog
        open={!!selectedOrder}
        onOpenChange={() => setSelectedOrder(null)}
        title="Order Details"
        subtitle="Prescription and dispensing status"
        icon={<Pill className="w-5 h-5" />}
        gradient="bg-gradient-to-r from-green-600 to-emerald-600"
      >
          {selectedOrder && (
            <div className="space-y-4">
              <StatusPipeline steps={PHARMACY_STEPS} currentStep={getPharmacyStep(selectedOrder.status)} />

              <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{selectedOrder.patient_name}</p>
                  <Badge variant="secondary" className={statusColors[selectedOrder.status] || ""}>
                    {humanizeStatus(selectedOrder.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatPhone(selectedOrder.patient_phone)}</p>
                <p className="text-sm text-muted-foreground">Doctor: {selectedOrder.doctor_name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.order_id}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Medicines</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.medicine_name}</p>
                          <p className="text-xs text-muted-foreground">{item.dosage} &mdash; {item.frequency}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.duration}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                {selectedOrder.status === "pending" && (
                  <Button className="flex-1" onClick={() => updateStatus(selectedOrder.order_id, "preparing")} disabled={updating}>
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
                    Start Preparing
                  </Button>
                )}
                {selectedOrder.status === "preparing" && (
                  <Button className="flex-1" onClick={() => updateStatus(selectedOrder.order_id, "ready")} disabled={updating}>
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Mark Ready
                  </Button>
                )}
                {selectedOrder.status === "ready" && (
                  <Button className="flex-1" onClick={() => updateStatus(selectedOrder.order_id, "dispensed")} disabled={updating}>
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
                    Dispense
                  </Button>
                )}
              </div>
            </div>
          )}
      </PremiumDialog>
    </div>
  )
}
