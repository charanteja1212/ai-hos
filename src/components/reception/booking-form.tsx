"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
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
import {
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Stethoscope,
  User,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ChevronRight,
  MapPin,
  Sun,
  Sunset,
  Moon,
  Shield,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate, formatTime, getTodayIST } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { createNotification } from "@/lib/notifications"
import { calculateEstimatedWait } from "@/lib/utils/estimated-wait"
import type { Doctor, Patient } from "@/types/database"
import { useTenant } from "@/hooks/use-tenant"

type Step = "patient" | "doctor" | "slot" | "confirm" | "done"

interface SlotInfo {
  date: string
  dateKey: string
  day: string
  availableSlots: number
}

interface TimeSlot {
  time: string
  status: "available" | "booked"
  capacity?: number
  iso?: string
}

interface N8nSlot {
  time: string
  capacity: number
  iso: string
}

interface N8nDateSlots {
  morning?: N8nSlot[]
  afternoon?: N8nSlot[]
  evening?: N8nSlot[]
}

interface N8nAvailabilityResponse {
  success?: boolean
  available_dates?: { date: string; date_key: string; available_count: number }[]
  slots_by_date?: Record<string, N8nDateSlots>
  dates?: SlotInfo[]
  slots?: Record<string, TimeSlot[]>
}

const STEP_CONFIG = [
  { key: "patient" as const, label: "Patient", icon: User },
  { key: "doctor" as const, label: "Doctor", icon: Stethoscope },
  { key: "slot" as const, label: "Schedule", icon: Calendar },
  { key: "confirm" as const, label: "Confirm", icon: Shield },
]

const SPECIALTY_COLORS: Record<string, { gradient: string; glow: string; icon: string }> = {
  "Cardiology": { gradient: "from-red-500 to-rose-400", glow: "shadow-red-500/20", icon: "gradient-red" },
  "Dermatology": { gradient: "from-amber-500 to-orange-400", glow: "shadow-amber-500/20", icon: "gradient-orange" },
  "Neurology": { gradient: "from-purple-500 to-violet-400", glow: "shadow-purple-500/20", icon: "gradient-purple" },
  "Orthopedics": { gradient: "from-blue-500 to-cyan-400", glow: "shadow-blue-500/20", icon: "gradient-blue" },
  "Pediatrics": { gradient: "from-emerald-500 to-green-400", glow: "shadow-emerald-500/20", icon: "gradient-green" },
  "General Medicine": { gradient: "from-sky-500 to-blue-400", glow: "shadow-sky-500/20", icon: "gradient-blue" },
  "ENT": { gradient: "from-teal-500 to-cyan-400", glow: "shadow-teal-500/20", icon: "gradient-teal" },
}

function getSpecialtyStyle(specialty: string) {
  return SPECIALTY_COLORS[specialty] || { gradient: "from-blue-500 to-cyan-400", glow: "shadow-blue-500/20", icon: "gradient-blue" }
}

export function BookingForm() {
  const { activeTenantId: tenantId } = useBranch()
  const { tenant } = useTenant(tenantId)

  const [step, setStep] = useState<Step>("patient")
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  // Unified patient form
  const [phone, setPhone] = useState("")
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientFound, setPatientFound] = useState<boolean | null>(null)
  const [patientName, setPatientName] = useState("")
  const [patientGender, setPatientGender] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const lookupDone = useRef(false)

  // Doctor & slot state
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [availability, setAvailability] = useState<SlotInfo[]>([])
  const [allSlots, setAllSlots] = useState<Record<string, N8nDateSlots>>({})
  const [selectedDate, setSelectedDate] = useState("")
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState("")

  // Booking result
  const [bookingId, setBookingId] = useState("")
  const [waSent, setWaSent] = useState<boolean | null>(null)

  // Fetch doctors on mount
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("specialty")
      .then(({ data }) => {
        if (data) setDoctors(data as Doctor[])
      })
  }, [tenantId])

  // Auto-lookup patient when phone reaches 10+ digits
  const lookupPatient = useCallback(async (phoneVal: string) => {
    const digits = phoneVal.replace(/\D/g, "")
    if (digits.length < 10) {
      setPatientFound(null)
      setPatient(null)
      lookupDone.current = false
      return
    }
    if (lookupDone.current) return
    lookupDone.current = true
    setLookingUp(true)
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`phone.eq.${digits.replace(/[^a-zA-Z0-9\s\-\.]/g, "")},phone.eq.+${digits.replace(/[^a-zA-Z0-9\s\-\.]/g, "")}`)
        .limit(1)
        .maybeSingle()

      if (data) {
        const p = data as Patient
        setPatient(p)
        setPatientFound(true)
        setPatientName(p.name || "")
        setPatientGender(p.gender || "")
        setPatientAge(p.age ? String(p.age) : "")
      } else {
        setPatientFound(false)
        setPatient(null)
      }
    } catch {
      setPatientFound(false)
    } finally {
      setLookingUp(false)
    }
  }, [tenantId])

  const handlePhoneChange = (val: string) => {
    setPhone(val)
    const digits = val.replace(/\D/g, "")
    // Reset lookup when phone changes
    if (digits.length < 10) {
      lookupDone.current = false
      setPatientFound(null)
      setPatient(null)
      setPatientName("")
      setPatientGender("")
      setPatientAge("")
    }
    if (digits.length === 10 || digits.length === 12) {
      lookupPatient(val)
    }
  }

  const proceedFromPatient = useCallback(async () => {
    let digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      toast.error("Enter a valid phone number")
      return
    }
    // Normalize to 12-digit format with country code
    if (digits.length === 10) {
      digits = "91" + digits
    }
    if (!patientName.trim()) {
      toast.error("Enter patient name")
      return
    }

    // If new patient, save first
    if (!patientFound) {
      setLoading(true)
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-patient",
            phone: digits,
            name: patientName,
            gender: patientGender || "Not specified",
            age: patientAge ? parseInt(patientAge) : null,
            tenant_id: tenantId,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          toast.error(errData.error || `Save failed (${res.status})`)
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.phone || data.success) {
          setPatient({
            phone: digits,
            name: patientName,
            gender: patientGender || "Not specified",
            tenant_id: tenantId,
          } as Patient)
          toast.success("Patient saved")
        } else {
          toast.error(data.error || "Failed to save patient")
          setLoading(false)
          return
        }
      } catch {
        toast.error("Error saving patient — check network")
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    } else {
      // Existing patient — update local state
      setPatient({
        ...(patient || {}),
        phone: digits,
        name: patientName,
        gender: patientGender || "Not specified",
        tenant_id: tenantId,
      } as Patient)
    }

    setStep("doctor")
  }, [phone, patientName, patientGender, patientAge, patientFound, patient, tenantId])

  const fetchAvailability = useCallback(
    async (doctor: Doctor) => {
      setSelectedDoctor(doctor)
      setLoading(true)
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check-availability",
            doctor_id: doctor.doctor_id,
            tenant_id: tenantId,
          }),
          signal: AbortSignal.timeout(15000),
        })
        const data: N8nAvailabilityResponse = await res.json()

        if (data.available_dates) {
          const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          const parsed: SlotInfo[] = data.available_dates.map((d) => {
            const dateObj = new Date(d.date_key + "T00:00:00")
            return {
              date: d.date_key,
              dateKey: d.date_key,
              day: DAYS[dateObj.getDay()] || d.date,
              availableSlots: d.available_count,
            }
          })
          setAvailability(parsed)
          if (data.slots_by_date) setAllSlots(data.slots_by_date)
          setStep("slot")
        } else if (data.dates) {
          setAvailability(data.dates)
          setStep("slot")
        } else {
          toast.error("Could not fetch availability")
        }
      } catch {
        toast.error("Error checking availability")
      } finally {
        setLoading(false)
      }
    },
    [tenantId]
  )

  const fetchTimeSlots = useCallback(
    (date: string) => {
      setSelectedDate(date)
      let dateSlots: N8nDateSlots | undefined
      for (const [key, val] of Object.entries(allSlots)) {
        if (key === date) { dateSlots = val; break }
        const entry = availability.find((a) => a.date === date)
        if (entry) {
          const d = new Date(date + "T00:00:00")
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          const expected = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
          if (key === expected) { dateSlots = val; break }
        }
      }

      if (dateSlots) {
        const flat: TimeSlot[] = [
          ...(dateSlots.morning || []),
          ...(dateSlots.afternoon || []),
          ...(dateSlots.evening || []),
        ].map((s) => ({ time: s.time, status: "available" as const, capacity: s.capacity, iso: s.iso }))
        setTimeSlots(flat)
      } else {
        setLoading(true)
        fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check-availability", doctor_id: selectedDoctor?.doctor_id, tenant_id: tenantId, date }),
          signal: AbortSignal.timeout(15000),
        })
          .then((res) => res.json())
          .then((data) => {
            const slots = data.slots_by_date || data.slots || {}
            const firstKey = Object.keys(slots)[0]
            const firstVal = slots[firstKey]
            if (firstVal?.morning || firstVal?.afternoon || firstVal?.evening) {
              const flat: TimeSlot[] = [
                ...(firstVal.morning || []), ...(firstVal.afternoon || []), ...(firstVal.evening || []),
              ].map((s: N8nSlot) => ({ time: s.time, status: "available" as const }))
              setTimeSlots(flat)
            } else {
              const arr = data.time_slots || slots[date] || []
              setTimeSlots(Array.isArray(arr) ? arr : [])
            }
          })
          .catch(() => toast.error("Error fetching time slots"))
          .finally(() => setLoading(false))
      }
    },
    [selectedDoctor, tenantId, allSlots, availability]
  )

  const confirmBooking = useCallback(async () => {
    if (!patient || !selectedDoctor || !selectedDate || !selectedTime) return
    setLoading(true)
    try {
      const to24h = (t: string): string => {
        const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        if (!match) return t
        let h = parseInt(match[1])
        const m = match[2]
        const period = match[3].toUpperCase()
        if (period === "PM" && h !== 12) h += 12
        if (period === "AM" && h === 12) h = 0
        return `${h.toString().padStart(2, "0")}:${m}`
      }
      const time24 = to24h(selectedTime)
      const startTime = `${selectedDate} ${time24}`

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book-appointment",
          phone: patient.phone,
          patient_name: patient.name,
          doctor_id: selectedDoctor.doctor_id,
          doctor_name: selectedDoctor.name,
          specialty: selectedDoctor.specialty,
          date: selectedDate,
          time: time24,
          start_time: startTime,
          tenant_id: tenantId,
          source: "reception_walkin",
          payment_status: "pending",
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.booking_id || data.bookingId) {
        setBookingId(data.booking_id || data.bookingId)
        setWaSent(data.wa_sent === true)
        setStep("done")
        toast.success("Appointment booked successfully!")

        const supabase = createBrowserClient()
        const today = getTodayIST()
        const now = new Date().toISOString()
        const bkId = data.booking_id || data.bookingId

        const { count: queueCount } = await supabase
          .from("queue_entries")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("date", today)

        const queueNumber = (queueCount || 0) + 1
        const { waitingAhead, estimatedWait } = await calculateEstimatedWait(tenantId, selectedDoctor.doctor_id)

        const { error: queueInsertError } = await supabase.from("queue_entries").insert({
          queue_id: `Q-${Date.now()}`,
          tenant_id: tenantId,
          booking_id: bkId,
          patient_phone: patient.phone,
          patient_name: patient.name,
          doctor_id: selectedDoctor.doctor_id,
          doctor_name: selectedDoctor.name,
          queue_number: queueNumber,
          status: "waiting",
          check_in_time: now,
          walk_in: true,
          priority: 0,
          estimated_wait_minutes: estimatedWait,
          date: today,
        })

        if (queueInsertError) {
          console.error("Queue insert failed:", queueInsertError)
          toast.error("Failed to create queue entry")
        }

        const { error: apptUpdateError } = await supabase
          .from("appointments")
          .update({ check_in_status: "checked_in", arrival_time: now, queue_number: queueNumber })
          .eq("booking_id", bkId)
          .eq("tenant_id", tenantId)

        if (apptUpdateError) {
          console.error("Appointment update failed:", apptUpdateError)
        }

        createNotification({
          tenantId,
          type: "queue_checkin",
          title: "Walk-in patient checked in",
          message: `${patient.name} is waiting for Dr. ${selectedDoctor.name} (Queue #${queueNumber})`,
          targetRole: "DOCTOR",
          targetUserId: selectedDoctor.doctor_id,
          referenceId: bkId,
          referenceType: "queue_entry",
        })

        // Send WhatsApp token notification (fire-and-forget)
        fetch("/api/queue/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: patient.phone,
            patient_name: patient.name,
            queue_number: queueNumber,
            doctor_name: selectedDoctor.name,
            hospital_name: tenant?.hospital_name || "Hospital",
            estimated_wait: estimatedWait,
            waiting_ahead: waitingAhead || 0,
            queue_url: `${window.location.origin}/queue/${tenantId}`,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => toast.warning("Queue assigned but WhatsApp notification may not have been sent"))

        toast.success(`Queue #${queueNumber} assigned`)
      } else {
        toast.error(data.error || "Booking failed")
      }
    } catch {
      toast.error("Error creating booking")
    } finally {
      setLoading(false)
    }
  }, [patient, selectedDoctor, selectedDate, selectedTime, tenantId])

  const reset = () => {
    setStep("patient")
    setPhone("")
    setPatient(null)
    setPatientFound(null)
    setPatientName("")
    setPatientGender("")
    setPatientAge("")
    lookupDone.current = false
    setSelectedDoctor(null)
    setAvailability([])
    setAllSlots({})
    setSelectedDate("")
    setTimeSlots([])
    setSelectedTime("")
    setBookingId("")
    setWaSent(null)
  }

  const goBack = () => {
    if (step === "doctor") setStep("patient")
    else if (step === "slot") {
      setSelectedDate("")
      setTimeSlots([])
      setSelectedTime("")
      setStep("doctor")
    }
    else if (step === "confirm") setStep("slot")
  }

  const specialties = [...new Set(doctors.map((d) => d.specialty))]
  const currentStepIdx = STEP_CONFIG.findIndex((s) => s.key === step)

  const getShortDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]
  }
  const getDayNum = (dateStr: string) => new Date(dateStr + "T00:00:00").getDate()
  const getMonthShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]
  }

  const canProceedPatient = phone.replace(/\D/g, "").length >= 10 && patientName.trim().length > 0 && !lookingUp

  return (
    <div className="max-w-2xl mx-auto">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-t-2xl gradient-blue-premium p-6 pb-8">
        <div className="noise-overlay absolute inset-0 rounded-t-2xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            {step !== "patient" && step !== "done" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={goBack}
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
            )}
            <div className={cn("flex items-center gap-2", step === "patient" || step === "done" ? "" : "ml-auto")}>
              <MapPin className="w-4 h-4 text-white/70" />
              <span className="text-xs text-white/70 font-medium">{tenant?.hospital_name || "Hospital"}</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mt-3">
            {step === "done" ? "Booking Confirmed" : "Walk-in Appointment"}
          </h1>
          <p className="text-sm text-white/70 mt-1">
            {step === "patient" && "Enter patient details to get started"}
            {step === "doctor" && "Choose your specialist"}
            {step === "slot" && "Pick a convenient time"}
            {step === "confirm" && "Review and confirm"}
            {step === "done" && "Appointment has been scheduled"}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      {step !== "done" && (
        <div className="relative -mt-4 z-10 px-4 mb-4">
          <div className="glass rounded-2xl p-3 flex items-center justify-between gap-1">
            {STEP_CONFIG.map((s, i) => {
              const isActive = i === currentStepIdx
              const isDone = i < currentStepIdx
              const Icon = s.icon
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isDone ? "var(--success)" : isActive ? "var(--primary)" : "var(--muted)",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      isDone && "glow-green",
                      isActive && "glow-blue",
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-muted-foreground")} />
                    )}
                  </motion.div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-wide",
                    isDone ? "text-success" : isActive ? "text-primary" : "text-muted-foreground/50"
                  )}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "bg-card rounded-b-2xl border border-border border-t-0 shadow-sm",
        step === "done" && "rounded-2xl border-t -mt-4"
      )}>
        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* ========== PATIENT (single form) ========== */}
            {step === "patient" && (
              <motion.div
                key="patient"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Phone number */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Input
                      className="h-12 text-base rounded-xl border-2 border-border/50 focus:border-primary bg-muted/30 pr-24"
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      autoFocus
                      maxLength={13}
                    />
                    {/* Status indicator inside input */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {lookingUp && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          <span className="text-[10px] text-primary font-medium">Looking up...</span>
                        </div>
                      )}
                      {patientFound === true && !lookingUp && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] font-bold">
                          FOUND
                        </Badge>
                      )}
                      {patientFound === false && !lookingUp && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px] font-bold">
                          NEW
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    className="h-12 text-base rounded-xl border-2 border-border/50 focus:border-primary bg-muted/30"
                    placeholder="Patient full name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                {/* Gender + Age in row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Gender
                    </Label>
                    <Select value={patientGender} onValueChange={setPatientGender}>
                      <SelectTrigger className="w-full h-12 text-base rounded-xl border-2 border-border/50 bg-muted/30">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Age
                    </Label>
                    <Input
                      className="w-full h-12 text-base rounded-xl border-2 border-border/50 focus:border-primary bg-muted/30"
                      type="number"
                      placeholder="Age"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={proceedFromPatient}
                  disabled={!canProceedPatient || loading}
                  className="w-full h-12 rounded-xl text-base font-semibold gradient-blue hover:opacity-90 transition-opacity border-0"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ChevronRight className="w-5 h-5 mr-2" />
                  )}
                  Continue to Doctor
                </Button>
              </motion.div>
            )}

            {/* ========== DOCTOR SELECTION ========== */}
            {step === "doctor" && (
              <motion.div
                key="doctor"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Patient summary */}
                {patient && (
                  <div className="flex items-center gap-3 p-3 rounded-xl glass-subtle">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.phone}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {patientFound ? "EXISTING" : "NEW"}
                    </Badge>
                  </div>
                )}

                <div className="space-y-4">
                  {specialties.map((specialty) => {
                    const style = getSpecialtyStyle(specialty)
                    return (
                      <div key={specialty}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full bg-gradient-to-r", style.gradient)} />
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {specialty}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {doctors
                            .filter((d) => d.specialty === specialty)
                            .map((doctor) => (
                              <motion.button
                                key={doctor.doctor_id}
                                whileHover={{ scale: 1.01, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => fetchAvailability(doctor)}
                                disabled={loading}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border/50",
                                  "hover:border-primary/30 hover:shadow-lg transition-all text-left",
                                  "bg-gradient-to-r from-card to-muted/20"
                                )}
                              >
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0", style.icon)}>
                                  <Stethoscope className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold">{doctor.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{doctor.specialty}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                              </motion.button>
                            ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {loading && (
                  <div className="space-y-2">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                  </div>
                )}
              </motion.div>
            )}

            {/* ========== DATE & TIME ========== */}
            {step === "slot" && (
              <motion.div
                key="slot"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {selectedDoctor && (
                  <div className="flex items-center gap-3 p-3 rounded-xl glass-subtle">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getSpecialtyStyle(selectedDoctor.specialty).icon)}>
                      <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{selectedDoctor.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDoctor.specialty}</p>
                    </div>
                  </div>
                )}

                {/* Date cards */}
                {!selectedDate && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Select Date
                    </Label>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {availability.map((slot, i) => {
                        const isToday = slot.date === getTodayIST()
                        return (
                          <motion.button
                            key={slot.date}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={{ scale: 1.03, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => fetchTimeSlots(slot.date)}
                            disabled={slot.availableSlots === 0 || loading}
                            className={cn(
                              "flex flex-col items-center min-w-[72px] p-3 rounded-2xl border-2 transition-all",
                              slot.availableSlots === 0
                                ? "border-border/30 opacity-40 cursor-not-allowed"
                                : "border-border/50 hover:border-primary/40 hover:shadow-md",
                              isToday && "border-primary/30 bg-primary/5"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {getShortDay(slot.date)}
                            </span>
                            <span className="text-2xl font-bold mt-0.5 leading-none">{getDayNum(slot.date)}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{getMonthShort(slot.date)}</span>
                            <div className={cn(
                              "mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold",
                              slot.availableSlots > 10
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : slot.availableSlots > 3
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {slot.availableSlots}
                            </div>
                            {isToday && <span className="text-[8px] font-bold text-primary mt-1">TODAY</span>}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Time slots */}
                {selectedDate && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> {formatDate(selectedDate)}
                      </Label>
                      <button
                        onClick={() => { setSelectedDate(""); setTimeSlots([]); setSelectedTime(""); }}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
                      </div>
                    ) : (() => {
                      const available = timeSlots.filter((s) => s.status === "available")
                      if (available.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No slots available</p>
                          </div>
                        )
                      }
                      const getHour = (t: string) => {
                        const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
                        if (!match) return parseInt(t.split(":")[0]) || 0
                        let h = parseInt(match[1])
                        const period = match[3]?.toUpperCase()
                        if (period === "PM" && h !== 12) h += 12
                        if (period === "AM" && h === 12) h = 0
                        return h
                      }
                      const morning = available.filter((s) => getHour(s.time) < 12)
                      const afternoon = available.filter((s) => { const h = getHour(s.time); return h >= 12 && h < 17 })
                      const evening = available.filter((s) => getHour(s.time) >= 17)
                      const groups = [
                        { label: "Morning", slots: morning, Icon: Sun, color: "text-amber-500" },
                        { label: "Afternoon", slots: afternoon, Icon: Sunset, color: "text-orange-500" },
                        { label: "Evening", slots: evening, Icon: Moon, color: "text-indigo-500" },
                      ].filter((g) => g.slots.length > 0)

                      return (
                        <div className="space-y-4">
                          {groups.map((group) => (
                            <div key={group.label}>
                              <div className="flex items-center gap-2 mb-2">
                                <group.Icon className={cn("w-3.5 h-3.5", group.color)} />
                                <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
                                <span className="text-[10px] text-muted-foreground/50">({group.slots.length})</span>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {group.slots.map((slot) => (
                                  <motion.button
                                    key={slot.time}
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => { setSelectedTime(slot.time); setStep("confirm"); }}
                                    className={cn(
                                      "py-2.5 px-2 rounded-xl text-sm font-semibold transition-all border-2 hover:shadow-md",
                                      selectedTime === slot.time
                                        ? "border-primary bg-primary text-white shadow-lg shadow-primary/25"
                                        : "border-border/50 hover:border-primary/40 bg-muted/30"
                                    )}
                                  >
                                    {formatTime(slot.time)}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {/* ========== CONFIRM ========== */}
            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border-2 border-border/50 overflow-hidden">
                  <div className={cn("p-4", getSpecialtyStyle(selectedDoctor?.specialty || "").icon)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-white">
                        <p className="font-bold">{selectedDoctor?.name}</p>
                        <p className="text-sm text-white/80">{selectedDoctor?.specialty}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Patient</p>
                        <p className="text-sm font-semibold">{patient?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-semibold">{formatDate(selectedDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="text-sm font-semibold">{formatTime(selectedTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={confirmBooking}
                  disabled={loading}
                  className="w-full h-13 rounded-xl text-base font-bold gradient-green hover:opacity-90 transition-opacity border-0 py-3.5"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Booking...</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Appointment</>
                  )}
                </Button>
              </motion.div>
            )}

            {/* ========== DONE ========== */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="text-center space-y-5 py-2"
              >
                <div className="relative inline-block">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                    className="w-20 h-20 rounded-3xl gradient-green glow-green flex items-center justify-center mx-auto"
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="absolute -top-1 -right-1 w-7 h-7 rounded-full gradient-blue flex items-center justify-center"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h2 className="text-xl font-bold">All Set!</h2>
                  <p className="text-sm text-muted-foreground mt-1">Appointment booked and queued</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border-2 border-border/50 overflow-hidden text-left"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{patient?.name}</span>
                      </div>
                      <Badge className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                        {bookingId}
                      </Badge>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Doctor</p>
                        <p className="font-semibold">{selectedDoctor?.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Specialty</p>
                        <p className="font-semibold">{selectedDoctor?.specialty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-semibold">{formatDate(selectedDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="font-semibold">{formatTime(selectedTime)}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* WhatsApp status */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  {waSent === true && (
                    <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-400 text-left">WhatsApp confirmation sent</p>
                    </div>
                  )}
                  {waSent === false && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">WhatsApp not delivered</p>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        Ask the patient to send &quot;Hi&quot; to receive their QR code.
                      </p>
                      <a
                        href={`https://wa.me/${tenant?.whatsapp_phone_number || "918125442376"}?text=${encodeURIComponent(`Hi, I just booked appointment ${bookingId}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Open WhatsApp
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <Button
                    onClick={reset}
                    className="w-full h-12 rounded-xl text-base font-semibold gradient-blue hover:opacity-90 transition-opacity border-0"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Book Another Appointment
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
