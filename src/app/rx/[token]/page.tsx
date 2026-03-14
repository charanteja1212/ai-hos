import { createServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { RxView } from "./rx-view"

interface Props {
  params: Promise<{ token: string }>
}

export default async function PrescriptionViewPage({ params }: Props) {
  const { token } = await params

  // Decode token: base64url of "prescriptionId:datePrefix"
  let prescriptionId: string
  let dateCheck: string
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")
    prescriptionId = parts[0] || ""
    dateCheck = parts[1] || ""
  } catch {
    notFound()
  }

  if (!prescriptionId || !dateCheck) notFound()

  const supabase = createServerClient()

  // Fetch prescription
  const { data: prescription } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("prescription_id", prescriptionId)
    .single()

  if (!prescription) notFound()

  // Verify token date matches (simple security check)
  const createdDate = (prescription.created_at || "").slice(0, 10)
  if (createdDate !== dateCheck) notFound()

  // Fetch tenant info for header
  const { data: tenant } = await supabase
    .from("tenants")
    .select("hospital_name, address, phone, logo_url")
    .eq("tenant_id", prescription.tenant_id)
    .single()

  return (
    <RxView
      prescription={prescription}
      tenant={tenant}
    />
  )
}
