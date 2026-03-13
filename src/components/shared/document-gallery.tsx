"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import {
  FileText,
  Image,
  Download,
  Trash2,
  Eye,
  Calendar,
  Loader2,
  FolderOpen,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Document } from "@/types/database"

const TYPE_BADGE: Record<string, string> = {
  xray: "bg-blue-100 text-blue-700",
  lab_report: "bg-orange-100 text-orange-700",
  scan: "bg-purple-100 text-purple-700",
  prescription: "bg-teal-100 text-teal-700",
  discharge_summary: "bg-pink-100 text-pink-700",
  consent: "bg-gray-100 text-gray-700",
  other: "bg-slate-100 text-slate-700",
}

const TYPE_LABEL: Record<string, string> = {
  xray: "X-Ray",
  lab_report: "Lab Report",
  scan: "CT/MRI Scan",
  prescription: "Prescription",
  discharge_summary: "Discharge Summary",
  consent: "Consent Form",
  other: "Other",
}

interface DocumentGalleryProps {
  tenantId: string
  patientPhone: string
  filterType?: Document["type"]
  maxItems?: number
  canDelete?: boolean
  onCountChange?: (count: number) => void
  refreshKey?: number
}

export function DocumentGallery({
  tenantId,
  patientPhone,
  filterType,
  maxItems,
  canDelete = false,
  onCountChange,
  refreshKey = 0,
}: DocumentGalleryProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()
    let query = supabase
      .from("documents")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("patient_phone", patientPhone)
      .order("created_at", { ascending: false })

    if (filterType) query = query.eq("type", filterType)
    if (maxItems) query = query.limit(maxItems)

    const { data } = await query
    const docs = (data || []) as Document[]
    setDocuments(docs)
    onCountChange?.(docs.length)
    setLoading(false)
  }, [tenantId, patientPhone, filterType, maxItems, onCountChange])

  useEffect(() => { fetchDocuments() }, [fetchDocuments, refreshKey])

  const handleDelete = useCallback(async (doc: Document) => {
    setDeleting(true)
    const supabase = createBrowserClient()

    // Delete from storage
    const pathMatch = doc.file_url.match(/documents\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from("documents").remove([decodeURIComponent(pathMatch[1])])
    }

    // Delete metadata
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("document_id", doc.document_id)

    if (error) {
      toast.error("Failed to delete document")
    } else {
      toast.success("Document deleted")
      setDocuments(prev => prev.filter(d => d.document_id !== doc.document_id))
      setSelectedDoc(null)
    }
    setDeleting(false)
  }, [])

  const isImage = (mime?: string) => mime?.startsWith("image/")
  const isPdf = (mime?: string) => mime === "application/pdf"

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No documents uploaded yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {documents.map((doc) => (
          <div
            key={doc.document_id}
            className="group rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => setSelectedDoc(doc)}
          >
            {/* Thumbnail */}
            <div className="h-24 bg-muted/30 flex items-center justify-center relative overflow-hidden">
              {isImage(doc.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.file_url} alt={doc.title} className="w-full h-full object-cover" />
              ) : isPdf(doc.mime_type) ? (
                <FileText className="w-8 h-8 text-red-400" />
              ) : (
                <FileText className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </div>

            {/* Info */}
            <div className="p-2 space-y-1">
              <p className="text-xs font-medium truncate">{doc.title}</p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0", TYPE_BADGE[doc.type] || "")}>
                  {TYPE_LABEL[doc.type] || doc.type}
                </Badge>
                <span className="text-[9px] text-muted-foreground">
                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Document viewer dialog */}
      <PremiumDialog
        open={!!selectedDoc}
        onOpenChange={(open) => { if (!open) setSelectedDoc(null) }}
        title={selectedDoc?.title || "Document"}
        subtitle={selectedDoc ? TYPE_LABEL[selectedDoc.type] || selectedDoc.type : ""}
        icon={<FileText className="w-5 h-5" />}
        gradient="gradient-blue"
      >
        {selectedDoc && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-xl border border-border overflow-hidden bg-muted/20">
              {isImage(selectedDoc.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedDoc.file_url} alt={selectedDoc.title} className="w-full max-h-[400px] object-contain" />
              ) : isPdf(selectedDoc.mime_type) ? (
                <iframe src={selectedDoc.file_url} className="w-full h-[400px]" title={selectedDoc.title} />
              ) : (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Preview not available</p>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-1.5 text-sm">
              {selectedDoc.description && (
                <p className="text-muted-foreground">{selectedDoc.description}</p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>File: {selectedDoc.file_name}</span>
                <span>{selectedDoc.file_size ? `${(selectedDoc.file_size / 1024).toFixed(0)} KB` : ""}</span>
              </div>
              {selectedDoc.uploaded_by && (
                <p className="text-xs text-muted-foreground">
                  Uploaded by: {selectedDoc.uploaded_by} ({selectedDoc.uploaded_by_role})
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleString("en-IN") : "—"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={selectedDoc.file_url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </a>
              </Button>
              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => handleDelete(selectedDoc)}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
          </div>
        )}
      </PremiumDialog>
    </>
  )
}
