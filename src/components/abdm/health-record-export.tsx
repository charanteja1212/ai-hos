"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileJson2,
  Download,
  Loader2,
  Stethoscope,
  Pill,
  TestTube,
  BedDouble,
  Eye,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { HEALTH_INFO_TYPES } from "@/lib/abdm/config"
import type { HealthInfoType } from "@/types/database"

interface HealthRecordExportProps {
  tenantId: string
  patientPhone: string
}

interface HealthRecordSummary {
  record_id: string
  record_type: HealthInfoType
  title: string
  source_id: string
  source_type: string
  created_at: string
  shared_at?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  OPConsultation: <Stethoscope className="w-3.5 h-3.5" />,
  Prescription: <Pill className="w-3.5 h-3.5" />,
  DiagnosticReport: <TestTube className="w-3.5 h-3.5" />,
  DischargeSummary: <BedDouble className="w-3.5 h-3.5" />,
}

export function HealthRecordExport({ tenantId, patientPhone }: HealthRecordExportProps) {
  const [records, setRecords] = useState<HealthRecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [viewBundle, setViewBundle] = useState<Record<string, unknown> | null>(null)
  const [viewTitle, setViewTitle] = useState("")

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-health-records", tenantId, patientPhone }),
      })
      const data = await res.json()
      setRecords(data.records || [])
    } catch {
      toast.error("Failed to load health records")
    } finally {
      setLoading(false)
    }
  }, [tenantId, patientPhone])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleGenerate = useCallback(async (recordType: string, sourceId: string) => {
    const key = `${recordType}:${sourceId}`
    setGenerating(key)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-health-record",
          tenantId,
          patientPhone,
          recordType,
          sourceId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success("FHIR health record generated")
      fetchRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate record")
    } finally {
      setGenerating(null)
    }
  }, [tenantId, patientPhone, fetchRecords])

  const handleDownload = (record: HealthRecordSummary) => {
    // Fetch the full bundle and download as JSON
    fetch("/api/abdm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-health-record",
        tenantId,
        patientPhone,
        recordType: record.record_type,
        sourceId: record.source_id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.bundle) {
          const blob = new Blob([JSON.stringify(data.bundle, null, 2)], { type: "application/json" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${record.record_type}_${record.record_id}.fhir.json`
          a.click()
          URL.revokeObjectURL(url)
        }
      })
      .catch(() => toast.error("Download failed"))
  }

  const handleView = (record: HealthRecordSummary) => {
    fetch("/api/abdm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-health-record",
        tenantId,
        patientPhone,
        recordType: record.record_type,
        sourceId: record.source_id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.bundle) {
          setViewBundle(data.bundle)
          setViewTitle(record.title)
        }
      })
      .catch(() => toast.error("Failed to load record"))
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileJson2 className="w-4 h-4 text-primary" />
              FHIR Health Records ({records.length})
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={fetchRecords} className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <FileJson2 className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No FHIR health records generated yet.</p>
              <p className="text-xs text-muted-foreground">
                Records are generated from consultations, prescriptions, lab reports, and discharge summaries.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <div key={record.record_id} className="rounded-xl border border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {typeIcons[record.record_type] || <FileJson2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{record.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[9px]">
                          {HEALTH_INFO_TYPES.find((t) => t.value === record.record_type)?.label || record.record_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(record.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleView(record)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(record)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FHIR Bundle Viewer Dialog */}
      <Dialog open={!!viewBundle} onOpenChange={(v) => { if (!v) setViewBundle(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson2 className="w-5 h-5" /> {viewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs font-mono bg-muted rounded-xl p-4 whitespace-pre-wrap break-words">
              {viewBundle ? JSON.stringify(viewBundle, null, 2) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
