"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save, FolderOpen, Trash2, Pill, Loader2 } from "lucide-react"
import type { PrescriptionItem } from "@/types/database"

interface Template {
  template_id: string
  doctor_id: string
  tenant_id: string
  name: string
  items: PrescriptionItem[]
  created_at: string
}

interface PrescriptionTemplatesProps {
  doctorId: string
  tenantId: string
  currentMedicines: PrescriptionItem[]
  onLoadTemplate: (items: PrescriptionItem[]) => void
}

export function PrescriptionTemplates({
  doctorId,
  tenantId,
  currentMedicines,
  onLoadTemplate,
}: PrescriptionTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [showSave, setShowSave] = useState(false)
  const [showLoad, setShowLoad] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [saving, setSaving] = useState(false)

  // Fetch templates
  useEffect(() => {
    if (!doctorId) return
    const supabase = createBrowserClient()
    supabase
      .from("prescription_templates")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setTemplates(data as Template[])
      })
  }, [doctorId, tenantId])

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name")
      return
    }
    const validMeds = currentMedicines.filter((m) => m.medicine_name.trim())
    if (validMeds.length === 0) {
      toast.error("Add at least one medicine before saving")
      return
    }

    setSaving(true)
    const supabase = createBrowserClient()
    const { error } = await supabase.from("prescription_templates").insert({
      template_id: `TPL-${Date.now()}`,
      doctor_id: doctorId,
      tenant_id: tenantId,
      name: templateName.trim(),
      items: validMeds,
    })

    if (error) {
      toast.error("Failed to save template")
    } else {
      toast.success(`Template "${templateName}" saved`)
      setShowSave(false)
      setTemplateName("")
      // Refresh templates
      const { data } = await supabase
        .from("prescription_templates")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50)
      if (data) setTemplates(data as Template[])
    }
    setSaving(false)
  }

  const handleDelete = async (templateId: string) => {
    const supabase = createBrowserClient()
    const { error } = await supabase
      .from("prescription_templates")
      .delete()
      .eq("template_id", templateId)
      .eq("doctor_id", doctorId)
      .eq("tenant_id", tenantId)

    if (error) {
      toast.error("Failed to delete template")
    } else {
      setTemplates(templates.filter((t) => t.template_id !== templateId))
      toast.success("Template deleted")
    }
  }

  const handleLoad = (template: Template) => {
    onLoadTemplate(template.items)
    setShowLoad(false)
    toast.success(`Loaded "${template.name}"`)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setShowSave(true)} className="gap-1.5">
        <Save className="w-3.5 h-3.5" /> Save Template
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowLoad(true)} className="gap-1.5" disabled={templates.length === 0}>
        <FolderOpen className="w-3.5 h-3.5" /> Load Template
        {templates.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{templates.length}</Badge>
        )}
      </Button>

      {/* Save Dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Prescription Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Template name (e.g., Viral Fever, URTI)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Medicines to save ({currentMedicines.filter((m) => m.medicine_name.trim()).length})
              </p>
              <div className="flex flex-wrap gap-1">
                {currentMedicines
                  .filter((m) => m.medicine_name.trim())
                  .map((med, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <Pill className="w-3 h-3" />
                      {med.medicine_name} — {med.dosage} ({med.frequency}, {med.duration})
                    </Badge>
                  ))}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoad} onOpenChange={setShowLoad}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Prescription Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.template_id}
                className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleLoad(tpl)}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{tpl.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(tpl.template_id)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tpl.items.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1">
                      <Pill className="w-2.5 h-2.5" />
                      {item.medicine_name} — {item.dosage}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No saved templates yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
