"use client"

import { useState, useRef, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, X, Loader2, FileText, Image, File } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Document } from "@/types/database"

const DOC_TYPES: { value: Document["type"]; label: string }[] = [
  { value: "xray", label: "X-Ray" },
  { value: "lab_report", label: "Lab Report" },
  { value: "scan", label: "CT/MRI Scan" },
  { value: "prescription", label: "Prescription" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "consent", label: "Consent Form" },
  { value: "other", label: "Other" },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.webp,.pdf"

interface DocumentUploadProps {
  tenantId: string
  patientPhone: string
  uploadedBy?: string
  uploadedByRole?: string
  bookingId?: string
  labOrderId?: string
  prescriptionId?: string
  onUploaded?: (doc: Document) => void
  compact?: boolean
}

export function DocumentUpload({
  tenantId,
  patientPhone,
  uploadedBy,
  uploadedByRole,
  bookingId,
  labOrderId,
  prescriptionId,
  onUploaded,
  compact = false,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<Document["type"]>("other")
  const [description, setDescription] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Max size is 10 MB")
      return
    }
    setSelectedFile(file)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""))
  }

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !title.trim()) {
      toast.error("Please select a file and enter a title")
      return
    }

    setUploading(true)
    const supabase = createBrowserClient()

    try {
      // Upload to Supabase storage
      const ext = selectedFile.name.split(".").pop() || "bin"
      const storagePath = `${tenantId}/${patientPhone}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(storagePath)

      const fileUrl = urlData.publicUrl

      // Save metadata to documents table
      const docId = `DOC-${Date.now()}`
      const doc: Document = {
        document_id: docId,
        tenant_id: tenantId,
        patient_phone: patientPhone,
        type: docType,
        title: title.trim(),
        description: description.trim() || undefined,
        file_url: fileUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        uploaded_by: uploadedBy,
        uploaded_by_role: uploadedByRole,
        booking_id: bookingId,
        lab_order_id: labOrderId,
        prescription_id: prescriptionId,
      }

      const { error: dbError } = await supabase.from("documents").insert(doc)
      if (dbError) throw dbError

      toast.success("Document uploaded successfully")
      setSelectedFile(null)
      setTitle("")
      setDescription("")
      setDocType("other")
      if (inputRef.current) inputRef.current.value = ""
      onUploaded?.(doc)
    } catch (err) {
      console.error("[document-upload] Error:", err)
      toast.error("Failed to upload document")
    } finally {
      setUploading(false)
    }
  }, [selectedFile, title, docType, description, tenantId, patientPhone, uploadedBy, uploadedByRole, bookingId, labOrderId, prescriptionId, onUploaded])

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="w-5 h-5" />
    if (selectedFile.type.startsWith("image/")) return <Image className="w-5 h-5" />
    if (selectedFile.type === "application/pdf") return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileSelect} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {getFileIcon()}
          <span className="ml-1.5">{selectedFile ? selectedFile.name : "Choose File"}</span>
        </Button>
        {selectedFile && (
          <>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-40 h-8 text-xs" />
            <Select value={docType} onValueChange={(v) => setDocType(v as Document["type"])}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !title.trim()}>
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Upload"}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = "" }}>
              <X className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <Label className="text-sm font-medium">Upload Document</Label>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          selectedFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileSelect} className="hidden" />
        <div className="flex flex-col items-center gap-2">
          {getFileIcon()}
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm">Click to select a file</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP, PDF — max 10 MB</p>
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chest X-Ray" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as Document["type"])}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={uploading || !title.trim()} className="flex-1">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
            <Button variant="outline" onClick={() => { setSelectedFile(null); setTitle(""); if (inputRef.current) inputRef.current.value = "" }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
