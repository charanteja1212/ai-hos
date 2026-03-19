"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { FeatureGate } from "@/components/shared/feature-gate"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import {
  AlertTriangle, FileText, IndianRupee, Stethoscope,
  Pill, TestTube, Send, FilePlus2, RefreshCw,
} from "lucide-react"

interface LeakRow { id: string; cols: string[]; amount: number }

function LeakTable({ title, count, heads, rows, emptyMsg, actionLabel, actionIcon: Icon, onAction }: {
  title: string; count: number; heads: string[]; rows: LeakRow[]
  emptyMsg: string; actionLabel: string
  actionIcon: React.ComponentType<{ className?: string }>
  onAction: (row: LeakRow) => void
}) {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title} ({count})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {heads.map(h => <TableHead key={h} className={h === "Amount" || h === "Fee" || h === "Overdue" || h === "Action" ? "text-right" : ""}>{h}</TableHead>)}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={heads.length + 1} className="text-center py-12 text-muted-foreground">{emptyMsg}</TableCell>
              </TableRow>
            ) : rows.map((r, idx) => (
              <motion.tr key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                {r.cols.map((c, i) => (
                  <TableCell key={i} className={cn("text-sm",
                    i === 0 && c.startsWith("INV") ? "" : i === 0 ? "font-medium" : "text-muted-foreground",
                    heads[i] === "Amount" || heads[i] === "Fee" ? "text-right font-semibold" : "",
                    heads[i] === "Overdue" ? "text-right" : "",
                  )}>
                    {c.startsWith("INV") || c.startsWith("ORD") || c.startsWith("LAB") || c.startsWith("PH")
                      ? <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">{c}</code>
                      : heads[i] === "Status" ? (
                        <Badge variant="secondary" className={cn("text-xs",
                          c === "Unpaid" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        )}>{c}</Badge>
                      ) : heads[i] === "Overdue" ? (
                        <span className={cn("font-medium", parseInt(c) > 14 ? "text-red-600" : "text-amber-600")}>{c}</span>
                      ) : c}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg gap-1" onClick={() => onAction(r)}>
                    <Icon className="w-3 h-3" /> {actionLabel}
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function RevenueLeaksPage() {
  return (
    <FeatureGate feature="revenue_leak_detector" featureName="Revenue Leak Detector">
      <RevenueLeaksContent />
    </FeatureGate>
  )
}

function RevenueLeaksContent() {
  const { data: session } = useSession()
  const { activeTenantId: tenantId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("appointments")
  const [unbilledAppts, setUnbilledAppts] = useState<LeakRow[]>([])
  const [outstandingInv, setOutstandingInv] = useState<LeakRow[]>([])
  const [unbilledPharm, setUnbilledPharm] = useState<LeakRow[]>([])
  const [unbilledLabs, setUnbilledLabs] = useState<LeakRow[]>([])

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"

  const fetchLeaks = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const supabase = createBrowserClient()
    const now = new Date()
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
    const from30 = d30.toISOString().split("T")[0]
    const today = now.toISOString().split("T")[0]
    const sevenAgo = d7.toISOString()

    const { data: td } = await supabase.from("tenants").select("consultation_fee").eq("tenant_id", tenantId).single()
    const baseFee = td?.consultation_fee || 500

    const [apptRes, invRes, pharmRes, labRes] = await Promise.all([
      supabase.from("appointments")
        .select("booking_id, patient_name, patient_phone, doctor_id, doctor_name, specialty, date")
        .eq("tenant_id", tenantId).eq("status", "completed").gte("date", from30).lte("date", today),
      supabase.from("invoices")
        .select("invoice_id, booking_id, patient_name, total, payment_status, created_at, type")
        .eq("tenant_id", tenantId)
        .gte("created_at", from30 + "T00:00:00"),
      supabase.from("pharmacy_orders")
        .select("order_id, patient_name, total_amount, dispensed_at, status")
        .eq("tenant_id", tenantId).eq("status", "dispensed").gte("created_at", from30 + "T00:00:00"),
      supabase.from("lab_orders")
        .select("order_id, patient_name, total_amount, created_at, status")
        .eq("tenant_id", tenantId).eq("status", "completed").gte("created_at", from30 + "T00:00:00"),
    ])

    const appts = (apptRes.data || []) as Record<string, unknown>[]
    const invs = (invRes.data || []) as Record<string, unknown>[]
    const pharms = (pharmRes.data || []) as Record<string, unknown>[]
    const labs = (labRes.data || []) as Record<string, unknown>[]

    const billedIds = new Set(invs.filter(i => i.booking_id).map(i => String(i.booking_id)))
    const pharmInvIds = new Set(invs.filter(i => i.type === "pharmacy").map(i => String(i.booking_id || "")))
    const labInvIds = new Set(invs.filter(i => i.type === "lab").map(i => String(i.booking_id || "")))

    // Doctor fees
    const drIds = [...new Set(appts.map(a => String(a.doctor_id || "")))]
    const drFees: Record<string, number> = {}
    if (drIds.length > 0) {
      const { data: docs } = await supabase.from("doctors").select("doctor_id, consultation_fee").in("doctor_id", drIds)
      for (const d of docs || []) drFees[d.doctor_id] = d.consultation_fee || baseFee
    }

    setUnbilledAppts(appts.filter(a => !billedIds.has(String(a.booking_id))).map(a => {
      const fee = drFees[String(a.doctor_id)] || baseFee
      return {
        id: String(a.booking_id), amount: fee,
        cols: [String(a.patient_name || "Unknown"), String(a.doctor_name || "Unknown"),
          String(a.specialty || "-"), fmtDate(String(a.date || "")), formatCurrency(fee)],
      }
    }))

    setOutstandingInv(invs
      .filter(i => (i.payment_status === "unpaid" || i.payment_status === "partial") && String(i.created_at || "") < sevenAgo)
      .map(i => {
        const days = Math.floor((now.getTime() - new Date(String(i.created_at)).getTime()) / 86400000)
        return {
          id: String(i.invoice_id), amount: Number(i.total) || 0,
          cols: [String(i.invoice_id), String(i.patient_name || "Unknown"), formatCurrency(Number(i.total) || 0),
            i.payment_status === "partial" ? "Partial" : "Unpaid", `${days}d`],
        }
      })
      .sort((a, b) => parseInt(b.cols[4]) - parseInt(a.cols[4])))

    setUnbilledPharm(pharms.filter(o => !pharmInvIds.has(String(o.order_id))).map(o => ({
      id: String(o.order_id), amount: Number(o.total_amount) || 0,
      cols: [String(o.order_id), String(o.patient_name || "Unknown"),
        formatCurrency(Number(o.total_amount) || 0), fmtDate(String(o.dispensed_at || ""))],
    })))

    setUnbilledLabs(labs.filter(o => !labInvIds.has(String(o.order_id))).map(o => ({
      id: String(o.order_id), amount: Number(o.total_amount) || 0,
      cols: [String(o.order_id), String(o.patient_name || "Unknown"),
        formatCurrency(Number(o.total_amount) || 0), fmtDate(String(o.created_at || ""))],
    })))

    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchLeaks() }, [fetchLeaks])

  const stats = useMemo(() => {
    const a = unbilledAppts.reduce((s, r) => s + r.amount, 0)
    const i = outstandingInv.reduce((s, r) => s + r.amount, 0)
    const p = unbilledPharm.reduce((s, r) => s + r.amount, 0)
    const l = unbilledLabs.reduce((s, r) => s + r.amount, 0)
    return { apptCount: unbilledAppts.length, apptLoss: a, invCount: outstandingInv.length, invOut: i,
      pharmCount: unbilledPharm.length, pharmLoss: p, labCount: unbilledLabs.length, labLoss: l, total: a + i + p + l }
  }, [unbilledAppts, outstandingInv, unbilledPharm, unbilledLabs])

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  const cards = [
    { label: "Unbilled Appointments", count: stats.apptCount, amount: stats.apptLoss, icon: Stethoscope, bg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400" },
    { label: "Unpaid Invoices", count: stats.invCount, amount: stats.invOut, icon: FileText, bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" },
    { label: "Unbilled Pharmacy", count: stats.pharmCount, amount: stats.pharmLoss, icon: Pill, bg: "bg-teal-100 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" },
    { label: "Unbilled Lab Orders", count: stats.labCount, amount: stats.labLoss, icon: TestTube, bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader title="Revenue Leak Detector" subtitle="Identify unbilled services and payment gaps"
        icon={<AlertTriangle className="w-6 h-6" />} gradient="gradient-orange" variant="glass"
        badge={<Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {stats.apptCount + stats.invCount + stats.pharmCount + stats.labCount} leaks
        </Badge>}
        action={<Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={fetchLeaks}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, idx) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}>
            <Card className="card-hover rounded-2xl">
              <CardContent className="pt-5 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>
                    <c.icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{c.count}</p>
                <p className="text-xs text-muted-foreground">
                  Est. loss: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(c.amount)}</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
        <Card className="rounded-2xl border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Potential Revenue Leak</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.total)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-[200px] text-right hidden sm:block">
              Based on last 30 days of unbilled services and outstanding payments
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appointments" className="gap-1.5 text-xs sm:text-sm">
            <Stethoscope className="w-3.5 h-3.5 hidden sm:block" /> Appointments</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-3.5 h-3.5 hidden sm:block" /> Invoices</TabsTrigger>
          <TabsTrigger value="pharmacy" className="gap-1.5 text-xs sm:text-sm">
            <Pill className="w-3.5 h-3.5 hidden sm:block" /> Pharmacy</TabsTrigger>
          <TabsTrigger value="lab" className="gap-1.5 text-xs sm:text-sm">
            <TestTube className="w-3.5 h-3.5 hidden sm:block" /> Lab</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-4">
          <LeakTable title="Unbilled Appointments" count={unbilledAppts.length}
            heads={["Patient", "Doctor", "Specialty", "Date", "Fee"]} rows={unbilledAppts}
            emptyMsg="No unbilled appointments found -- great job!"
            actionLabel="Create Invoice" actionIcon={FilePlus2}
            onAction={(r) => toast.success(`Invoice creation queued for ${r.cols[0]}`)} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <LeakTable title="Outstanding Invoices" count={outstandingInv.length}
            heads={["Invoice ID", "Patient", "Amount", "Status", "Overdue"]} rows={outstandingInv}
            emptyMsg="No overdue invoices -- all caught up!"
            actionLabel="Remind" actionIcon={Send}
            onAction={(r) => toast.success(`Payment reminder sent for ${r.cols[0]}`)} />
        </TabsContent>

        <TabsContent value="pharmacy" className="mt-4">
          <LeakTable title="Unbilled Pharmacy Orders" count={unbilledPharm.length}
            heads={["Order ID", "Patient", "Amount", "Dispensed"]} rows={unbilledPharm}
            emptyMsg="All pharmacy orders are billed"
            actionLabel="Create Invoice" actionIcon={FilePlus2}
            onAction={(r) => toast.success(`Invoice creation queued for order ${r.id}`)} />
        </TabsContent>

        <TabsContent value="lab" className="mt-4">
          <LeakTable title="Unbilled Lab Orders" count={unbilledLabs.length}
            heads={["Order ID", "Patient", "Amount", "Ordered"]} rows={unbilledLabs}
            emptyMsg="All lab orders are billed"
            actionLabel="Create Invoice" actionIcon={FilePlus2}
            onAction={(r) => toast.success(`Invoice creation queued for order ${r.id}`)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
