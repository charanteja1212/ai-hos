"use client"

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { AdmitDialog } from "@/components/reception/admit-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getInitials } from "@/lib/utils/format"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  Calendar,
  BedDouble,
  Pill,
  TestTube,
  User,
  FileText,
  Stethoscope,
  Heart,
  Thermometer,
  Activity,
  Weight,
  Wind,
  Copy,
  ChevronDown,
  Keyboard,
  Timer,
  Printer,
} from "lucide-react"
import { formatDate } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { MedicineCombobox } from "@/components/doctor/medicine-combobox"
import { PrescriptionTemplates } from "@/components/doctor/prescription-templates"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import { getVitalStatus, getVitalRingClass, getVitalDotClass } from "@/components/ui/normal-range-indicator"
import { printPrescription } from "@/lib/print-prescription"
import { StartCallButton } from "@/components/telemedicine/start-call-button"
import type { SessionUser } from "@/types/auth"
import type { Patient, Prescription, PrescriptionItem } from "@/types/database"
import { buildInvoiceData, type TenantTaxConfig } from "@/lib/billing/tax"

interface VitalsData {
  bp?: string
  pulse?: string
  temp?: string
  spo2?: string
  weight?: string
}

export default function ConsultPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>}>
      <ConsultPageContent />
    </Suspense>
  )
}

function ConsultPageContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()

  const patientPhone = searchParams.get("patient") || ""
  const queueId = searchParams.get("queue") || ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [history, setHistory] = useState<Prescription[]>([])

  // Consultation form
  const [symptoms, setSymptoms] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [vitals, setVitals] = useState<VitalsData>({})
  const [notes, setNotes] = useState("")
  const [followUpDays, setFollowUpDays] = useState("")

  // Medicines
  const [medicines, setMedicines] = useState<PrescriptionItem[]>([
    { medicine_name: "", dosage: "", frequency: "1-0-1", duration: "5 days" },
  ])

  // Lab tests
  const [labTests, setLabTests] = useState<string[]>([])
  const [newTest, setNewTest] = useState("")

  // Admit dialog
  const [showAdmit, setShowAdmit] = useState(false)
  // History filter
  const [myHistoryOnly, setMyHistoryOnly] = useState(false)
  // History accordion: which prescription is expanded
  const [expandedRx, setExpandedRx] = useState<string | null>(null)
  // Diagnosis suggestions
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<string[]>([])
  const [showDiagnosisSuggestions, setShowDiagnosisSuggestions] = useState(false)
  // Consultation start time for floating bar timer
  const consultStartRef = useRef<string>(new Date().toISOString())

  // Fetch patient & history
  useEffect(() => {
    if (!patientPhone) {
      // No patient param at all — nothing to load
      setLoading(false)
      return
    }
    if (!tenantId) {
      // tenantId not ready yet (BranchProvider loading) — keep loading, will re-run
      return
    }
    setLoading(true)
    const supabase = createBrowserClient()

    Promise.all([
      supabase
        .from("patients")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`phone.eq.${patientPhone.replace(/[^a-zA-Z0-9\s\-\.]/g, "")},phone.eq.+${patientPhone.replace(/[^a-zA-Z0-9\s\-\.]/g, "")}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("patient_phone", patientPhone)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([patientRes, historyRes]) => {
      if (patientRes.data) setPatient(patientRes.data as Patient)
      if (historyRes.data) setHistory(historyRes.data as Prescription[])
      setLoading(false)
    }).catch((err) => {
      console.error("[consult] Failed to fetch patient data:", err)
      setLoading(false)
    })
  }, [patientPhone, tenantId])

  const addMedicine = () => {
    setMedicines([...medicines, { medicine_name: "", dosage: "", frequency: "1-0-1", duration: "5 days" }])
  }

  const removeMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx))
  }

  const updateMedicine = (idx: number, field: keyof PrescriptionItem, value: string) => {
    const updated = [...medicines]
    updated[idx] = { ...updated[idx], [field]: value }
    setMedicines(updated)
  }

  const addLabTest = () => {
    if (newTest.trim()) {
      setLabTests([...labTests, newTest.trim()])
      setNewTest("")
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    const supabase = createBrowserClient()

    try {
      const validMedicines = medicines.filter((m) => m.medicine_name.trim())
      const followUpDate = followUpDays
        ? new Date(Date.now() + parseInt(followUpDays) * 86400000).toISOString().split("T")[0]
        : null

      // Generate IDs once so prescription and pharmacy share the same reference
      const prescriptionId = `RX-${Date.now()}`
      const now = new Date().toISOString()

      // Get the booking_id from queue entry (queueId is the queue_id, not booking_id)
      const { data: queueEntry } = await supabase
        .from("queue_entries")
        .select("booking_id")
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)
        .single()
      const bookingId = queueEntry?.booking_id || queueId

      // Fetch medicine prices + doctor consultation fee for billing
      const [medicineRes, doctorRes] = await Promise.all([
        validMedicines.length > 0
          ? supabase.from("medicines").select("medicine_name, price").eq("tenant_id", tenantId)
              .in("medicine_name", validMedicines.map(m => m.medicine_name))
          : Promise.resolve({ data: [] as { medicine_name: string; price: number }[] }),
        supabase.from("doctors").select("consultation_fee").eq("doctor_id", user?.doctorId).single(),
      ])
      const medicinePrices: Record<string, number> = {}
      ;(medicineRes.data || []).forEach((m: { medicine_name: string; price: number }) => {
        medicinePrices[m.medicine_name] = m.price
      })
      const consultationFee = doctorRes.data?.consultation_fee || 200

      // Save prescription (critical — if this fails, stop the whole flow)
      const savedParts: string[] = []
      if (validMedicines.length > 0 || diagnosis || symptoms) {
        const { error } = await supabase.from("prescriptions").insert({
          prescription_id: prescriptionId,
          booking_id: bookingId,
          patient_phone: patientPhone,
          doctor_id: user?.doctorId,
          doctor_name: user?.name || "",
          type: "consultation",
          items: validMedicines,
          diagnosis,
          symptoms,
          vitals,
          notes,
          follow_up_date: followUpDate,
          tenant_id: tenantId,
        })
        if (error) throw error
        savedParts.push("prescription")

        // Fetch tenant GST config for invoice
        const { data: tenantConfig } = await supabase
          .from("tenants")
          .select("enable_gst, gst_percentage, gstin, hsn_code, state_code")
          .eq("tenant_id", tenantId)
          .single()
        const taxConfig: TenantTaxConfig | null = tenantConfig?.enable_gst
          ? tenantConfig as TenantTaxConfig
          : null

        // Auto-generate consultation invoice with GST
        const consultItems = [{ description: `Consultation — Dr. ${user?.name}`, amount: consultationFee, quantity: 1 }]
        const consultInvoice = buildInvoiceData({
          invoice_id: `INV-C-${Date.now()}`,
          tenant_id: tenantId,
          patient_phone: patientPhone,
          patient_name: patient?.name,
          type: "consultation",
          items: consultItems,
          payment_status: "unpaid",
          booking_id: bookingId,
        }, taxConfig)
        await supabase.from("invoices").insert(consultInvoice)
      }

      // Order lab tests
      let labTotal = 0
      if (labTests.length > 0) {
        // Fetch test prices for billing
        const { data: testPriceData } = await supabase.from("lab_tests")
          .select("test_name, price").eq("tenant_id", tenantId)
          .in("test_name", labTests)
        const testPriceMap: Record<string, number> = {}
        ;(testPriceData || []).forEach((t: { test_name: string; price: number }) => {
          testPriceMap[t.test_name] = t.price
        })
        labTotal = labTests.reduce((sum, t) => sum + (testPriceMap[t] || 0), 0)

        const { error: labError } = await supabase.from("lab_orders").insert({
          order_id: `LAB-${Date.now()}`,
          tenant_id: tenantId,
          patient_phone: patientPhone,
          patient_name: patient?.name || "Patient",
          doctor_id: user?.doctorId,
          doctor_name: user?.name,
          booking_id: bookingId,
          tests: labTests.map((t) => ({ test_id: t, test_name: t, status: "ordered" })),
          status: "ordered",
          total_amount: labTotal,
        })
        if (labError) {
          console.error("[consult] Lab order failed:", labError)
          toast.error("Prescription saved but lab order failed — please create manually in lab module")
        } else {
          savedParts.push("lab order")
        }
      }

      // Create pharmacy order if medicines prescribed
      if (validMedicines.length > 0) {
        const pharmacyTotal = validMedicines.reduce((sum, m) => {
          const price = medicinePrices[m.medicine_name] || 0
          const qty = m.quantity ? parseInt(String(m.quantity)) || 1 : 1
          return sum + (price * qty)
        }, 0)

        const { error: pharmaError } = await supabase.from("pharmacy_orders").insert({
          order_id: `PHR-${Date.now()}`,
          tenant_id: tenantId,
          prescription_id: prescriptionId,
          patient_phone: patientPhone,
          patient_name: patient?.name || "Patient",
          doctor_name: user?.name,
          items: validMedicines,
          total_amount: pharmacyTotal,
          status: "pending",
        })
        if (pharmaError) {
          console.error("[consult] Pharmacy order failed:", pharmaError)
          toast.error("Prescription saved but pharmacy order failed — please create manually in pharmacy module")
        } else {
          savedParts.push("pharmacy order")
        }
      }

      // Complete queue entry
      await supabase
        .from("queue_entries")
        .update({ status: "completed", consultation_end: now })
        .eq("queue_id", queueId)
        .eq("tenant_id", tenantId)

      // Update appointment status
      if (bookingId && bookingId !== queueId) {
        await supabase
          .from("appointments")
          .update({
            status: "completed",
            check_in_status: "completed",
          })
          .eq("booking_id", bookingId)
          .eq("tenant_id", tenantId)
      }

      // Fire-and-forget: Send post-consultation notifications via internal API
      fetch("/api/notifications/post-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescription_id: prescriptionId,
          booking_id: bookingId,
          patient_phone: patientPhone,
          patient_name: patient?.name || "",
          doctor_id: user?.doctorId || "",
          doctor_name: user?.name || "",
          diagnosis,
          symptoms,
          vitals,
          items: validMedicines,
          lab_tests: labTests,
          follow_up_date: followUpDate,
          notes,
          tenant_id: tenantId,
        }),
        signal: AbortSignal.timeout(15000),
      }).catch((err) => console.error("Post-consultation notification failed:", err))

      // Clear draft
      localStorage.removeItem(`consult-draft-${queueId}`)

      toast.success("Consultation saved successfully")
      router.push("/doctor")
    } catch (err) {
      console.error("[consult] Failed to save consultation:", err)
      toast.error("Failed to save consultation — prescription was not saved")
    } finally {
      setSaving(false)
    }
  }, [medicines, labTests, diagnosis, symptoms, vitals, notes, followUpDays, queueId, patientPhone, patient, user, tenantId, router])

  // Keyboard shortcuts: Ctrl+Enter save & complete
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [handleSave])

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!queueId) return
    const key = `consult-draft-${queueId}`
    const timeout = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({ symptoms, diagnosis, vitals, notes, followUpDays, medicines, labTests }))
    }, 2000)
    return () => clearTimeout(timeout)
  }, [symptoms, diagnosis, vitals, notes, followUpDays, medicines, labTests, queueId])

  // Restore draft on mount
  useEffect(() => {
    if (!queueId) return
    const key = `consult-draft-${queueId}`
    const draft = localStorage.getItem(key)
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        if (parsed.symptoms) setSymptoms(parsed.symptoms)
        if (parsed.diagnosis) setDiagnosis(parsed.diagnosis)
        if (parsed.vitals) setVitals(parsed.vitals)
        if (parsed.notes) setNotes(parsed.notes)
        if (parsed.followUpDays) setFollowUpDays(parsed.followUpDays)
        if (parsed.medicines?.length) setMedicines(parsed.medicines)
        if (parsed.labTests?.length) setLabTests(parsed.labTests)
      } catch { /* ignore parse errors */ }
    }
  }, [queueId])

  // Build diagnosis suggestions from patient history
  const allDiagnoses = useMemo(() => {
    const diags = new Set<string>()
    history.forEach((rx) => {
      if (rx.diagnosis) {
        rx.diagnosis.split(",").forEach((d: string) => {
          const trimmed = d.trim()
          if (trimmed) diags.add(trimmed)
        })
      }
    })
    return Array.from(diags)
  }, [history])

  // Filter diagnosis suggestions based on input
  useEffect(() => {
    if (diagnosis.length < 2) {
      setDiagnosisSuggestions([])
      setShowDiagnosisSuggestions(false)
      return
    }
    const lower = diagnosis.toLowerCase()
    const matches = allDiagnoses.filter((d) => d.toLowerCase().includes(lower))
    setDiagnosisSuggestions(matches.slice(0, 5))
    setShowDiagnosisSuggestions(matches.length > 0)
  }, [diagnosis, allDiagnoses])

  // Copy prescription from history
  const handleCopyPrescription = useCallback((rx: Prescription) => {
    if (rx.items && rx.items.length > 0) {
      setMedicines(rx.items.map((item) => ({
        medicine_name: item.medicine_name || "",
        dosage: item.dosage || "",
        frequency: item.frequency || "1-0-1",
        duration: item.duration || "5 days",
      })))
    }
    if (rx.diagnosis) setDiagnosis(rx.diagnosis)
    toast.success("Prescription copied — review and modify as needed")
  }, [])

  const vitalsConfig = [
    { key: "bp" as const, label: "Blood Pressure", unit: "mmHg", placeholder: "120/80", icon: Heart, gradient: "from-rose-500 to-pink-600", bg: "bg-rose-50 dark:bg-rose-950/20" },
    { key: "pulse" as const, label: "Pulse Rate", unit: "bpm", placeholder: "72", icon: Activity, gradient: "from-orange-500 to-amber-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
    { key: "temp" as const, label: "Temperature", unit: "°F", placeholder: "98.6", icon: Thermometer, gradient: "from-blue-500 to-cyan-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { key: "spo2" as const, label: "SpO2", unit: "%", placeholder: "98", icon: Wind, gradient: "from-emerald-500 to-green-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { key: "weight" as const, label: "Weight", unit: "kg", placeholder: "70", icon: Weight, gradient: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!patientPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Stethoscope className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No patient selected</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Go to your dashboard and click &quot;Start Consult&quot; on a waiting patient.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/doctor")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6">
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
    <div className="space-y-6 max-w-5xl pb-4">
      {/* Header with gradient patient info strip */}
      <div className="rounded-2xl gradient-blue p-4 sm:p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer rounded-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push("/doctor")} className="text-white hover:bg-white/20 rounded-xl shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-base sm:text-lg font-bold shrink-0">
              {getInitials(patient?.name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate">{patient?.name || "Patient"}</h1>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/70 flex-wrap">
                <span>{patientPhone}</span>
                {patient?.age && <span>Age: {patient.age}</span>}
                {patient?.gender && <span>{patient.gender}</span>}
                {patient?.blood_group && <span>Blood: {patient.blood_group}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 self-end sm:self-center">
            {patient && tenantId && queueId && (
              <StartCallButton
                tenantId={tenantId}
                appointmentId={queueId}
                patientName={patient.name || "Patient"}
                doctorName={user?.name || "Doctor"}
              />
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowAdmit(true)} className="text-white hover:bg-white/20 border border-white/20 hidden sm:flex">
              <BedDouble className="w-4 h-4 mr-2" /> Admit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const validMedicines = medicines.filter((m) => m.medicine_name.trim())
              printPrescription({
                hospitalName: user?.hospitalName || "Hospital",
                doctorName: user?.name || "Doctor",
                doctorSpecialty: user?.specialty,
                patientName: patient?.name || "Patient",
                patientPhone,
                patientAge: patient?.age ? String(patient.age) : undefined,
                patientGender: patient?.gender,
                date: new Date().toLocaleDateString("en-IN"),
                symptoms,
                diagnosis,
                vitals,
                medicines: validMedicines,
                labTests,
                notes,
                followUpDate: followUpDays ? `${followUpDays} days` : null,
              })
            }} className="text-white hover:bg-white/20 border border-white/20 hidden sm:flex">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-white text-blue-600 hover:bg-white/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save & Complete
            </Button>
          </div>
        </div>
      </div>

      {/* Allergies warning banner */}
      {patient?.allergies && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <Heart className="w-4 h-4 shrink-0" />
          <strong>Allergies:</strong> {patient.allergies}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Consultation Form */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="consult">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="consult" className="rounded-lg data-[state=active]:shadow-sm"><Stethoscope className="w-4 h-4 mr-1.5" />Consult</TabsTrigger>
              <TabsTrigger value="prescribe" className="rounded-lg data-[state=active]:shadow-sm"><Pill className="w-4 h-4 mr-1.5" />Prescribe</TabsTrigger>
              <TabsTrigger value="lab" className="rounded-lg data-[state=active]:shadow-sm"><TestTube className="w-4 h-4 mr-1.5" />Lab Tests</TabsTrigger>
            </TabsList>

            {/* Consultation Tab */}
            <TabsContent value="consult" className="space-y-4">
              {/* Vitals — Premium Mini-Cards */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Vitals
                </h3>
                <div className="flex flex-wrap gap-3">
                  {vitalsConfig.map((v) => {
                    const Icon = v.icon
                    const status = getVitalStatus(v.key, vitals[v.key])
                    const ringClass = getVitalRingClass(status)
                    return (
                      <div
                        key={v.key}
                        className={cn("rounded-xl border border-border p-3 flex items-center gap-3 min-w-[160px] flex-1 card-hover transition-all", v.bg, ringClass)}
                      >
                        <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 relative", v.gradient)}>
                          <Icon className="w-4 h-4" />
                          {status && (
                            <div className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900", getVitalDotClass(status))} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{v.label}</p>
                          <div className="flex items-baseline gap-1">
                            <Input
                              placeholder={v.placeholder}
                              value={vitals[v.key] || ""}
                              onChange={(e) => setVitals({ ...vitals, [v.key]: e.target.value })}
                              className="h-7 px-0 border-0 bg-transparent text-sm font-semibold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">{v.unit}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Symptoms & Diagnosis */}
              <Card className="card-hover">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Symptoms</Label>
                    <Textarea className="mt-1.5 min-h-[80px] resize-y" placeholder="Fever, cough, headache..." value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
                  </div>
                  <div className="relative">
                    <Label className="text-sm font-medium">Diagnosis</Label>
                    <Input
                      className="mt-1.5"
                      placeholder="Viral fever, Upper respiratory infection..."
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      onFocus={() => { if (diagnosisSuggestions.length > 0) setShowDiagnosisSuggestions(true) }}
                      onBlur={() => { setTimeout(() => setShowDiagnosisSuggestions(false), 200) }}
                    />
                    <AnimatePresence>
                      {showDiagnosisSuggestions && diagnosisSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
                        >
                          <p className="text-[10px] font-medium text-muted-foreground px-3 pt-2 pb-1 uppercase tracking-wider">Previous diagnoses</p>
                          {diagnosisSuggestions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setDiagnosis(sug); setShowDiagnosisSuggestions(false) }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors"
                            >
                              {sug}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Notes</Label>
                    <Textarea className="mt-1.5 min-h-[80px] resize-y" placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              {/* Follow-up */}
              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <Label className="font-medium">Follow-up after</Label>
                    <Select value={followUpDays || "none"} onValueChange={(v) => setFollowUpDays(v === "none" ? "" : v)}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No follow-up</SelectItem>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="5">5 days</SelectItem>
                        <SelectItem value="7">1 week</SelectItem>
                        <SelectItem value="14">2 weeks</SelectItem>
                        <SelectItem value="30">1 month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Prescription Tab */}
            <TabsContent value="prescribe" className="space-y-3">
              <PrescriptionTemplates
                doctorId={user?.doctorId || ""}
                tenantId={tenantId}
                currentMedicines={medicines}
                onLoadTemplate={(items) => setMedicines(items)}
              />
              {medicines.map((med, idx) => (
                <div key={idx}>
                  <Card className="card-hover">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Medicine #{idx + 1}</span>
                        <div className="ml-auto">
                          <Button variant="ghost" size="icon" onClick={() => removeMedicine(idx)} className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                        <div className="col-span-2 sm:col-span-4">
                          <Label className="text-xs">Medicine</Label>
                          <MedicineCombobox
                            tenantId={tenantId}
                            value={med.medicine_name}
                            onChange={({ name, dosage }) => {
                              const updated = [...medicines]
                              updated[idx] = { ...updated[idx], medicine_name: name }
                              if (dosage) updated[idx] = { ...updated[idx], dosage }
                              setMedicines(updated)
                            }}
                            placeholder="Search medicine..."
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <Label className="text-xs">Dosage</Label>
                          <Input placeholder="500mg" value={med.dosage} onChange={(e) => updateMedicine(idx, "dosage", e.target.value)} />
                        </div>
                        <div className="col-span-1 sm:col-span-3">
                          <Label className="text-xs">Frequency</Label>
                          <Select value={med.frequency} onValueChange={(v) => updateMedicine(idx, "frequency", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-0-0">Morning</SelectItem>
                              <SelectItem value="0-0-1">Night</SelectItem>
                              <SelectItem value="1-0-1">Morning-Night</SelectItem>
                              <SelectItem value="1-1-1">Thrice daily</SelectItem>
                              <SelectItem value="0-1-0">Afternoon</SelectItem>
                              <SelectItem value="SOS">SOS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <Label className="text-xs">Duration</Label>
                          <Select value={med.duration} onValueChange={(v) => updateMedicine(idx, "duration", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3 days">3 days</SelectItem>
                              <SelectItem value="5 days">5 days</SelectItem>
                              <SelectItem value="7 days">7 days</SelectItem>
                              <SelectItem value="10 days">10 days</SelectItem>
                              <SelectItem value="14 days">14 days</SelectItem>
                              <SelectItem value="30 days">30 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
              <Button variant="outline" onClick={addMedicine} className="w-full card-hover">
                <Plus className="w-4 h-4 mr-2" /> Add Medicine
              </Button>
            </TabsContent>

            {/* Lab Tests Tab */}
            <TabsContent value="lab" className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Test name (e.g. CBC, Blood Sugar)" value={newTest} onChange={(e) => setNewTest(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLabTest()} />
                <Button onClick={addLabTest} disabled={!newTest.trim()}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              {labTests.length > 0 && (
                <Card className="card-hover">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-2">
                      {labTests.map((test, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1 py-1.5 px-3">
                          <TestTube className="w-3 h-3" /> {test}
                          <button onClick={() => setLabTests(labTests.filter((_, i) => i !== idx))} className="ml-1 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {labTests.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <TestTube className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No lab tests ordered</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Type a test name above and press Enter</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Patient Info & History */}
        <div className="space-y-4">
          {/* Patient info card with gradient header */}
          <Card className="overflow-hidden card-hover">
            <div className="gradient-green px-4 py-3 flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-sm">
                {getInitials(patient?.name)}
              </div>
              <div>
                <p className="font-semibold text-sm">{patient?.name}</p>
                <p className="text-xs text-white/70">{patient?.phone}</p>
              </div>
            </div>
            <CardContent className="pt-4 space-y-2.5 text-sm">
              {patient?.age && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Age: {patient.age} {patient?.gender && `\u2022 ${patient.gender}`}</span>
                </div>
              )}
              {patient?.blood_group && (
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                  <span>Blood: {patient.blood_group}</span>
                </div>
              )}
              {patient?.chronic_diseases && (
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Chronic: {patient.chronic_diseases}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History with expandable accordion */}
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Visit History
                <Badge variant="secondary" className="ml-auto text-xs">
                  {(myHistoryOnly ? history.filter((rx) => rx.doctor_id === user?.doctorId) : history).length}
                </Badge>
              </CardTitle>
              <div className="flex gap-1 mt-1">
                <Button
                  variant={myHistoryOnly ? "outline" : "default"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setMyHistoryOnly(false)}
                >
                  All Doctors
                </Button>
                <Button
                  variant={myHistoryOnly ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setMyHistoryOnly(true)}
                >
                  My History
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {((myHistoryOnly ? history.filter((rx) => rx.doctor_id === user?.doctorId) : history).length === 0) ? (
                <div className="text-center py-4">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">No previous visits</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">First consultation</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(myHistoryOnly ? history.filter((rx) => rx.doctor_id === user?.doctorId) : history).map((rx) => (
                    <Collapsible
                      key={rx.prescription_id}
                      open={expandedRx === rx.prescription_id}
                      onOpenChange={(open) => setExpandedRx(open ? rx.prescription_id : null)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left rounded-lg p-2.5 hover:bg-accent/30 transition-colors group">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">
                              {rx.created_at ? formatDate(rx.created_at.split("T")[0]) : "Unknown"}
                            </span>
                            <span className="text-muted-foreground/50">&middot;</span>
                            <span>{rx.doctor_name}</span>
                            <ChevronDown className={cn(
                              "w-3 h-3 ml-auto transition-transform",
                              expandedRx === rx.prescription_id && "rotate-180"
                            )} />
                          </div>
                          {rx.diagnosis && (
                            <p className="text-xs font-medium mt-1 text-foreground">{rx.diagnosis}</p>
                          )}
                          {rx.items && rx.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {rx.items.slice(0, 3).map((item, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] py-0">
                                  <Pill className="w-2.5 h-2.5 mr-0.5" />
                                  {item.medicine_name}
                                </Badge>
                              ))}
                              {rx.items.length > 3 && (
                                <Badge variant="outline" className="text-[10px] py-0">+{rx.items.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-2 mr-2 mb-2 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                          {rx.symptoms && (
                            <div className="text-xs"><span className="font-medium text-muted-foreground">Symptoms:</span> {rx.symptoms}</div>
                          )}
                          {rx.vitals && Object.keys(rx.vitals).length > 0 && (
                            <div className="text-xs flex flex-wrap gap-2">
                              <span className="font-medium text-muted-foreground">Vitals:</span>
                              {Object.entries(rx.vitals as Record<string, string>).map(([k, v]) => v && (
                                <Badge key={k} variant="secondary" className="text-[10px]">{k}: {v}</Badge>
                              ))}
                            </div>
                          )}
                          {rx.items && rx.items.length > 0 && (
                            <div className="text-xs space-y-1">
                              <span className="font-medium text-muted-foreground">Medicines:</span>
                              {rx.items.map((item, i) => (
                                <div key={i} className="ml-2 flex items-center gap-2">
                                  <Pill className="w-3 h-3 text-green-500 shrink-0" />
                                  <span className="font-medium">{item.medicine_name}</span>
                                  <span className="text-muted-foreground">{item.dosage} &middot; {item.frequency} &middot; {item.duration}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {rx.notes && (
                            <div className="text-xs"><span className="font-medium text-muted-foreground">Notes:</span> {rx.notes}</div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 mt-1"
                            onClick={(e) => { e.stopPropagation(); handleCopyPrescription(rx) }}
                          >
                            <Copy className="w-3 h-3" />
                            Copy Prescription
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admit Dialog */}
      {showAdmit && patient && (
        <AdmitDialog
          patientPhone={patient.phone}
          patientName={patient.name}
          doctorId={user?.doctorId}
          doctorName={user?.name}
          bookingId={queueId}
          tenantId={tenantId}
          open={showAdmit}
          onClose={() => setShowAdmit(false)}
        />
      )}

    </div>
    </div>

    {/* Action Bar — pinned at bottom, outside scroll area */}
    <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-border/40 bg-background">
      <div className="max-w-5xl">
        <div className="glass rounded-2xl border border-border/50 p-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="w-3.5 h-3.5 text-blue-500" />
              <span>Session:</span>
              <ElapsedTimer startTime={consultStartRef.current} warningMinutes={15} dangerMinutes={30} />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Keyboard className="w-3 h-3" />
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Enter</kbd>
              <span>save</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdmit(true)}
              className="gap-1 hidden sm:flex"
            >
              <BedDouble className="w-3.5 h-3.5" />
              Admit
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="gap-1.5 gradient-blue hover:opacity-90 transition-opacity"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save & Complete
            </Button>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

