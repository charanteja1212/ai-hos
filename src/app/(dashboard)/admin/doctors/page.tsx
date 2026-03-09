"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Edit,
  Stethoscope,
  Loader2,
  Phone,
  Mail,
  UserCheck,
  UserX,
  CalendarOff,
  Clock,
  Sun,
  Coffee,
  Save,
  Copy,
  ChevronDown,
  RotateCcw,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { StatCard } from "@/components/reception/stat-card"

import type { Doctor } from "@/types/database"

const SPECIALTIES = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "ENT",
  "Gastroenterology",
  "Gynecology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Surgery",
  "Urology",
]

const SPECIALTY_GRADIENTS: Record<string, string> = {
  "Cardiology": "gradient-red",
  "Neurology": "gradient-purple",
  "Orthopedics": "gradient-orange",
  "Pediatrics": "gradient-green",
  "Surgery": "gradient-blue",
  "Dermatology": "gradient-teal",
  "Oncology": "gradient-red",
}

// ---------- Schedule Types & Helpers ----------

interface ScheduleRow {
  schedule_id?: string
  doctor_id: string
  tenant_id: string
  day_of_week: number
  session_number: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_working: boolean
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_hours: number
  max_daily_bookings: number
  is_active: boolean
}

interface DaySchedule {
  isWorking: boolean
  session1: { start: string; end: string; slotDuration: number }
  session2: { enabled: boolean; start: string; end: string; slotDuration: number }
}

type WeekSchedule = Record<number, DaySchedule>

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60]

const DEFAULT_DAY: DaySchedule = {
  isWorking: true,
  session1: { start: "10:00", end: "13:00", slotDuration: 20 },
  session2: { enabled: true, start: "14:00", end: "18:00", slotDuration: 20 },
}

const SCHED_TEMPLATES: Record<string, { label: string; config: DaySchedule }> = {
  full: { label: "Full Day (9AM–1PM + 2PM–6PM)", config: { isWorking: true, session1: { start: "09:00", end: "13:00", slotDuration: 20 }, session2: { enabled: true, start: "14:00", end: "18:00", slotDuration: 20 } } },
  morning: { label: "Morning Only (9AM–1PM)", config: { isWorking: true, session1: { start: "09:00", end: "13:00", slotDuration: 20 }, session2: { enabled: false, start: "14:00", end: "18:00", slotDuration: 20 } } },
  evening: { label: "Evening Only (4PM–9PM)", config: { isWorking: true, session1: { start: "16:00", end: "21:00", slotDuration: 20 }, session2: { enabled: false, start: "21:00", end: "21:00", slotDuration: 20 } } },
  extended: { label: "Extended (10AM–1PM + 3PM–9PM)", config: { isWorking: true, session1: { start: "10:00", end: "13:00", slotDuration: 20 }, session2: { enabled: true, start: "15:00", end: "21:00", slotDuration: 20 } } },
}

function fmt24to12(time: string): string {
  const [hStr, mStr] = time.split(":")
  const h = parseInt(hStr)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${mStr || "00"} ${ampm}`
}

function parseTimeToMinutes(time: string): number {
  const [hStr, mStr] = time.trim().split(":")
  return parseInt(hStr) * 60 + parseInt(mStr || "0")
}

function minutesBetween(start: string, end: string): number {
  return parseTimeToMinutes(end) - parseTimeToMinutes(start)
}

function rowsToWeek(rows: ScheduleRow[]): WeekSchedule {
  const week: WeekSchedule = {}
  for (let d = 0; d < 7; d++) {
    const dayRows = rows.filter((r) => r.day_of_week === d)
    const s1 = dayRows.find((r) => !r.session_number || r.session_number === 1)
    const s2 = dayRows.find((r) => r.session_number === 2)
    if (s1) {
      week[d] = {
        isWorking: s1.is_working !== false,
        session1: { start: s1.start_time.slice(0, 5), end: s1.end_time.slice(0, 5), slotDuration: s1.slot_duration_minutes || 20 },
        session2: { enabled: !!s2, start: s2 ? s2.start_time.slice(0, 5) : "14:00", end: s2 ? s2.end_time.slice(0, 5) : "18:00", slotDuration: s2 ? s2.slot_duration_minutes || 20 : 20 },
      }
    } else {
      week[d] = { ...DEFAULT_DAY, isWorking: d !== 0 }
    }
  }
  return week
}

function weekToRows(week: WeekSchedule, doctorId: string, tenantId: string): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (let d = 0; d < 7; d++) {
    const day = week[d]
    if (!day) continue
    rows.push({
      schedule_id: `SCH_${doctorId}_${d}_1`, doctor_id: doctorId, tenant_id: tenantId,
      day_of_week: d, session_number: 1, start_time: day.session1.start + ":00", end_time: day.session1.end + ":00",
      slot_duration_minutes: day.session1.slotDuration, is_working: day.isWorking,
      buffer_before_minutes: 0, buffer_after_minutes: 0, min_notice_hours: 1, max_daily_bookings: 0, is_active: true,
    })
    if (day.isWorking && day.session2.enabled) {
      rows.push({
        schedule_id: `SCH_${doctorId}_${d}_2`, doctor_id: doctorId, tenant_id: tenantId,
        day_of_week: d, session_number: 2, start_time: day.session2.start + ":00", end_time: day.session2.end + ":00",
        slot_duration_minutes: day.session2.slotDuration, is_working: true,
        buffer_before_minutes: 0, buffer_after_minutes: 0, min_notice_hours: 1, max_daily_bookings: 0, is_active: true,
      })
    }
  }
  return rows
}

// Moon icon
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

// Timeline Bar
function TimelineBar({ session1, session2 }: { session1: DaySchedule["session1"]; session2: DaySchedule["session2"] | null }) {
  const barStart = 8 * 60, barEnd = 22 * 60, total = barEnd - barStart
  const toP = (time: string) => Math.max(0, Math.min(100, ((parseTimeToMinutes(time) - barStart) / total) * 100))
  const s1L = toP(session1.start), s1W = toP(session1.end) - s1L
  const s2L = session2 ? toP(session2.start) : 0, s2W = session2 ? toP(session2.end) - s2L : 0
  const bL = toP(session1.end), bW = session2 ? toP(session2.start) - bL : 0
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  return (
    <div className="space-y-1">
      <div className="relative h-7 bg-muted/30 rounded-lg overflow-hidden border border-border/50">
        <div className="absolute top-0 bottom-0 bg-emerald-500/25 border-l-2 border-r-2 border-emerald-500/50" style={{ left: `${s1L}%`, width: `${s1W}%` }}>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">S1</span>
        </div>
        {session2 && bW > 0 && (
          <div className="absolute top-0 bottom-0 bg-amber-500/15 border-l border-r border-amber-500/30 border-dashed" style={{ left: `${bL}%`, width: `${bW}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-amber-600"><Coffee className="w-3 h-3" /></span>
          </div>
        )}
        {session2 && (
          <div className="absolute top-0 bottom-0 bg-blue-500/25 border-l-2 border-r-2 border-blue-500/50" style={{ left: `${s2L}%`, width: `${s2W}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-blue-700 dark:text-blue-400">S2</span>
          </div>
        )}
      </div>
      <div className="relative h-3">
        {hours.map((h) => (
          <span key={h} className="absolute text-[8px] text-muted-foreground/60 -translate-x-1/2" style={{ left: `${((h * 60 - barStart) / total) * 100}%` }}>
            {h > 12 ? `${h - 12}P` : h === 12 ? "12P" : `${h}A`}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DoctorsManagementPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [saving, setSaving] = useState(false)

  // Schedule editor state
  const [scheduleDoctor, setScheduleDoctor] = useState<Doctor | null>(null)
  const [schedWeek, setSchedWeek] = useState<WeekSchedule>({})
  const [schedSavedWeek, setSchedSavedWeek] = useState<WeekSchedule>({})
  const [schedDay, setSchedDay] = useState<number | null>(null)
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedSaving, setSchedSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState("")
  const [formSpecialty, setFormSpecialty] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPin, setFormPin] = useState("")
  const [formFee, setFormFee] = useState("200")
  const [formStatus, setFormStatus] = useState("active")

  const fetchDoctors = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name")
    if (data) setDoctors(data as Doctor[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchDoctors() }, [fetchDoctors])

  const filtered = doctors.filter((d) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.doctor_id.toLowerCase().includes(q)
  })

  const stats = useMemo(() => {
    const active = doctors.filter((d) => d.status === "active").length
    const onLeave = doctors.filter((d) => d.status === "on_leave").length
    const inactive = doctors.filter((d) => d.status === "inactive").length
    return { total: doctors.length, active, onLeave, inactive }
  }, [doctors])

  const resetForm = () => {
    setFormName("")
    setFormSpecialty("")
    setFormPhone("")
    setFormEmail("")
    setFormPin("")
    setFormFee("200")
    setFormStatus("active")
    setEditing(null)
  }

  const openEdit = (doc: Doctor) => {
    setEditing(doc)
    setFormName(doc.name)
    setFormSpecialty(doc.specialty)
    setFormPhone(doc.phone || "")
    setFormEmail(doc.email || "")
    setFormPin(doc.pin || "")
    setFormFee(String(doc.consultation_fee || 200))
    setFormStatus(doc.status || "active")
    setShowForm(true)
  }

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formSpecialty) {
      toast.error("Name and specialty are required")
      return
    }
    if (!editing && !formPin) {
      toast.error("PIN is required for new doctors")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    const data: Record<string, unknown> = {
      tenant_id: tenantId,
      name: formName.trim(),
      specialty: formSpecialty,
      phone: formPhone.trim() || null,
      email: formEmail.trim() || null,
      consultation_fee: parseInt(formFee) || 200,
      status: formStatus,
    }
    if (formPin) data.pin = formPin

    try {
      if (editing) {
        const { error } = await supabase
          .from("doctors")
          .update(data)
          .eq("doctor_id", editing.doctor_id)
          .eq("tenant_id", tenantId)
        if (error) throw error
        toast.success("Doctor updated")
      } else {
        const doctorId = `DOC-${Date.now()}`
        const { error } = await supabase.from("doctors").insert({
          ...data,
          doctor_id: doctorId,
        })
        if (error) throw error
        toast.success(`Doctor added — ID: ${doctorId}`)
      }

      resetForm()
      setShowForm(false)
      fetchDoctors()
    } catch (err) {
      console.error("[doctors] Failed to save doctor:", err)
      toast.error("Failed to save doctor")
    } finally {
      setSaving(false)
    }
  }, [formName, formSpecialty, formPhone, formEmail, formPin, formFee, formStatus, editing, tenantId, fetchDoctors])

  // ---------- Schedule editor functions ----------
  const openSchedule = useCallback(async (doc: Doctor) => {
    setScheduleDoctor(doc)
    setSchedDay(null)
    setSchedLoading(true)
    const supabase = createBrowserClient()
    const { data } = await supabase.from("doctor_schedules").select("*").eq("doctor_id", doc.doctor_id).eq("tenant_id", tenantId).order("day_of_week").order("session_number")
    const w = rowsToWeek((data || []) as ScheduleRow[])
    setSchedWeek(w)
    setSchedSavedWeek(JSON.parse(JSON.stringify(w)))
    setSchedLoading(false)
  }, [tenantId])

  const schedHasChanges = useMemo(() => {
    if (!scheduleDoctor) return false
    return JSON.stringify(schedWeek) !== JSON.stringify(schedSavedWeek)
  }, [schedWeek, schedSavedWeek, scheduleDoctor])

  const updateSchedDay = useCallback((day: number, updates: Partial<DaySchedule>) => {
    setSchedWeek((prev) => ({ ...prev, [day]: { ...prev[day], ...updates } }))
  }, [])

  const updateSchedS1 = useCallback((day: number, updates: Partial<DaySchedule["session1"]>) => {
    setSchedWeek((prev) => ({ ...prev, [day]: { ...prev[day], session1: { ...prev[day].session1, ...updates } } }))
  }, [])

  const updateSchedS2 = useCallback((day: number, updates: Partial<DaySchedule["session2"]>) => {
    setSchedWeek((prev) => ({ ...prev, [day]: { ...prev[day], session2: { ...prev[day].session2, ...updates } } }))
  }, [])

  const schedCopyWeekdays = useCallback(() => {
    if (schedDay === null) return
    const src = schedWeek[schedDay]
    setSchedWeek((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= 5; d++) next[d] = JSON.parse(JSON.stringify(src))
      return next
    })
    toast.success("Copied to Mon–Fri")
  }, [schedDay, schedWeek])

  const schedCopyAll = useCallback(() => {
    if (schedDay === null) return
    const src = schedWeek[schedDay]
    setSchedWeek((prev) => {
      const next = { ...prev }
      for (let d = 0; d <= 6; d++) next[d] = JSON.parse(JSON.stringify(src))
      return next
    })
    toast.success("Copied to all days")
  }, [schedDay, schedWeek])

  const schedApplyTemplate = useCallback((key: string) => {
    if (schedDay === null) return
    const tmpl = SCHED_TEMPLATES[key]
    if (!tmpl) return
    setSchedWeek((prev) => ({ ...prev, [schedDay]: JSON.parse(JSON.stringify(tmpl.config)) }))
    toast.success(`Applied: ${tmpl.label}`)
  }, [schedDay])

  const handleSchedSave = useCallback(async () => {
    if (!scheduleDoctor) return
    setSchedSaving(true)
    const supabase = createBrowserClient()
    const { error: delError } = await supabase.from("doctor_schedules").delete().eq("doctor_id", scheduleDoctor.doctor_id).eq("tenant_id", tenantId)
    if (delError) { toast.error("Failed to update schedule"); setSchedSaving(false); return }
    const rows = weekToRows(schedWeek, scheduleDoctor.doctor_id, tenantId)
    const { error: insError } = await supabase.from("doctor_schedules").insert(rows)
    if (insError) { toast.error("Failed to save: " + insError.message) } else {
      toast.success(`Schedule saved for ${scheduleDoctor.name}`)
      setSchedSavedWeek(JSON.parse(JSON.stringify(schedWeek)))
    }
    setSchedSaving(false)
  }, [scheduleDoctor, schedWeek, tenantId])

  const schedReset = useCallback(() => {
    setSchedWeek(JSON.parse(JSON.stringify(schedSavedWeek)))
    setSchedDay(null)
    toast.info("Changes reverted")
  }, [schedSavedWeek])

  const schedSel = schedDay !== null ? schedWeek[schedDay] : null

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Stethoscope className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Doctors"
        subtitle="Manage hospital doctors, specialties, and consultation fees"
        badge={<Badge variant="secondary" className="text-xs">{stats.total}</Badge>}
        action={
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="gradient-blue text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> Add Doctor
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Total" value={stats.total} gradient="gradient-blue" icon={<Stethoscope className="w-10 h-10" />} index={0} />
        <StatCard label="Active" value={stats.active} gradient="gradient-green" icon={<UserCheck className="w-10 h-10" />} index={1} />
        <StatCard label="On Leave" value={stats.onLeave} gradient="gradient-orange" icon={<CalendarOff className="w-10 h-10" />} index={2} />
        <StatCard label="Inactive" value={stats.inactive} gradient="gradient-purple" icon={<UserX className="w-10 h-10" />} index={3} />
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, specialty, or ID..."
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Doctor ID</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  </motion.div>
                  No doctors found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((doc, idx) => (
                <motion.tr
                  key={doc.doctor_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-accent/30 data-[state=selected]:bg-muted border-b transition-colors duration-150"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${SPECIALTY_GRADIENTS[doc.specialty] || "gradient-blue"} flex items-center justify-center text-white font-bold text-sm`}>
                        {doc.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <p className="font-medium text-sm">{doc.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.specialty}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {doc.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />{doc.phone}
                        </div>
                      )}
                      {doc.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />{doc.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">Rs {doc.consultation_fee || 200}</TableCell>
                  <TableCell>
                    <Badge variant={doc.status === "active" ? "default" : doc.status === "on_leave" ? "secondary" : "outline"}>
                      {doc.status || "active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{doc.doctor_id}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSchedule(doc)} title="Edit Schedule">
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)} title="Edit Details">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} doctor(s)
      </p>

      {/* Add/Edit Dialog */}
      <PremiumDialog
        open={showForm}
        onOpenChange={() => { setShowForm(false); resetForm() }}
        title={editing ? "Edit Doctor" : "Add Doctor"}
        subtitle={editing ? editing.doctor_id : "Create new doctor profile"}
        icon={<Stethoscope className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Full Name *</Label>
              <Input placeholder="Dr. John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Specialty *</Label>
              <Select value={formSpecialty} onValueChange={setFormSpecialty}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Consultation Fee (Rs)</Label>
              <Input type="number" value={formFee} onChange={(e) => setFormFee(e.target.value)} min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+91..." value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="doctor@hospital.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Login PIN {editing ? "(leave blank to keep)" : "*"}</Label>
              <Input type="password" placeholder="4-6 digit PIN" value={formPin} onChange={(e) => setFormPin(e.target.value)} maxLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {editing ? "Update Doctor" : "Add Doctor"}
          </Button>
        </div>
      </PremiumDialog>

      {/* Schedule Editor Dialog */}
      <PremiumDialog
        open={!!scheduleDoctor}
        onOpenChange={() => { setScheduleDoctor(null); setSchedDay(null) }}
        title={scheduleDoctor ? `Schedule — ${scheduleDoctor.name}` : "Schedule"}
        subtitle={scheduleDoctor?.specialty || ""}
        icon={<Clock className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-2xl"
      >
        {schedLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {/* Weekly Strip */}
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((day, i) => {
                const d = schedWeek[i]
                const isSel = schedDay === i
                return (
                  <div
                    key={i}
                    onClick={() => setSchedDay(isSel ? null : i)}
                    className={`rounded-xl border p-2 text-center cursor-pointer transition-all select-none ${
                      isSel ? "ring-2 ring-primary shadow-md border-primary/30 bg-primary/5"
                        : d?.isWorking ? "bg-primary/5 border-primary/15 hover:border-primary/30"
                        : "bg-muted/30 border-border hover:border-border/80"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold mx-auto mb-1 ${d?.isWorking ? "gradient-blue" : "bg-muted-foreground/20"}`}>
                      {DAY_SHORT[i]}
                    </div>
                    <p className="text-[9px] text-muted-foreground">{day.slice(0, 3)}</p>
                    {d?.isWorking ? (
                      <>
                        <p className="text-[9px] font-semibold mt-0.5">{fmt24to12(d.session1.start).replace(" ", "")}–{fmt24to12(d.session1.end).replace(" ", "")}</p>
                        {d.session2.enabled && (
                          <p className="text-[9px] font-semibold text-primary/70">{fmt24to12(d.session2.start).replace(" ", "")}–{fmt24to12(d.session2.end).replace(" ", "")}</p>
                        )}
                        <Badge variant="secondary" className="text-[7px] mt-0.5 h-3.5 px-1">{d.session1.slotDuration}m</Badge>
                      </>
                    ) : (
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5 font-medium">OFF</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Day Editor */}
            <AnimatePresence>
              {schedDay !== null && schedSel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold ${schedSel.isWorking ? "gradient-blue" : "bg-muted-foreground/30"}`}>
                          {DAY_SHORT[schedDay]}
                        </div>
                        {DAYS[schedDay]}
                        <div className="flex items-center gap-2 ml-auto">
                          <Label className="text-xs text-muted-foreground">Working</Label>
                          <Switch checked={schedSel.isWorking} onCheckedChange={(checked) => updateSchedDay(schedDay, { isWorking: checked })} />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {schedSel.isWorking ? (
                        <>
                          {/* Session 1 */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Sun className="w-3.5 h-3.5 text-amber-500" />
                              <Label className="text-xs font-semibold">Session 1</Label>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Start</Label>
                                <Input type="time" value={schedSel.session1.start} onChange={(e) => updateSchedS1(schedDay, { start: e.target.value })} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">End</Label>
                                <Input type="time" value={schedSel.session1.end} onChange={(e) => updateSchedS1(schedDay, { end: e.target.value })} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Slot</Label>
                                <Select value={String(schedSel.session1.slotDuration)} onValueChange={(v) => updateSchedS1(schedDay, { slotDuration: parseInt(v) })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{SLOT_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Break */}
                          {schedSel.session2.enabled && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                              <Coffee className="w-3.5 h-3.5 text-amber-600" />
                              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                                Break: {fmt24to12(schedSel.session1.end)} – {fmt24to12(schedSel.session2.start)} ({minutesBetween(schedSel.session1.end, schedSel.session2.start)} min)
                              </span>
                            </div>
                          )}

                          {/* Session 2 */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <MoonIcon className="w-3.5 h-3.5 text-indigo-500" />
                              <Label className="text-xs font-semibold">Session 2</Label>
                              <Switch checked={schedSel.session2.enabled} onCheckedChange={(checked) => updateSchedS2(schedDay, { enabled: checked })} className="ml-auto" />
                            </div>
                            <AnimatePresence>
                              {schedSel.session2.enabled && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Start</Label>
                                    <Input type="time" value={schedSel.session2.start} onChange={(e) => updateSchedS2(schedDay, { start: e.target.value })} className="h-8 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">End</Label>
                                    <Input type="time" value={schedSel.session2.end} onChange={(e) => updateSchedS2(schedDay, { end: e.target.value })} className="h-8 text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Slot</Label>
                                    <Select value={String(schedSel.session2.slotDuration)} onValueChange={(v) => updateSchedS2(schedDay, { slotDuration: parseInt(v) })}>
                                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>{SLOT_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Timeline */}
                          <TimelineBar session1={schedSel.session1} session2={schedSel.session2.enabled ? schedSel.session2 : null} />

                          {/* Quick Actions */}
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                            <Button variant="outline" size="sm" onClick={schedCopyWeekdays} className="text-[10px] h-7 px-2">
                              <Copy className="w-3 h-3 mr-1" /> Weekdays
                            </Button>
                            <Button variant="outline" size="sm" onClick={schedCopyAll} className="text-[10px] h-7 px-2">
                              <Copy className="w-3 h-3 mr-1" /> All
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-[10px] h-7 px-2">
                                  Template <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {Object.entries(SCHED_TEMPLATES).map(([key, { label }]) => (
                                  <DropdownMenuItem key={key} onClick={() => schedApplyTemplate(key)} className="text-xs">{label}</DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">Day off — no slots generated.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save / Reset */}
            <div className="flex gap-2">
              <Button onClick={handleSchedSave} disabled={schedSaving || !schedHasChanges} className={`flex-1 ${schedHasChanges ? "gradient-blue text-white hover:opacity-90" : ""}`}>
                {schedSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {schedHasChanges ? "Save Schedule" : "No Changes"}
              </Button>
              {schedHasChanges && (
                <Button variant="outline" onClick={schedReset}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </PremiumDialog>
    </div>
  )
}
