"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { useAdmissions } from "@/hooks/use-admissions"
import { useWardBeds } from "@/hooks/use-ward-beds"
import { formatDate, getTodayIST } from "@/lib/utils/date"
import { humanizeStatus, statusColors } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewToggle } from "@/components/ui/view-toggle"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Activity,
  ArrowRightLeft,
  BedDouble,
  CheckCircle2,
  Clock,
  Eye,
  LogOut,
  MoreVertical,
  Phone,
  Receipt,
  Search,
  Stethoscope,
  TrendingUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { BedMap } from "@/components/ipd/bed-map"
import { TransferDialog } from "@/components/ipd/transfer-dialog"
import { DischargeDialog } from "@/components/ipd/discharge-dialog"
import { NursingNotesPanel } from "@/components/ipd/nursing-notes-panel"
import { DailyChargesPanel } from "@/components/ipd/daily-charges-panel"
import { AdmissionDetail } from "@/components/ipd/admission-detail"
import type { Admission } from "@/types/database"
import type { ViewMode } from "@/components/ui/view-toggle"

// ─── Helpers ───

function getDaysStayed(adm: Admission) {
  const start = adm.admission_date
    ? new Date(adm.admission_date)
    : adm.created_at ? new Date(adm.created_at) : new Date()
  const end = adm.actual_discharge ? new Date(adm.actual_discharge) : new Date()
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getWardBadgeColor(ward: string) {
  const w = ward?.toLowerCase() || ""
  if (w.includes("icu")) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  if (w.includes("private")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
  if (w.includes("semi")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
  if (w.includes("maternity")) return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
  if (w.includes("pediatric")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
  if (w.includes("surgical")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
}

function getWardAccent(ward: string) {
  const w = ward?.toLowerCase() || ""
  if (w.includes("icu")) return "from-red-500 to-rose-600"
  if (w.includes("private")) return "from-purple-500 to-indigo-600"
  if (w.includes("semi")) return "from-blue-500 to-cyan-600"
  if (w.includes("maternity")) return "from-pink-500 to-rose-500"
  if (w.includes("pediatric")) return "from-emerald-500 to-teal-600"
  if (w.includes("surgical")) return "from-amber-500 to-orange-600"
  return "from-blue-500 to-indigo-600"
}

function getWardAvatarColor(ward: string) {
  const w = ward?.toLowerCase() || ""
  if (w.includes("icu")) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-200/50"
  if (w.includes("private")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-purple-200/50"
  if (w.includes("semi")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-200/50"
  if (w.includes("maternity")) return "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 ring-pink-200/50"
  if (w.includes("pediatric")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-200/50"
  if (w.includes("surgical")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-amber-200/50"
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-200/50"
}

// ─── Ward Breakdown Bar ───

function WardBreakdownBar({ admissions }: { admissions: Admission[] }) {
  const wardCounts: Record<string, number> = {}
  const admitted = admissions.filter((a) => a.status === "admitted")
  admitted.forEach((a) => {
    const w = a.ward || "Other"
    wardCounts[w] = (wardCounts[w] || 0) + 1
  })
  const total = admitted.length
  if (total === 0) return null

  const wardColors: Record<string, string> = {}
  Object.keys(wardCounts).forEach((w) => {
    const wl = w.toLowerCase()
    if (wl.includes("icu")) wardColors[w] = "bg-red-500"
    else if (wl.includes("private")) wardColors[w] = "bg-purple-500"
    else if (wl.includes("semi")) wardColors[w] = "bg-blue-500"
    else if (wl.includes("maternity")) wardColors[w] = "bg-pink-500"
    else if (wl.includes("pediatric")) wardColors[w] = "bg-emerald-500"
    else if (wl.includes("surgical")) wardColors[w] = "bg-amber-500"
    else wardColors[w] = "bg-indigo-500"
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ward Distribution</p>
        <p className="text-[10px] text-muted-foreground">{total} patients</p>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-muted/30">
        {Object.entries(wardCounts).map(([ward, count], i) => (
          <Tooltip key={ward}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                className={cn("h-full", wardColors[ward], i === 0 && "rounded-l-full", i === Object.keys(wardCounts).length - 1 && "rounded-r-full")}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              {ward}: {count} ({Math.round((count / total) * 100)}%)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(wardCounts).map(([ward, count]) => (
          <div key={ward} className="flex items-center gap-1.5 text-[10px]">
            <div className={cn("w-2 h-2 rounded-full", wardColors[ward])} />
            <span className="text-muted-foreground">{ward}</span>
            <span className="font-bold">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Occupancy Ring ───

function OccupancyRing({ occupied, total }: { occupied: number; total: number }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const color = pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e"

  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <motion.circle
          cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold">{pct}%</span>
        <span className="text-[9px] text-muted-foreground">occupied</span>
      </div>
    </div>
  )
}

// ─── Patient Card ───

function PatientCard({
  adm,
  onClick,
  onAction,
}: {
  adm: Admission
  onClick: () => void
  onAction: (action: string) => void
}) {
  const days = getDaysStayed(adm)
  const isAdmitted = adm.status === "admitted"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="glass-card rounded-2xl cursor-pointer group transition-all hover:shadow-xl hover:shadow-primary/5 relative overflow-hidden"
    >
      {/* Ward gradient accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r", getWardAccent(adm.ward || ""))} />
      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-4 pt-5 relative">
        <div className="flex items-start gap-3">
          {/* Ward-colored avatar */}
          <div className="relative">
            <Avatar className={cn("w-12 h-12 ring-2", getWardAvatarColor(adm.ward || ""))}>
              <AvatarFallback className={cn("text-sm font-bold", getWardAvatarColor(adm.ward || ""))}>
                {getInitials(adm.patient_name || "P")}
              </AvatarFallback>
            </Avatar>
            {isAdmitted && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate text-foreground">{adm.patient_name}</h4>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{adm.patient_phone}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onAction("detail")}>
                    <Eye className="w-4 h-4 mr-2 text-purple-500" /> View Details
                  </DropdownMenuItem>
                  {isAdmitted && (
                    <>
                      <DropdownMenuItem onClick={() => onAction("notes")}>
                        <Activity className="w-4 h-4 mr-2 text-teal-500" /> Nursing Notes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction("charges")}>
                        <Receipt className="w-4 h-4 mr-2 text-orange-500" /> Daily Charges
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction("transfer")}>
                        <ArrowRightLeft className="w-4 h-4 mr-2 text-blue-500" /> Transfer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAction("discharge")}>
                        <LogOut className="w-4 h-4 mr-2 text-green-500" /> Discharge
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2.5 py-1.5">
            <BedDouble className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
            <span className="text-xs font-semibold truncate">{adm.bed_number}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2.5 py-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
            <span className="text-xs truncate">{adm.doctor_name || "\u2014"}</span>
          </div>
        </div>

        {adm.diagnosis && (
          <div className="mt-2.5 bg-muted/20 rounded-lg px-2.5 py-1.5">
            <p className="text-[11px] text-muted-foreground line-clamp-1 italic">{adm.diagnosis}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={cn("text-[10px] font-medium", getWardBadgeColor(adm.ward || ""))}>
              {adm.ward}
            </Badge>
            <Badge variant="secondary" className={cn(
              "text-[10px] font-mono font-bold",
              days >= 7
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : days >= 3
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : ""
            )}>
              <Clock className="w-2.5 h-2.5 mr-0.5" />
              {days}d
            </Badge>
          </div>
          <Badge variant="secondary" className={cn(
            "text-[10px] font-medium",
            statusColors[adm.status] || "",
            isAdmitted && "ring-1 ring-orange-200/50 dark:ring-orange-800/30"
          )}>
            {isAdmitted && <div className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
            {humanizeStatus(adm.status)}
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ───

export default function AdmissionsPage() {
  const { activeTenantId: tenantId } = useBranch()
  const { data: session } = useSession()
  const userName = (session?.user as { name?: string })?.name || "Staff"

  const [statusFilter, setStatusFilter] = useState("admitted")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("table")

  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showDischarge, setShowDischarge] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showCharges, setShowCharges] = useState(false)

  const { admissions, isLoading, mutate } = useAdmissions(tenantId, statusFilter)
  const { wards, bedMap, totalBeds, occupiedBeds } = useWardBeds(tenantId)

  const filtered = admissions.filter((a) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.patient_name?.toLowerCase().includes(q) ||
      a.patient_phone?.toLowerCase().includes(q) ||
      a.admission_id?.toLowerCase().includes(q) ||
      a.bed_number?.toLowerCase().includes(q)
    )
  })

  const admittedCount = admissions.filter((a) => a.status === "admitted").length
  const today = getTodayIST()
  const dischargedToday = admissions.filter((a) => a.status === "discharged" && a.actual_discharge === today).length
  const transfersToday = admissions.filter((a) => {
    const history = a.transfer_history || []
    return history.some((t) => t.transferred_at.startsWith(today))
  }).length
  const avgStay = admittedCount > 0
    ? Math.round(admissions.filter((a) => a.status === "admitted").reduce((s, a) => s + getDaysStayed(a), 0) / admittedCount)
    : 0

  const openDialog = (adm: Admission, dialog: string) => {
    setSelectedAdmission(adm)
    if (dialog === "detail") setShowDetail(true)
    else if (dialog === "discharge") setShowDischarge(true)
    else if (dialog === "transfer") setShowTransfer(true)
    else if (dialog === "notes") setShowNotes(true)
    else if (dialog === "charges") setShowCharges(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ─── Premium Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl gradient-orange flex items-center justify-center text-white">
                <BedDouble className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Inpatient Management</h1>
                  {admittedCount > 0 && (
                    <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2">
                      {admittedCount} admitted
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage admitted patients, beds, and discharges
                </p>
              </div>
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} options={["table", "grid"]} />
          </div>
        </motion.div>

        {/* ─── Stats Dashboard ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <BedDouble className="w-4 h-4" />, label: "Admitted", value: admittedCount, sub: "currently in-hospital", color: "orange", gradient: "from-orange-500/15 to-amber-500/5" },
                { icon: <TrendingUp className="w-4 h-4" />, label: "Avg Stay", value: avgStay > 0 ? `${avgStay}d` : "\u2014", sub: "days per patient", color: "purple", gradient: "from-purple-500/15 to-violet-500/5" },
                { icon: <CheckCircle2 className="w-4 h-4" />, label: "Discharged", value: dischargedToday, sub: "today", color: "green", gradient: "from-green-500/15 to-emerald-500/5" },
                { icon: <ArrowRightLeft className="w-4 h-4" />, label: "Transfers", value: transfersToday, sub: "today", color: "blue", gradient: "from-blue-500/15 to-cyan-500/5" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="glass-card rounded-2xl p-4 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", stat.gradient)} />
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-current/5 to-transparent rounded-bl-[80px]" />
                  <div className="relative">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <div className={cn(`text-${stat.color}-500`)}>{stat.icon}</div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <motion.p
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 + 0.2, type: "spring", stiffness: 200 }}
                      className="text-3xl font-black text-foreground tracking-tight"
                    >
                      {stat.value}
                    </motion.p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium">{stat.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Ward breakdown bar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-4"
            >
              <WardBreakdownBar admissions={admissions} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center min-w-[170px] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent" />
            <div className="relative">
              <OccupancyRing occupied={occupiedBeds} total={totalBeds} />
              <p className="text-xs font-semibold text-muted-foreground mt-2 text-center">{occupiedBeds}/{totalBeds} beds</p>
              <p className="text-[9px] text-muted-foreground/50 mt-0.5 text-center">
                {totalBeds - occupiedBeds} available
              </p>
            </div>
          </motion.div>
        </div>

        {/* ─── Bed Map View ─── */}
        <AnimatePresence mode="wait">
          {viewMode === "grid" && (
            <motion.div key="bedmap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <BedMap
                wards={wards}
                bedMap={bedMap}
                totalBeds={totalBeds}
                occupiedBeds={occupiedBeds}
                onBedClick={(_wardName, bed) => {
                  if (bed.status === "occupied" && bed.admission) {
                    openDialog(bed.admission, "detail")
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Cards View ─── */}
        <AnimatePresence mode="wait">
          {viewMode === "table" && (
            <motion.div key="cards" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
              {/* Search & Filter */}
              <div className="glass rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <Input
                    className="pl-10 bg-muted/30 border-transparent focus:border-primary/30 rounded-xl"
                    placeholder="Search by patient, bed, or admission ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] rounded-xl bg-muted/30 border-transparent">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="admitted">Admitted</SelectItem>
                    <SelectItem value="discharged">Discharged</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Patient Cards */}
              {filtered.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl py-16 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <BedDouble className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No admissions found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {searchQuery ? "Try a different search term" : "Admitted patients will appear here"}
                  </p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((adm) => (
                      <PatientCard
                        key={adm.admission_id}
                        adm={adm}
                        onClick={() => openDialog(adm, "detail")}
                        onAction={(action) => openDialog(adm, action)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                Showing {filtered.length} of {admissions.length} admissions
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Dialogs ─── */}
        <AdmissionDetail
          admission={selectedAdmission}
          open={showDetail}
          onClose={() => { setShowDetail(false); setSelectedAdmission(null) }}
          tenantId={tenantId}
        />
        <DischargeDialog
          admission={selectedAdmission}
          tenantId={tenantId}
          open={showDischarge}
          onClose={() => { setShowDischarge(false); setSelectedAdmission(null) }}
          onDischarged={mutate}
          userName={userName}
        />
        <TransferDialog
          admission={selectedAdmission}
          tenantId={tenantId}
          open={showTransfer}
          onClose={() => { setShowTransfer(false); setSelectedAdmission(null) }}
          onTransferred={mutate}
          userName={userName}
        />
        <NursingNotesPanel
          admission={selectedAdmission}
          open={showNotes}
          onClose={() => { setShowNotes(false); setSelectedAdmission(null) }}
          onUpdated={mutate}
          userName={userName}
        />
        <DailyChargesPanel
          admission={selectedAdmission}
          open={showCharges}
          onClose={() => { setShowCharges(false); setSelectedAdmission(null) }}
          onUpdated={mutate}
        />
      </div>
    </TooltipProvider>
  )
}
