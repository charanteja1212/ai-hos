import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"

const log = createRouteLogger("/api/upload")

const ALLOWED_BUCKETS = ["logos", "doctors", "documents"]

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files allowed" }, { status: 400 })
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
