"use client"

import { useState, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, Stethoscope, Calendar } from "lucide-react"
import { toast } from "sonner"
import type { Admission } from "@/types/database"

interface RoundNote {
  id: string
  timestamp: string
  doctor_name: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

interface RoundsPanelProps {
  admission: Admission
  tenantId: string
  doctorName?: string
  onUpdate?: () => void
}

export function RoundsPanel({ admission, tenantId, doctorName, onUpdate }: RoundsPanelProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subjective, setSubjective] = useState("")
  const [objective, setObjective] = useState("")
  const [assessment, setAssessment] = useState("")
  const [plan, setPlan] = useState("")

  // Rounds stored in nursing_notes with type "rounds"
  const rounds: RoundNote[] = (admission.nursing_notes || [])
    .filter(n => n.type === "rounds")
    .map(n => ({
      id: n.id,
      timestamp: n.timestamp,
      doctor_name: n.author,
      subjective: n.rounds?.subjective || "",
      objective: n.rounds?.objective || "",
      assessment: n.rounds?.assessment || "",
      plan: n.rounds?.plan || "",
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const handleSave = useCallback(async () => {
    if (!subjective.trim() && !objective.trim() && !assessment.trim() && !plan.trim()) {
      toast.error("Please fill at least one SOAP field")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    const newNote = {
      id: `RND-${Date.now()}`,
      type: "rounds",
      timestamp: new Date().toISOString(),
      author: doctorName || "Doctor",
      content: `Rounds: ${assessment || subjective}`,
      rounds: {
        subjective: subjective.trim(),
        objective: objective.trim(),
        assessment: assessment.trim(),
        plan: plan.trim(),
      },
    }

    const existingNotes = admission.nursing_notes || []
    const { error } = await supabase
      .from("admissions")
      .update({ nursing_notes: [...existingNotes, newNote] })
      .eq("admission_id", admission.admission_id)
      .eq("tenant_id", tenantId)

    if (error) {
      toast.error("Failed to save rounds note")
    } else {
      toast.success("Daily rounds note saved")
      setSubjective("")
      setObjective("")
      setAssessment("")
      setPlan("")
      setOpen(false)
      onUpdate?.()
    }
    setSaving(false)
  }, [subjective, objective, assessment, plan, admission, tenantId, doctorName, onUpdate])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Stethoscope className="w-4 h-4" /> Daily Rounds ({rounds.length})
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-3 h-3" /> Add Round Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5" /> Daily Rounds — SOAP Note
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">S — Subjective</Label>
                <Textarea value={subjective} onChange={(e) => setSubjective(e.target.value)} placeholder="Patient complaints, symptoms, history..." rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium">O — Objective</Label>
                <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Examination findings, vitals, lab results..." rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium">A — Assessment</Label>
                <Textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Diagnosis, clinical impression..." rows={2} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium">P — Plan</Label>
                <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Treatment plan, medications, investigations..." rows={2} className="mt-1 text-sm" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Rounds Note
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No rounds notes yet</p>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{round.doctor_name}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(round.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {round.subjective && (
                  <div><Badge variant="secondary" className="text-[9px] bg-blue-50 text-blue-700 mr-1.5">S</Badge><span className="text-xs">{round.subjective}</span></div>
                )}
                {round.objective && (
                  <div><Badge variant="secondary" className="text-[9px] bg-green-50 text-green-700 mr-1.5">O</Badge><span className="text-xs">{round.objective}</span></div>
                )}
                {round.assessment && (
                  <div><Badge variant="secondary" className="text-[9px] bg-orange-50 text-orange-700 mr-1.5">A</Badge><span className="text-xs">{round.assessment}</span></div>
                )}
                {round.plan && (
                  <div><Badge variant="secondary" className="text-[9px] bg-purple-50 text-purple-700 mr-1.5">P</Badge><span className="text-xs">{round.plan}</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
