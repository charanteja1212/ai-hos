"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LogoUploadProps {
  /** Current logo URL */
  currentUrl?: string | null
  /** Supabase storage bucket name */
  bucket?: string
  /** Storage path prefix (e.g., "clients/CL123") */
  pathPrefix: string
  /** Called when upload succeeds with the public URL */
  onUpload: (url: string) => void
  /** Called when logo is removed */
  onRemove?: () => void
  /** Size of the preview */
  size?: "sm" | "md"
}

export function LogoUpload({
  currentUrl,
  bucket = "logos",
  pathPrefix,
  onUpload,
  onRemove,
  size = "md",
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dimensions = size === "sm" ? "w-16 h-16" : "w-24 h-24"

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB")
      return
    }

    setUploading(true)

    try {
      const ext = file.name.split(".").pop() || "png"
      const fileName = `${pathPrefix}/logo.${ext}`

      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", bucket)
      formData.append("path", fileName)

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        console.error("[logo-upload] Upload error:", data.error)
        toast.error(data.error || "Upload failed")
        setUploading(false)
        return
      }

      setPreview(data.url)
      onUpload(data.url)
      toast.success("Logo uploaded")
    } catch (err) {
      console.error("[logo-upload]", err)
      toast.error("Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onRemove?.()
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          dimensions,
          "rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 shrink-0 relative group"
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Logo" className="w-full h-full object-contain p-1" />
            {onRemove && (
              <button
                onClick={handleRemove}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </>
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground/40" />
        )}
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Upload className="w-3.5 h-3.5 mr-1.5" />
          )}
          {preview ? "Change Logo" : "Upload Logo"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1">
          PNG, JPG, or SVG. Max 2MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
