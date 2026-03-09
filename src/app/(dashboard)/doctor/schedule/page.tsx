"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils/date"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { motion, AnimatePresence } from "framer-motion"
import {
  CalendarOff, Clock, Plus, Trash2, Loader2, AlertTriangle,
  Sun, Save, Copy, ChevronDown, RotateCcw, Coffee,
} from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import type { SessionUser } from "@/types/auth"

// ---------- Types ----------

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

interface DateOverride {
  id?: number
  doctor_id: string
  tenant_id: string
  date: string
  type: string
  reason?: string
  start_time?: string
  end_time?: string
  is_available?: boolean
  slot_duration_minutes?: number
}

// ---------- Constants ----------

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60]

const DEFAULT_DAY: DaySchedule = {
  isWorking: true,
  session1: { start: "10:00", end: "13:00", slotDuration: 20 },
  session2: { enabled: true, start: "14:00", end: "18:00", slotDuration: 20 },
}

const TEMPLATES: Record<string, { label: string; config: Omit<DaySchedule, "isWorking"> & { isWorking: true } }> = {
  full: {
    label: "Full Day (9AM–1PM + 2PM–6PM)",
    config: { isWorking: true, session1: { start: "09:00", end: "13:00", slotDuration: 20 }, session2: { enabled: true, start: "14:00", end: "18:00", slotDuration: 20 } },
  },
  morning: {
    label: "Morning Only (9AM–1PM)",
    config: { isWorking: true, session1: { start: "09:00", end: "13:00", slotDuration: 20 }, session2: { enabled: false, start: "14:00", end: "18:00", slotDuration: 20 } },
  },
  evening: {
    label: "Evening Only (4PM–9PM)",
    config: { isWorking: true, session1: { start: "16:00", end: "21:00", slotDuration: 20 }, session2: { enabled: false, start: "21:00", end: "21:00", slotDuration: 20 } },
  },
  extended: {
    label: "Extended (10AM–1PM + 3PM–9PM)",
    config: { isWorking: true, session1: { start: "10:00", end: "13:00", slotDuration: 20 }, session2: { enabled: true, start: "15:00", end: "21:00", slotDuration: 20 } },
  },
}

// ---------- Helpers ----------

function fmt24to12(time: string): string {
  const [hStr, mStr] = time.split(":")
  const h = parseInt(hStr)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${mStr || "00"} ${ampm}`
}

function parseTimeToMinutes(time: string): number {
  const trimmed = time.trim()
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1])
    const m = parseInt(ampmMatch[2])
    const period = ampmMatch[3].toUpperCase()
    if (period === "PM" && h !== 12) h += 12
    if (period === "AM" && h === 12) h = 0
    return h * 60 + m
  }
  const [hStr, mStr] = trimmed.split(":")
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
        session1: {
          start: s1.start_time.slice(0, 5),
          end: s1.end_time.slice(0, 5),
          slotDuration: s1.slot_duration_minutes || 20,
        },
        session2: {
          enabled: !!s2,
          start: s2 ? s2.start_time.slice(0, 5) : "14:00",
          end: s2 ? s2.end_time.slice(0, 5) : "18:00",
          slotDuration: s2 ? s2.slot_duration_minutes || 20 : 20,
        },
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
      schedule_id: `SCH_${doctorId}_${d}_1`,
      doctor_id: doctorId,
      tenant_id: tenantId,
      day_of_week: d,
      session_number: 1,
      start_time: day.session1.start + ":00",
      end_time: day.session1.end + ":00",
      slot_duration_minutes: day.session1.slotDuration,
      is_working: day.isWorking,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 1,
      max_daily_bookings: 0,
      is_active: true,
    })
    if (day.isWorking && day.session2.enabled) {
      rows.push({
        schedule_id: `SCH_${doctorId}_${d}_2`,
        doctor_id: doctorId,
        tenant_id: tenantId,
        day_of_week: d,
        session_number: 2,
        start_time: day.session2.start + ":00",
        end_time: day.session2.end + ":00",
        slot_duration_minutes: day.session2.slotDuration,
        is_working: true,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 1,
        max_daily_bookings: 0,
        is_active: true,
      })
    }
  }
  return rows
}

// ---------- Component ----------

export default function SchedulePage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()
  const doctorId = user?.doctorId || ""

  const [savedWeek, setSavedWeek] = useState<WeekSchedule | null>(null)
  const [week, setWeek] = useState<WeekSchedule>({})
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Leave/override state
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [overrideDate, setOverrideDate] = useState("")
  const [overrideType, setOverrideType] = useState<"leave" | "custom_hours">("leave")
  const [overrideReason, setOverrideReason] = useState("")
  const [customStart, setCustomStart] = useState("14:00")
  const [customEnd, setCustomEnd] = useState("21:00")
  const [affectedCount, setAffectedCount] = useState(0)
  const [savingOverride, setSavingOverride] = useState(false)
  const [removeOverrideId, setRemoveOverrideId] = useState<number | null>(null)

  // Load data
  useEffect(() => {
    if (!doctorId) return
    const supabase = createBrowserClient()
    Promise.all([
      supabase.from("doctor_schedules").select("*").eq("doctor_id", doctorId).eq("tenant_id", tenantId).order("day_of_week").order("session_number").limit(100),
      supabase.from("date_overrides").select("*").eq("doctor_id", doctorId).eq("tenant_id", tenantId).in("type", ["leave", "custom_hours"]).gte("date", new Date().toISOString().split("T")[0]).order("date").limit(200),
    ]).then(([schedRes, overrideRes]) => {
      const w = rowsToWeek((schedRes.data || []) as ScheduleRow[])
      setWeek(w)
      setSavedWeek(JSON.parse(JSON.stringify(w)))
      if (overrideRes.data) setOverrides(overrideRes.data as DateOverride[])
      setLoading(false)
    })
  }, [doctorId, tenantId])

  const hasChanges = useMemo(() => {
    if (!savedWeek) return false
    return JSON.stringify(week) !== JSON.stringify(savedWeek)
  }, [week, savedWeek])

  // Update a specific day
  const updateDay = useCallback((day: number, updates: Partial<DaySchedule>) => {
    setWeek((prev) => ({ ...prev, [day]: { ...prev[day], ...updates } }))
  }, [])

  const updateSession1 = useCallback((day: number, updates: Partial<DaySchedule["session1"]>) => {
    setWeek((prev) => ({
      ...prev,
      [day]: { ...prev[day], session1: { ...prev[day].session1, ...updates } },
    }))
  }, [])

  const updateSession2 = useCallback((day: number, updates: Partial<DaySchedule["session2"]>) => {
    setWeek((prev) => ({
      ...prev,
      [day]: { ...prev[day], session2: { ...prev[day].session2, ...updates } },
    }))
  }, [])

  // Quick actions
  const copyToWeekdays = useCallback(() => {
    if (selectedDay === null) return
    const src = week[selectedDay]
    setWeek((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= 5; d++) next[d] = JSON.parse(JSON.stringify(src))
      return next
    })
    toast.success("Copied to Mon–Fri")
  }, [selectedDay, week])

  const copyToAll = useCallback(() => {
    if (selectedDay === null) return
    const src = week[selectedDay]
    setWeek((prev) => {
      const next = { ...prev }
      for (let d = 0; d <= 6; d++) next[d] = JSON.parse(JSON.stringify(src))
      return next
    })
    toast.success("Copied to all days")
  }, [selectedDay, week])

  const applyTemplate = useCallback((key: string) => {
    if (selectedDay === null) return
    const tmpl = TEMPLATES[key]
    if (!tmpl) return
    setWeek((prev) => ({
      ...prev,
      [selectedDay]: { ...JSON.parse(JSON.stringify(tmpl.config)) },
    }))
    toast.success(`Applied: ${tmpl.label}`)
  }, [selectedDay])

  // Save schedule — upsert new rows, delete removed ones (safe strategy)
  const handleSave = useCallback(async () => {
    if (!doctorId) return
    setSaving(true)
    const supabase = createBrowserClient()
    const newRows = weekToRows(week, doctorId, tenantId)
    const newIds = new Set(newRows.map((r) => r.schedule_id))

    // Upsert all current rows (creates or updates)
    const { error: upsertError } = await supabase
      .from("doctor_schedules")
      .upsert(newRows, { onConflict: "schedule_id" })

    if (upsertError) {
      toast.error("Failed to save schedule: " + upsertError.message)
      setSaving(false)
      return
    }

    // Delete rows that no longer exist (e.g. session 2 was disabled)
    const { data: existing } = await supabase
      .from("doctor_schedules")
      .select("schedule_id")
      .eq("doctor_id", doctorId)
      .eq("tenant_id", tenantId)

    const toDelete = (existing || [])
      .map((r: { schedule_id: string }) => r.schedule_id)
      .filter((id: string) => !newIds.has(id))

    if (toDelete.length > 0) {
      await supabase
        .from("doctor_schedules")
        .delete()
        .in("schedule_id", toDelete)
        .eq("tenant_id", tenantId)
    }

    toast.success("Schedule saved successfully")
    setSavedWeek(JSON.parse(JSON.stringify(week)))
    setSaving(false)
  }, [doctorId, tenantId, week])

  const resetChanges = useCallback(() => {
    if (savedWeek) {
      setWeek(JSON.parse(JSON.stringify(savedWeek)))
      toast.info("Changes reverted")
    }
  }, [savedWeek])

  // --- Leave/Override logic (unchanged) ---
  const fetchOverrides = useCallback(async () => {
    const supabase = createBrowserClient()
    const { data } = await supabase.from("date_overrides").select("*").eq("doctor_id", doctorId).eq("tenant_id", tenantId).in("type", ["leave", "custom_hours"]).gte("date", new Date().toISOString().split("T")[0]).order("date").limit(200)
    if (data) setOverrides(data as DateOverride[])
  }, [doctorId, tenantId])

  useEffect(() => {
    if (!overrideDate || !doctorId) { setAffectedCount(0); return }
    const supabase = createBrowserClient()
    if (overrideType === "leave") {
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("doctor_id", doctorId).eq("date", overrideDate).eq("status", "confirmed").then(({ count }) => setAffectedCount(count || 0))
    } else {
      supabase.from("appointments").select("booking_id, time").eq("doctor_id", doctorId).eq("date", overrideDate).eq("status", "confirmed").then(({ data }) => {
        if (!data) { setAffectedCount(0); return }
        setAffectedCount(data.filter((a) => parseTimeToMinutes(a.time) < parseTimeToMinutes(customStart)).length)
      })
    }
  }, [overrideDate, overrideType, customStart, doctorId])

  const addOverride = useCallback(async () => {
    if (!overrideDate) return
    setSavingOverride(true)
    const supabase = createBrowserClient()
    const record: Record<string, unknown> = { doctor_id: doctorId, tenant_id: tenantId, date: overrideDate, type: overrideType, reason: overrideReason || (overrideType === "leave" ? "Personal" : "Custom hours") }
    if (overrideType === "custom_hours") { record.start_time = customStart; record.end_time = customEnd; record.is_available = true } else { record.is_available = false }
    const { error } = await supabase.from("date_overrides").insert(record)
    if (error) { toast.error("Failed to add override") } else { toast.success(overrideType === "leave" ? "Leave added" : "Custom hours set"); setOverrideDate(""); setOverrideReason(""); setOverrideType("leave"); fetchOverrides() }
    setSavingOverride(false)
  }, [overrideDate, overrideType, overrideReason, customStart, customEnd, doctorId, tenantId, fetchOverrides])

  const removeOverride = useCallback(async (id: number) => {
    const supabase = createBrowserClient()
    const { error } = await supabase.from("date_overrides").delete().eq("id", id).eq("tenant_id", tenantId)
    if (error) {
      toast.error("Failed to remove override")
      return
    }
    setOverrides((prev) => prev.filter((o) => o.id !== id))
    toast.success("Override removed")
  }, [tenantId])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

  const sel = selectedDay !== null ? week[selectedDay] : null

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionHeader
        variant="glass"
        icon={<Clock className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Weekly Timetable"
        subtitle="Configure your sessions, breaks, and working hours"
        action={hasChanges ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
            Unsaved changes
          </Badge>
        ) : undefined}
      />

      {/* ── Weekly Day Strip ── */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg gradient-blue flex items-center justify-center text-white"><Clock className="w-3 h-3" /></div>
            Weekly Schedule
            <span className="text-xs text-muted-foreground font-normal ml-auto">Click a day to edit</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAYS.map((day, i) => {
              const d = week[i]
              const isSelected = selectedDay === i
              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDay(isSelected ? null : i)}
                  className={`rounded-xl border p-2.5 text-center cursor-pointer transition-all select-none ${
                    isSelected
                      ? "ring-2 ring-primary shadow-lg border-primary/30 bg-primary/5"
                      : d?.isWorking
                        ? "bg-primary/5 border-primary/15 hover:border-primary/30"
                        : "bg-muted/30 border-border hover:border-border/80"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mx-auto mb-1.5 ${
                    d?.isWorking ? "gradient-blue" : "bg-muted-foreground/20"
                  }`}>
                    {DAY_SHORT[i]}
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground">{day}</p>
                  {d?.isWorking ? (
                    <>
                      <p className="text-[10px] font-semibold mt-1">{fmt24to12(d.session1.start)} – {fmt24to12(d.session1.end)}</p>
                      {d.session2.enabled && (
                        <p className="text-[10px] font-semibold text-primary/70">{fmt24to12(d.session2.start)} – {fmt24to12(d.session2.end)}</p>
                      )}
                      <Badge variant="secondary" className="text-[8px] mt-1 h-4 px-1.5">{d.session1.slotDuration}m</Badge>
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 mt-1 font-medium">OFF</p>
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Day Editor ── */}
      <AnimatePresence>
        {selectedDay !== null && sel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="card-hover border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold ${sel.isWorking ? "gradient-blue" : "bg-muted-foreground/30"}`}>
                    {DAY_SHORT[selectedDay]}
                  </div>
                  {DAYS[selectedDay]} Schedule
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor="working-toggle" className="text-xs text-muted-foreground">Working</Label>
                    <Switch
                      id="working-toggle"
                      checked={sel.isWorking}
                      onCheckedChange={(checked) => updateDay(selectedDay, { isWorking: checked })}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sel.isWorking ? (
                  <>
                    {/* Session 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <Label className="text-xs font-semibold">Session 1</Label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Start</Label>
                          <Input type="time" value={sel.session1.start} onChange={(e) => updateSession1(selectedDay, { start: e.target.value })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">End</Label>
                          <Input type="time" value={sel.session1.end} onChange={(e) => updateSession1(selectedDay, { end: e.target.value })} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Slot Duration</Label>
                          <Select value={String(sel.session1.slotDuration)} onValueChange={(v) => updateSession1(selectedDay, { slotDuration: parseInt(v) })}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SLOT_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Break Preview */}
                    {sel.session2.enabled && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                        <Coffee className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          Break: {fmt24to12(sel.session1.end)} – {fmt24to12(sel.session2.start)} ({minutesBetween(sel.session1.end, sel.session2.start)} min)
                        </span>
                      </div>
                    )}

                    {/* Session 2 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <Label className="text-xs font-semibold">Session 2</Label>
                        <Switch
                          checked={sel.session2.enabled}
                          onCheckedChange={(checked) => updateSession2(selectedDay, { enabled: checked })}
                          className="ml-auto"
                        />
                      </div>
                      <AnimatePresence>
                        {sel.session2.enabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                          >
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Start</Label>
                              <Input type="time" value={sel.session2.start} onChange={(e) => updateSession2(selectedDay, { start: e.target.value })} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">End</Label>
                              <Input type="time" value={sel.session2.end} onChange={(e) => updateSession2(selectedDay, { end: e.target.value })} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Slot Duration</Label>
                              <Select value={String(sel.session2.slotDuration)} onValueChange={(v) => updateSession2(selectedDay, { slotDuration: parseInt(v) })}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {SLOT_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Visual Timeline */}
                    <div className="hidden sm:block">
                      <TimelineBar session1={sel.session1} session2={sel.session2.enabled ? sel.session2 : null} />
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                      <Button variant="outline" size="sm" onClick={copyToWeekdays} className="text-xs h-8">
                        <Copy className="w-3 h-3 mr-1" /> Weekdays
                      </Button>
                      <Button variant="outline" size="sm" onClick={copyToAll} className="text-xs h-8">
                        <Copy className="w-3 h-3 mr-1" /> All Days
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs h-8">
                            Template <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {Object.entries(TEMPLATES).map(([key, { label }]) => (
                            <DropdownMenuItem key={key} onClick={() => applyTemplate(key)}>{label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">This day is marked as <strong>off</strong>. No slots will be generated.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Toggle &quot;Working&quot; above to configure sessions.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Save / Reset ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="lg" className={`flex-1 ${hasChanges ? "gradient-blue text-white hover:opacity-90" : ""}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {hasChanges ? "Save Schedule" : "No Changes"}
          </Button>
          {hasChanges && (
            <Button variant="outline" size="lg" onClick={resetChanges}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Leave & Custom Hours ── */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white"><CalendarOff className="w-3 h-3" /></div>
            Leave & Custom Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={overrideType} onValueChange={(v) => setOverrideType(v as "leave" | "custom_hours")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Full Day Leave</SelectItem>
                  <SelectItem value="custom_hours">Custom Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {overrideType === "custom_hours" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Sun className="w-3 h-3" /> From</Label>
                <Input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Until</Label>
                <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </motion.div>
          )}

          <div className="flex gap-2">
            <Input placeholder="Reason (optional)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="flex-1" />
            <Button onClick={addOverride} disabled={!overrideDate || savingOverride}>
              {savingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              {overrideType === "leave" ? "Add Leave" : "Set Hours"}
            </Button>
          </div>

          {affectedCount > 0 && overrideDate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><strong>{affectedCount}</strong> confirmed appointment(s) {overrideType === "leave" ? "on this date will need rescheduling." : `before ${fmt24to12(customStart)} will need rescheduling.`}</span>
            </motion.div>
          )}

          {overrides.length === 0 ? (
            <div className="text-center py-6">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <CalendarOff className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              </motion.div>
              <p className="text-sm font-medium text-muted-foreground">No upcoming leaves or custom hours</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => (
                <motion.div key={ov.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50 border-l-4 card-hover ${ov.type === "leave" ? "border-l-destructive/50" : "border-l-amber-500/50"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{formatDate(ov.date)}</p>
                      <Badge variant={ov.type === "leave" ? "destructive" : "secondary"} className="text-[10px] h-5">
                        {ov.type === "leave" ? "Leave" : "Custom Hours"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ov.type === "custom_hours" && ov.start_time && ov.end_time ? `${fmt24to12(ov.start_time)} — ${fmt24to12(ov.end_time)}` : ov.reason || "No reason"}
                      {ov.type === "custom_hours" && ov.reason ? ` • ${ov.reason}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => ov.id && setRemoveOverrideId(ov.id)} className="h-8 w-8 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeOverrideId}
        onOpenChange={(open) => { if (!open) setRemoveOverrideId(null) }}
        title="Remove Override"
        description="Are you sure you want to remove this leave/custom hours entry? Any affected appointments will no longer be flagged."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (removeOverrideId) {
            await removeOverride(removeOverrideId)
            setRemoveOverrideId(null)
          }
        }}
      />
    </div>
  )
}

// ---------- Timeline Bar Component ----------

function TimelineBar({ session1, session2 }: { session1: DaySchedule["session1"]; session2: DaySchedule["session2"] | null }) {
  const barStart = 8 * 60  // 8 AM
  const barEnd = 22 * 60   // 10 PM
  const total = barEnd - barStart

  const toPercent = (time: string) => {
    const m = parseTimeToMinutes(time)
    return Math.max(0, Math.min(100, ((m - barStart) / total) * 100))
  }

  const s1Left = toPercent(session1.start)
  const s1Width = toPercent(session1.end) - s1Left
  const s2Left = session2 ? toPercent(session2.start) : 0
  const s2Width = session2 ? toPercent(session2.end) - s2Left : 0
  const breakLeft = toPercent(session1.end)
  const breakWidth = session2 ? toPercent(session2.start) - breakLeft : 0

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

  return (
    <div className="space-y-1">
      <div className="relative h-8 bg-muted/30 rounded-lg overflow-hidden border border-border/50">
        {/* Session 1 */}
        <div className="absolute top-0 bottom-0 bg-emerald-500/25 dark:bg-emerald-500/20 border-l-2 border-r-2 border-emerald-500/50" style={{ left: `${s1Left}%`, width: `${s1Width}%` }}>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">S1</span>
        </div>
        {/* Break */}
        {session2 && breakWidth > 0 && (
          <div className="absolute top-0 bottom-0 bg-amber-500/15 dark:bg-amber-500/10 border-l border-r border-amber-500/30 border-dashed" style={{ left: `${breakLeft}%`, width: `${breakWidth}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-amber-600 dark:text-amber-400"><Coffee className="w-3 h-3" /></span>
          </div>
        )}
        {/* Session 2 */}
        {session2 && (
          <div className="absolute top-0 bottom-0 bg-blue-500/25 dark:bg-blue-500/20 border-l-2 border-r-2 border-blue-500/50" style={{ left: `${s2Left}%`, width: `${s2Width}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-blue-700 dark:text-blue-400">S2</span>
          </div>
        )}
      </div>
      {/* Time labels */}
      <div className="relative h-3">
        {hours.map((h) => {
          const pct = ((h * 60 - barStart) / total) * 100
          return (
            <span key={h} className="absolute text-[8px] text-muted-foreground/60 -translate-x-1/2" style={{ left: `${pct}%` }}>
              {h > 12 ? `${h - 12}P` : h === 12 ? "12P" : `${h}A`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Moon icon not in lucide import — inline simple
function Moon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}
