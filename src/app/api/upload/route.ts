import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const bucket = (formData.get("bucket") as string) || "logos"
    const path = formData.get("path") as string

    if (!file || !path) {
      return NextResponse.json({ error: "file and path are required" }, { status: 400 })
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
      console.error("[upload] error:", uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error("[upload]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
