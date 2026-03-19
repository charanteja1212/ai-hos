import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"
import { isRateLimited } from "@/lib/rate-limit"
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/config/defaults"

const log = createRouteLogger("/api/upload")

const ALLOWED_BUCKETS = ["logos", "doctors", "documents"]
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
]

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 20 uploads per 5 minutes per user
  const userEmail = (session.user as { email?: string }).email || "unknown"
  if (await isRateLimited(`upload:${userEmail}`, 20, 300000)) {
    return NextResponse.json({ error: "Too many uploads. Please wait." }, { status: 429 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const bucket = (formData.get("bucket") as string) || "logos"
    const path = formData.get("path") as string

    if (!file || !path) {
      return NextResponse.json({ error: "file and path are required" }, { status: 400 })
    }

    // Whitelist allowed buckets
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "Invalid storage bucket" }, { status: 400 })
    }

    // Sanitize path - no directory traversal
    if (path.includes("..") || path.startsWith("/")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `File must be under ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: "3600" })

    if (uploadError) {
      log.error({ err: uploadError }, "Upload error")
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    log.error({ err }, "Upload failed")
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
