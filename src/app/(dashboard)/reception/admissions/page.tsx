"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { useAdmissions } from "@/hooks/use-admissions"
import { useWardBeds } from "@/hooks/use-ward-beds"
import { formatDate, getTodayIST } from "@/lib/utils/date"
import { humanizeStatus, statusColors } from "@/lib/utils/format"
import { StatCard } from "@/components/reception/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewToggle } from "@/components/ui/view-toggle"
import { motion } from "framer-motion"
import {
  Activity,
  ArrowRightLeft,
  BedDouble,
  Calendar,
  CheckCircle2,
  Eye,
  LogOut,
  MoreVertical,
  Receipt,
  Users,
} from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { BedMap } from "@/components/ipd/bed-map"
import { TransferDialog } from "@/components/ipd/transfer-dialog"
import { DischargeDialog } from "@/components/ipd/discharge-dialog"
import { NursingNotesPanel } from "@/components/ipd/nursing-notes-panel"
import { DailyChargesPanel } from "@/components/ipd/daily-charges-panel"
import { AdmissionDetail } from "@/components/ipd/admission-detail"
import type { Admission } from "@/types/database"
import type { ViewMode } from "@/components/ui/view-toggle"


function getDaysStayed(adm: Admission) {
  const start = adm.admission_date
    ? new Date(adm.admission_date)
    : adm.created_at ? new Date(adm.created_at) : new Date()
  const end = adm.actual_discharge ? new Date(adm.actual_discharge) : new Date()
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function AdmissionsPage() {
  const { activeTenantId: tenantId } = useBranch()
  const { data: session } = useSession()
  const userName = (session?.user as { name?: string })?.name || "Staff"

  const [statusFilter, setStatusFilter] = useState("admitted")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("table")

  // Dialog states
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

  const openDialog = (adm: Admission, dialog: "detail" | "discharge" | "transfer" | "notes" | "charges") => {
    setSelectedAdmission(adm)
    if (dialog === "detail") setShowDetail(true)
    else if (dialog === "discharge") setShowDischarge(true)
    else if (dialog === "transfer") setShowTransfer(true)
    else if (dialog === "notes") setShowNotes(true)
    else if (dialog === "charges") setShowCharges(true)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<BedDouble className="w-6 h-6" />}
        gradient="gradient-orange"
        title="Inpatient Management"
        subtitle="Manage admitted patients, beds, and discharges"
        action={
          <ViewToggle value={viewMode} onChange={setViewMode} options={["table", "grid"]} />
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 stagger-children">
        <StatCard
          label="Currently Admitted"
          value={admittedCount}
          gradient="gradient-orange"
          icon={<BedDouble className="w-10 h-10" />}
          index={0}
        />
        <StatCard
          label="Bed Occupancy"
          value={totalBeds > 0 ? `${Math.round((occupiedBeds / totalBeds) * 100)}%` : "—"}
          subtitle={`${occupiedBeds}/${totalBeds} beds`}
          gradient="gradient-blue"
          icon={<Users className="w-10 h-10" />}
          index={1}
        />
        <StatCard
          label="Avg Stay"
          value={avgStay > 0 ? `${avgStay}d` : "—"}
          gradient="gradient-purple"
          icon={<Calendar className="w-10 h-10" />}
          index={2}
        />
        <StatCard
          label="Discharged Today"
          value={dischargedToday}
          gradient="gradient-green"
          icon={<CheckCircle2 className="w-10 h-10" />}
          index={3}
        />
        <StatCard
          label="Transfers Today"
          value={transfersToday}
          gradient="gradient-teal"
          icon={<ArrowRightLeft className="w-10 h-10" />}
          index={4}
        />
      </div>

      {/* Bed Map View */}
      {viewMode === "grid" && (
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
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by patient, bed, or admission ID..."
            filters={
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-transparent border-0 shadow-none">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="admitted">Admitted</SelectItem>
                  <SelectItem value="discharged">Discharged</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          <div className="table-container">
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
                    <TableHead>Ward / Bed</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Admitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                          <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        </motion.div>
                        <p className="font-medium">No admissions found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Admitted patients will appear here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((adm) => (
                      <TableRow
                        key={adm.admission_id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openDialog(adm, "detail")}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{adm.patient_name}</p>
                            <p className="text-xs text-muted-foreground">{adm.patient_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{adm.ward}</p>
                            <p className="text-xs text-muted-foreground font-mono">{adm.bed_number}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{adm.doctor_name}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{adm.diagnosis || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {getDaysStayed(adm)}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {adm.admission_date ? formatDate(adm.admission_date.split("T")[0]) : adm.created_at ? formatDate(adm.created_at.split("T")[0]) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[adm.status] || ""}>
                            {humanizeStatus(adm.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => openDialog(adm, "detail")}>
                                <Eye className="w-4 h-4 mr-2 text-purple-500" />
                                View Details
                              </DropdownMenuItem>
                              {adm.status === "admitted" && (
                                <>
                                  <DropdownMenuItem onClick={() => openDialog(adm, "notes")}>
                                    <Activity className="w-4 h-4 mr-2 text-teal-500" />
                                    Nursing Notes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openDialog(adm, "charges")}>
                                    <Receipt className="w-4 h-4 mr-2 text-orange-500" />
                                    Daily Charges
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openDialog(adm, "transfer")}>
                                    <ArrowRightLeft className="w-4 h-4 mr-2 text-blue-500" />
                                    Transfer Ward
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openDialog(adm, "discharge")}>
                                    <LogOut className="w-4 h-4 mr-2 text-green-500" />
                                    Discharge
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Showing {filtered.length} of {admissions.length} admissions
          </p>
        </>
      )}

      {/* Dialogs */}
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
  )
}
