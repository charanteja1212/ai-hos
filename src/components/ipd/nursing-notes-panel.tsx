"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import {
  Activity,
  ClipboardList,
  Heart,
  Loader2,
  MessageSquare,
  Pill,
  Plus,
  Thermometer,
  Wind,
} from "lucide-react"
import type { Admission, NursingNote } from "@/types/database"

interface NursingNotesPanelProps {
  admission: Admission | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  userName?: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  vitals: <Heart className="w-3 h-3" />,
  observation: <ClipboardList className="w-3 h-3" />,
  medication: <Pill className="w-3 h-3" />,
  general: <MessageSquare className="w-3 h-3" />,
}

const TYPE_COLORS: Record<string, string> = {
  vitals: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  observation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medication: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  general: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export function NursingNotesPanel({ admission, open, onClose, onUpdated, userName }: NursingNotesPanelProps) {
  const [noteType, setNoteType] = useState<"vitals" | "observation" | "medication" | "general">("general")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  // Vitals
  const [bpSystolic, setBpSystolic] = useState("")
  const [bpDiastolic, setBpDiastolic] = useState("")
  const [pulse, setPulse] = useState("")
  const [temperature, setTemperature] = useState("")
  const [spo2, setSpo2] = useState("")
  const [rr, setRr] = useState("")

  // Medication
  const [medsGiven, setMedsGiven] = useState("")

  const existingNotes: NursingNote[] = [...(admission?.nursing_notes || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const resetForm = () => {
    setNote("")
    setBpSystolic("")
    setBpDiastolic("")
    setPulse("")
    setTemperature("")
    setSpo2("")
    setRr("")
    setMedsGiven("")
  }

  const handleAddNote = useCallback(async () => {
    if (!admission || !note.trim()) {
      toast.error("Please add a note")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    try {
      const { data: current } = await supabase
        .from("admissions")
        .select("nursing_notes")
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", admission.tenant_id)
        .single()

      const notes: NursingNote[] = [...((current?.nursing_notes as NursingNote[]) || [])]

      const newNote: NursingNote = {
        id: `NN-${Date.now()}`,
        timestamp: new Date().toISOString(),
        author: userName || "Nurse",
        type: noteType,
        note: note.trim(),
      }

      if (noteType === "vitals") {
        newNote.vitals = {
          bp_systolic: bpSystolic ? parseInt(bpSystolic) : undefined,
          bp_diastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
          pulse: pulse ? parseInt(pulse) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          spo2: spo2 ? parseInt(spo2) : undefined,
          respiratory_rate: rr ? parseInt(rr) : undefined,
        }
      }

      if (noteType === "observation") {
        newNote.observations = note.trim()
      }

      if (noteType === "medication" && medsGiven.trim()) {
        newNote.medications_given = medsGiven.split(",").map((m) => m.trim()).filter(Boolean)
      }

      notes.push(newNote)

      const { error } = await supabase
        .from("admissions")
        .update({ nursing_notes: notes })
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", admission.tenant_id)

      if (error) throw error

      toast.success("Note added")
      resetForm()
      onUpdated()
    } catch (err) {
      console.error("[nursing-notes] Failed:", err)
      toast.error("Failed to add note")
    } finally {
      setSaving(false)
    }
  }, [admission, noteType, note, bpSystolic, bpDiastolic, pulse, temperature, spo2, rr, medsGiven, userName, onUpdated])

  const formatTs = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
  }

  return (
    <PremiumDialog
      open={open}
      onOpenChange={onClose}
      title="Nursing Notes"
      subtitle={admission?.patient_name || ""}
      icon={<Activity className="w-5 h-5" />}
      gradient="gradient-teal"
      maxWidth="sm:max-w-2xl"
    >
      {admission && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Patient info */}
          <div className="rounded-xl gradient-blue p-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{admission.patient_name}</p>
                <p className="text-xs text-white/70">{admission.ward} — Bed {admission.bed_number}</p>
              </div>
              <Badge className="bg-white/20 text-white border-0 text-[10px]">
                {existingNotes.length} notes
              </Badge>
            </div>
          </div>

          {/* Add Note Form */}
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Note
            </p>

            <Tabs value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
              <TabsList className="w-full">
                <TabsTrigger value="vitals" className="flex-1 text-xs gap-1">
                  <Heart className="w-3 h-3" /> Vitals
                </TabsTrigger>
                <TabsTrigger value="observation" className="flex-1 text-xs gap-1">
                  <ClipboardList className="w-3 h-3" /> Observation
                </TabsTrigger>
                <TabsTrigger value="medication" className="flex-1 text-xs gap-1">
                  <Pill className="w-3 h-3" /> Medication
                </TabsTrigger>
                <TabsTrigger value="general" className="flex-1 text-xs gap-1">
                  <MessageSquare className="w-3 h-3" /> General
                </TabsTrigger>
              </TabsList>

              <TabsContent value="vitals" className="mt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1"><Heart className="w-2.5 h-2.5" /> BP Sys</Label>
                    <Input type="number" placeholder="120" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">BP Dia</Label>
                    <Input type="number" placeholder="80" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> Pulse</Label>
                    <Input type="number" placeholder="72" value={pulse} onChange={(e) => setPulse(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1"><Thermometer className="w-2.5 h-2.5" /> Temp °F</Label>
                    <Input type="number" step="0.1" placeholder="98.6" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">SpO2 %</Label>
                    <Input type="number" placeholder="98" value={spo2} onChange={(e) => setSpo2(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1"><Wind className="w-2.5 h-2.5" /> RR</Label>
                    <Input type="number" placeholder="16" value={rr} onChange={(e) => setRr(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="medication" className="mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Medications Given (comma-separated)</Label>
                  <Input
                    placeholder="Paracetamol 500mg, Amoxicillin 250mg..."
                    value={medsGiven}
                    onChange={(e) => setMedsGiven(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Textarea
                placeholder="Observations, instructions, patient status..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleAddNote} disabled={saving || !note.trim()} size="sm" className="w-full">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add Note
            </Button>
          </div>

          {/* Timeline */}
          {existingNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No nursing notes yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {existingNotes.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] gap-1 ${TYPE_COLORS[n.type]}`}>
                        {TYPE_ICONS[n.type]}
                        {n.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{n.author}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatTs(n.timestamp)}</span>
                  </div>

                  {/* Vitals grid */}
                  {n.type === "vitals" && n.vitals && (
                    <div className="grid grid-cols-6 gap-1.5 py-1">
                      {n.vitals.bp_systolic && (
                        <div className="text-center p-1 rounded bg-red-50 dark:bg-red-950/20">
                          <p className="text-[9px] text-muted-foreground">BP</p>
                          <p className="text-xs font-bold">{n.vitals.bp_systolic}/{n.vitals.bp_diastolic}</p>
                        </div>
                      )}
                      {n.vitals.pulse && (
                        <div className="text-center p-1 rounded bg-pink-50 dark:bg-pink-950/20">
                          <p className="text-[9px] text-muted-foreground">Pulse</p>
                          <p className="text-xs font-bold">{n.vitals.pulse}</p>
                        </div>
                      )}
                      {n.vitals.temperature && (
                        <div className="text-center p-1 rounded bg-orange-50 dark:bg-orange-950/20">
                          <p className="text-[9px] text-muted-foreground">Temp</p>
                          <p className="text-xs font-bold">{n.vitals.temperature}°</p>
                        </div>
                      )}
                      {n.vitals.spo2 && (
                        <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-950/20">
                          <p className="text-[9px] text-muted-foreground">SpO2</p>
                          <p className="text-xs font-bold">{n.vitals.spo2}%</p>
                        </div>
                      )}
                      {n.vitals.respiratory_rate && (
                        <div className="text-center p-1 rounded bg-green-50 dark:bg-green-950/20">
                          <p className="text-[9px] text-muted-foreground">RR</p>
                          <p className="text-xs font-bold">{n.vitals.respiratory_rate}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Medications */}
                  {n.medications_given && n.medications_given.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {n.medications_given.map((med, j) => (
                        <Badge key={j} variant="outline" className="text-[10px]">
                          <Pill className="w-2.5 h-2.5 mr-0.5" />
                          {med}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">{n.note}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </PremiumDialog>
  )
}
