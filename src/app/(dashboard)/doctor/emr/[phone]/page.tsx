"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate, formatTime } from "@/lib/utils/date"
import { formatPhone } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentUpload } from "@/components/shared/document-upload"
import { DocumentGallery } from "@/components/shared/document-gallery"
import { SectionHeader } from "@/components/shared/section-header"
import { AbhaCard } from "@/components/abdm/abha-card"
import { AbhaLinkDialog } from "@/components/abdm/abha-link-dialog"
import { ConsentManager } from "@/components/abdm/consent-manager"
import { HealthRecordExport } from "@/components/abdm/health-record-export"
import {
  ArrowLeft,
  Heart,
  Activity,
  Thermometer,
  Wind,
  Scale,
  AlertTriangle,
  Plus,
  FileText,
  Pill,
  Stethoscope,
  TrendingUp,
  Clock,
  X,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"
import type {
  Patient,
  Vitals,
  ClinicalNote,
  MedicalCondition,
  Allergy,
  Prescription,
  Appointment,
} from "@/types/database"

export default function EMRPage({ params }: { params: Promise<{ phone: string }> }) {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const { activeTenantId: tenantId } = useBranch()
  const router = useRouter()

  const [phone, setPhone] = useState("")
  const [patient, setPatient] = useState<Patient | null>(null)
  const [vitalsHistory, setVitalsHistory] = useState<Vitals[]>([])
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([])
  const [conditions, setConditions] = useState<MedicalCondition[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [showAddVitals, setShowAddVitals] = useState(false)
  const [showAddCondition, setShowAddCondition] = useState(false)
  const [showAddAllergy, setShowAddAllergy] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    params.then((p) => setPhone(decodeURIComponent(p.phone)))
  }, [params])

  const fetchAll = useCallback(async () => {
    if (!phone || !tenantId) return
    setLoading(true)
    const supabase = createBrowserClient()

    const [patientRes, vitalsRes, notesRes, condRes, allergyRes, rxRes, apptRes] =
      await Promise.all([
        supabase.from("patients").select("*").eq("phone", phone).eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("vitals").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("clinical_notes").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("medical_conditions").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("allergies").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("prescriptions").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
        supabase.from("appointments").select("*").eq("patient_phone", phone).eq("tenant_id", tenantId).order("date", { ascending: false }).limit(20),
      ])

    setPatient(patientRes.data as Patient | null)
    setVitalsHistory((vitalsRes.data || []) as Vitals[])
    setClinicalNotes((notesRes.data || []) as ClinicalNote[])
    setConditions((condRes.data || []) as MedicalCondition[])
    setAllergies((allergyRes.data || []) as Allergy[])
    setPrescriptions((rxRes.data || []) as Prescription[])
    setAppointments((apptRes.data || []) as Appointment[])
    setLoading(false)
  }, [phone, tenantId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Add Vitals ─────────────────────────────────────────────────────────────

  const [newVitals, setNewVitals] = useState<Partial<Vitals>>({})

  async function saveVitals() {
    if (!phone || !tenantId) return
    setSaving(true)
    const supabase = createBrowserClient()
    const bmi = newVitals.weight && newVitals.height
      ? +(newVitals.weight / ((newVitals.height / 100) ** 2)).toFixed(1)
      : undefined

    await supabase.from("vitals").insert({
      patient_phone: phone,
      tenant_id: tenantId,
      recorded_by: user?.doctorId || user?.name || "",
      recorded_by_name: user?.name || "",
      bp_systolic: newVitals.bp_systolic || null,
      bp_diastolic: newVitals.bp_diastolic || null,
      pulse: newVitals.pulse || null,
      temperature: newVitals.temperature || null,
      spo2: newVitals.spo2 || null,
      weight: newVitals.weight || null,
      height: newVitals.height || null,
      bmi: bmi || null,
      respiratory_rate: newVitals.respiratory_rate || null,
      blood_sugar_fasting: newVitals.blood_sugar_fasting || null,
      blood_sugar_pp: newVitals.blood_sugar_pp || null,
      notes: newVitals.notes || null,
    })

    setNewVitals({})
    setShowAddVitals(false)
    setSaving(false)
    fetchAll()
  }

  // ─── Add Condition ──────────────────────────────────────────────────────────

  const [newCondition, setNewCondition] = useState<Partial<MedicalCondition>>({ category: "chronic", severity: "moderate", status: "active" })

  async function saveCondition() {
    if (!phone || !tenantId || !newCondition.condition_name) return
    setSaving(true)
    const supabase = createBrowserClient()
    await supabase.from("medical_conditions").insert({
      patient_phone: phone,
      tenant_id: tenantId,
      condition_name: newCondition.condition_name,
      icd_code: newCondition.icd_code || null,
      category: newCondition.category || "chronic",
      severity: newCondition.severity || "moderate",
      status: newCondition.status || "active",
      onset_date: newCondition.onset_date || null,
      diagnosed_by: user?.doctorId || "",
      diagnosed_by_name: user?.name || "",
      notes: newCondition.notes || null,
    })
    setNewCondition({ category: "chronic", severity: "moderate", status: "active" })
    setShowAddCondition(false)
    setSaving(false)
    fetchAll()
  }

  // ─── Add Allergy ────────────────────────────────────────────────────────────

  const [newAllergy, setNewAllergy] = useState<Partial<Allergy>>({ allergy_type: "drug", severity: "moderate", status: "active" })

  async function saveAllergy() {
    if (!phone || !tenantId || !newAllergy.allergen) return
    setSaving(true)
    const supabase = createBrowserClient()
    await supabase.from("allergies").insert({
      patient_phone: phone,
      tenant_id: tenantId,
      allergen: newAllergy.allergen,
      allergy_type: newAllergy.allergy_type || "drug",
      severity: newAllergy.severity || "moderate",
      reaction: newAllergy.reaction || null,
      status: newAllergy.status || "active",
      recorded_by: user?.doctorId || "",
      recorded_by_name: user?.name || "",
      notes: newAllergy.notes || null,
    })
    setNewAllergy({ allergy_type: "drug", severity: "moderate", status: "active" })
    setShowAddAllergy(false)
    setSaving(false)
    fetchAll()
  }

  // ─── Add Clinical Note ──────────────────────────────────────────────────────

  const [newNote, setNewNote] = useState<Partial<ClinicalNote>>({ note_type: "consultation" })

  async function saveNote() {
    if (!phone || !tenantId) return
    setSaving(true)
    const supabase = createBrowserClient()
    await supabase.from("clinical_notes").insert({
      patient_phone: phone,
      tenant_id: tenantId,
      doctor_id: user?.doctorId || "",
      doctor_name: user?.name || "",
      note_type: newNote.note_type || "consultation",
      subjective: newNote.subjective || null,
      objective: newNote.objective || null,
      assessment: newNote.assessment || null,
      plan: newNote.plan || null,
      chief_complaint: newNote.chief_complaint || null,
      history_of_illness: newNote.history_of_illness || null,
    })
    setNewNote({ note_type: "consultation" })
    setShowAddNote(false)
    setSaving(false)
    fetchAll()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const activeConditions = conditions.filter((c) => c.status === "active" || c.status === "managed")
  const activeAllergies = allergies.filter((a) => a.status === "active")
  const latestVitals = vitalsHistory[0]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <SectionHeader
          variant="glass"
          icon={<FileText className="w-6 h-6" />}
          gradient="gradient-blue"
          title={patient?.name || "Patient EMR"}
          subtitle={`${formatPhone(phone)} ${patient?.age ? `• ${patient.age}y` : ""} ${patient?.gender || ""} ${patient?.blood_group ? `• ${patient.blood_group}` : ""}`}
          badge={<Badge variant="secondary" className="text-xs">EMR</Badge>}
        />
      </div>

      {/* Alert Banner — Active Allergies */}
      {activeAllergies.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Allergies</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {activeAllergies.map((a) => (
                <Badge key={a.id} variant="destructive" className="text-xs">
                  {a.allergen} {a.severity === "life_threatening" ? "(SEVERE)" : `(${a.severity})`}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-7 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="abdm">ABDM</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ───────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Latest Vitals Row */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" /> Latest Vitals
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddVitals(true)}>
                <Plus className="w-3 h-3 mr-1" /> Record
              </Button>
            </CardHeader>
            <CardContent>
              {latestVitals ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <VitalMini label="BP" value={latestVitals.bp_systolic && latestVitals.bp_diastolic ? `${latestVitals.bp_systolic}/${latestVitals.bp_diastolic}` : "—"} unit="mmHg" icon={<Heart className="w-3.5 h-3.5" />} />
                  <VitalMini label="Pulse" value={latestVitals.pulse ?? "—"} unit="bpm" icon={<Activity className="w-3.5 h-3.5" />} />
                  <VitalMini label="Temp" value={latestVitals.temperature ?? "—"} unit="°F" icon={<Thermometer className="w-3.5 h-3.5" />} />
                  <VitalMini label="SpO2" value={latestVitals.spo2 ?? "—"} unit="%" icon={<Wind className="w-3.5 h-3.5" />} />
                  <VitalMini label="Weight" value={latestVitals.weight ?? "—"} unit="kg" icon={<Scale className="w-3.5 h-3.5" />} />
                  <VitalMini label="BMI" value={latestVitals.bmi ?? "—"} unit="" icon={<TrendingUp className="w-3.5 h-3.5" />} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No vitals recorded yet</p>
              )}
              {latestVitals && (
                <p className="text-xs text-muted-foreground mt-2">
                  Recorded: {formatDate(latestVitals.recorded_at.split("T")[0])} by {latestVitals.recorded_by_name}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Conditions */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> Active Conditions ({activeConditions.length})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAddCondition(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                {activeConditions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No active conditions</p>
                ) : (
                  <div className="space-y-2">
                    {activeConditions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                        <div>
                          <span className="text-sm font-medium">{c.condition_name}</span>
                          {c.icd_code && <span className="text-xs text-muted-foreground ml-2">({c.icd_code})</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={c.severity === "severe" ? "destructive" : "secondary"} className="text-[10px]">{c.severity}</Badge>
                          <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Allergies */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Allergies ({activeAllergies.length})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAddAllergy(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                {activeAllergies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No known allergies</p>
                ) : (
                  <div className="space-y-2">
                    {activeAllergies.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div>
                          <span className="text-sm font-medium">{a.allergen}</span>
                          {a.reaction && <span className="text-xs text-muted-foreground ml-2">→ {a.reaction}</span>}
                        </div>
                        <Badge variant={a.severity === "life_threatening" || a.severity === "severe" ? "destructive" : "secondary"} className="text-[10px]">
                          {a.allergy_type} • {a.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Prescriptions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Pill className="w-4 h-4" /> Recent Prescriptions ({prescriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No prescriptions</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {prescriptions.slice(0, 10).map((rx) => (
                    <div key={rx.prescription_id} className="py-2 px-3 rounded-lg bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{rx.diagnosis || "No diagnosis"}</span>
                        <span className="text-xs text-muted-foreground">{rx.created_at ? formatDate(rx.created_at.split("T")[0]) : "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{rx.doctor_name}</span>
                        {rx.items?.length > 0 && <span>• {rx.items.length} medicines</span>}
                      </div>
                      {rx.items?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rx.items.slice(0, 4).map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{item.medicine_name}</Badge>
                          ))}
                          {rx.items.length > 4 && <Badge variant="outline" className="text-[10px]">+{rx.items.length - 4}</Badge>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Vitals Tab ─────────────────────────────────────────────── */}
        <TabsContent value="vitals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Vitals History ({vitalsHistory.length} records)</h3>
            <Button variant="outline" size="sm" onClick={() => setShowAddVitals(true)}>
              <Plus className="w-3 h-3 mr-1" /> Record Vitals
            </Button>
          </div>
          {vitalsHistory.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No vitals recorded</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {vitalsHistory.map((v) => (
                <Card key={v.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {v.recorded_at ? formatDate(v.recorded_at.split("T")[0]) + " " + formatTime(v.recorded_at.split("T")[1]?.slice(0, 5)) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">by {v.recorded_by_name || "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <VitalMini label="BP" value={v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"} unit="mmHg" icon={<Heart className="w-3 h-3" />} />
                      <VitalMini label="Pulse" value={v.pulse ?? "—"} unit="bpm" icon={<Activity className="w-3 h-3" />} />
                      <VitalMini label="Temp" value={v.temperature ?? "—"} unit="°F" icon={<Thermometer className="w-3 h-3" />} />
                      <VitalMini label="SpO2" value={v.spo2 ?? "—"} unit="%" icon={<Wind className="w-3 h-3" />} />
                      <VitalMini label="Weight" value={v.weight ?? "—"} unit="kg" icon={<Scale className="w-3 h-3" />} />
                      <VitalMini label="RR" value={v.respiratory_rate ?? "—"} unit="/min" icon={<Wind className="w-3 h-3" />} />
                    </div>
                    {(v.blood_sugar_fasting || v.blood_sugar_pp) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <VitalMini label="Sugar (F)" value={v.blood_sugar_fasting ?? "—"} unit="mg/dL" icon={<TrendingUp className="w-3 h-3" />} />
                        <VitalMini label="Sugar (PP)" value={v.blood_sugar_pp ?? "—"} unit="mg/dL" icon={<TrendingUp className="w-3 h-3" />} />
                      </div>
                    )}
                    {v.notes && <p className="text-xs text-muted-foreground mt-2">{v.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Clinical Notes Tab ──────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Clinical Notes ({clinicalNotes.length})</h3>
            <Button variant="outline" size="sm" onClick={() => setShowAddNote(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Note
            </Button>
          </div>
          {clinicalNotes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No clinical notes</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {clinicalNotes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{note.note_type}</Badge>
                        <span className="text-sm font-medium">{note.doctor_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{note.created_at ? formatDate(note.created_at.split("T")[0]) : "—"}</span>
                    </div>
                    {note.chief_complaint && <div><span className="text-xs font-semibold text-muted-foreground">CC:</span> <span className="text-sm">{note.chief_complaint}</span></div>}
                    {note.subjective && <div><span className="text-xs font-semibold text-blue-600">S:</span> <span className="text-sm">{note.subjective}</span></div>}
                    {note.objective && <div><span className="text-xs font-semibold text-green-600">O:</span> <span className="text-sm">{note.objective}</span></div>}
                    {note.assessment && <div><span className="text-xs font-semibold text-amber-600">A:</span> <span className="text-sm">{note.assessment}</span></div>}
                    {note.plan && <div><span className="text-xs font-semibold text-purple-600">P:</span> <span className="text-sm">{note.plan}</span></div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Conditions Tab ─────────────────────────────────────────── */}
        <TabsContent value="conditions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Medical Conditions ({conditions.length})</h3>
            <Button variant="outline" size="sm" onClick={() => setShowAddCondition(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Condition
            </Button>
          </div>
          {conditions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No medical conditions recorded</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {conditions.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{c.condition_name}</span>
                        {c.icd_code && <span className="text-xs text-muted-foreground ml-2">ICD: {c.icd_code}</span>}
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={c.status === "active" ? "default" : c.status === "resolved" ? "secondary" : "outline"} className="text-[10px]">{c.status}</Badge>
                        <Badge variant={c.severity === "severe" ? "destructive" : "secondary"} className="text-[10px]">{c.severity}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      {c.onset_date && <span>Onset: {formatDate(c.onset_date)}</span>}
                      {c.resolved_date && <span>Resolved: {formatDate(c.resolved_date)}</span>}
                      {c.diagnosed_by_name && <span>By: {c.diagnosed_by_name}</span>}
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Allergies section in conditions tab too */}
          <div className="flex justify-between items-center mt-6">
            <h3 className="text-sm font-semibold">Allergies ({allergies.length})</h3>
            <Button variant="outline" size="sm" onClick={() => setShowAddAllergy(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Allergy
            </Button>
          </div>
          {allergies.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{a.allergen}</span>
                    {a.reaction && <span className="text-xs text-muted-foreground ml-2">→ {a.reaction}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={a.severity === "life_threatening" || a.severity === "severe" ? "destructive" : "secondary"} className="text-[10px]">{a.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.allergy_type}</Badge>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─── Documents Tab ──────────────────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4">
          <DocumentUpload
            tenantId={tenantId}
            patientPhone={phone}
            uploadedBy={user?.name}
            uploadedByRole="DOCTOR"
          />
          <DocumentGallery
            tenantId={tenantId}
            patientPhone={phone}
            canDelete
          />
        </TabsContent>

        {/* ─── ABDM Tab ──────────────────────────────────────────────── */}
        <TabsContent value="abdm" className="space-y-4">
          <AbhaCard
            abhaNumber={patient?.abha_number}
            abhaAddress={patient?.abha_address}
            abhaStatus={patient?.abha_status}
            patientName={patient?.name}
          />
          <div className="flex justify-end">
            <AbhaLinkDialog
              patientPhone={phone}
              tenantId={tenantId}
              currentAbha={patient?.abha_number}
              currentAbhaAddress={patient?.abha_address}
              currentStatus={patient?.abha_status}
              onUpdate={() => fetchAll()}
            />
          </div>
          <ConsentManager
            tenantId={tenantId}
            patientPhone={phone}
            patientAbha={patient?.abha_number}
          />
          <HealthRecordExport
            tenantId={tenantId}
            patientPhone={phone}
          />
        </TabsContent>

        {/* ─── History Tab ────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <h3 className="text-sm font-semibold">Appointment History ({appointments.length})</h3>
          {appointments.map((appt) => (
            <Card key={appt.booking_id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatDate(appt.date)}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(appt.time)}</span>
                  </div>
                  <Badge variant={appt.status === "completed" ? "default" : appt.status === "confirmed" ? "secondary" : "outline"} className="text-[10px]">{appt.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {appt.doctor_name} • {appt.specialty} • {appt.booking_id}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ───────────────────────────────────────────────────── */}

      {/* Add Vitals Dialog */}
      <Dialog open={showAddVitals} onOpenChange={setShowAddVitals}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record Vitals</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">BP Systolic</label>
              <Input type="number" placeholder="120" value={newVitals.bp_systolic || ""} onChange={(e) => setNewVitals({ ...newVitals, bp_systolic: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">BP Diastolic</label>
              <Input type="number" placeholder="80" value={newVitals.bp_diastolic || ""} onChange={(e) => setNewVitals({ ...newVitals, bp_diastolic: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Pulse (bpm)</label>
              <Input type="number" placeholder="72" value={newVitals.pulse || ""} onChange={(e) => setNewVitals({ ...newVitals, pulse: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Temperature (°F)</label>
              <Input type="number" step="0.1" placeholder="98.6" value={newVitals.temperature || ""} onChange={(e) => setNewVitals({ ...newVitals, temperature: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">SpO2 (%)</label>
              <Input type="number" placeholder="98" value={newVitals.spo2 || ""} onChange={(e) => setNewVitals({ ...newVitals, spo2: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Respiratory Rate</label>
              <Input type="number" placeholder="16" value={newVitals.respiratory_rate || ""} onChange={(e) => setNewVitals({ ...newVitals, respiratory_rate: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Weight (kg)</label>
              <Input type="number" step="0.1" placeholder="70" value={newVitals.weight || ""} onChange={(e) => setNewVitals({ ...newVitals, weight: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Height (cm)</label>
              <Input type="number" step="0.1" placeholder="170" value={newVitals.height || ""} onChange={(e) => setNewVitals({ ...newVitals, height: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Blood Sugar (Fasting)</label>
              <Input type="number" step="0.1" placeholder="90" value={newVitals.blood_sugar_fasting || ""} onChange={(e) => setNewVitals({ ...newVitals, blood_sugar_fasting: +e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Blood Sugar (PP)</label>
              <Input type="number" step="0.1" placeholder="130" value={newVitals.blood_sugar_pp || ""} onChange={(e) => setNewVitals({ ...newVitals, blood_sugar_pp: +e.target.value || undefined })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input placeholder="Optional notes..." value={newVitals.notes || ""} onChange={(e) => setNewVitals({ ...newVitals, notes: e.target.value })} />
          </div>
          <Button onClick={saveVitals} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Vitals"}</Button>
        </DialogContent>
      </Dialog>

      {/* Add Condition Dialog */}
      <Dialog open={showAddCondition} onOpenChange={setShowAddCondition}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Medical Condition</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Condition Name *</label>
              <Input placeholder="e.g., Hypertension, Diabetes Type 2" value={newCondition.condition_name || ""} onChange={(e) => setNewCondition({ ...newCondition, condition_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ICD-10 Code</label>
              <Input placeholder="e.g., I10, E11" value={newCondition.icd_code || ""} onChange={(e) => setNewCondition({ ...newCondition, icd_code: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={newCondition.category} onValueChange={(v) => setNewCondition({ ...newCondition, category: v as MedicalCondition["category"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chronic">Chronic</SelectItem>
                    <SelectItem value="acute">Acute</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="surgical_history">Surgical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Severity</label>
                <Select value={newCondition.severity} onValueChange={(v) => setNewCondition({ ...newCondition, severity: v as MedicalCondition["severity"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={newCondition.status} onValueChange={(v) => setNewCondition({ ...newCondition, status: v as MedicalCondition["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="managed">Managed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Onset Date</label>
              <Input type="date" value={newCondition.onset_date || ""} onChange={(e) => setNewCondition({ ...newCondition, onset_date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea placeholder="Additional notes..." value={newCondition.notes || ""} onChange={(e) => setNewCondition({ ...newCondition, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <Button onClick={saveCondition} disabled={saving || !newCondition.condition_name} className="w-full">{saving ? "Saving..." : "Save Condition"}</Button>
        </DialogContent>
      </Dialog>

      {/* Add Allergy Dialog */}
      <Dialog open={showAddAllergy} onOpenChange={setShowAddAllergy}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Allergy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Allergen *</label>
              <Input placeholder="e.g., Penicillin, Peanuts" value={newAllergy.allergen || ""} onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={newAllergy.allergy_type} onValueChange={(v) => setNewAllergy({ ...newAllergy, allergy_type: v as Allergy["allergy_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drug">Drug</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Severity</label>
                <Select value={newAllergy.severity} onValueChange={(v) => setNewAllergy({ ...newAllergy, severity: v as Allergy["severity"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="life_threatening">Life-threatening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={newAllergy.status} onValueChange={(v) => setNewAllergy({ ...newAllergy, status: v as Allergy["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspected">Suspected</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reaction</label>
              <Input placeholder="e.g., Rash, Anaphylaxis, Nausea" value={newAllergy.reaction || ""} onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea placeholder="Additional details..." value={newAllergy.notes || ""} onChange={(e) => setNewAllergy({ ...newAllergy, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <Button onClick={saveAllergy} disabled={saving || !newAllergy.allergen} className="w-full">{saving ? "Saving..." : "Save Allergy"}</Button>
        </DialogContent>
      </Dialog>

      {/* Add Clinical Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Clinical Note (SOAP)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Note Type</label>
                <Select value={newNote.note_type} onValueChange={(v) => setNewNote({ ...newNote, note_type: v as ClinicalNote["note_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="discharge">Discharge</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Chief Complaint</label>
                <Input placeholder="Main reason for visit" value={newNote.chief_complaint || ""} onChange={(e) => setNewNote({ ...newNote, chief_complaint: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold text-blue-600">S — Subjective</label>
              <Textarea placeholder="Patient's symptoms, complaints, history..." value={newNote.subjective || ""} onChange={(e) => setNewNote({ ...newNote, subjective: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold text-green-600">O — Objective</label>
              <Textarea placeholder="Examination findings, vitals, test results..." value={newNote.objective || ""} onChange={(e) => setNewNote({ ...newNote, objective: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold text-amber-600">A — Assessment</label>
              <Textarea placeholder="Diagnosis, differential diagnosis..." value={newNote.assessment || ""} onChange={(e) => setNewNote({ ...newNote, assessment: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold text-purple-600">P — Plan</label>
              <Textarea placeholder="Treatment plan, medications, follow-up..." value={newNote.plan || ""} onChange={(e) => setNewNote({ ...newNote, plan: e.target.value })} rows={2} />
            </div>
          </div>
          <Button onClick={saveNote} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Note"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Mini Component ─────────────────────────────────────────────────────────

function VitalMini({ label, value, unit, icon }: { label: string; value: string | number; unit: string; icon: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-sm font-bold">{value}</p>
      {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
    </div>
  )
}
