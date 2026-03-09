import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"

/**
 * Calculate estimated wait time for a patient based on
 * actual average consultation duration for the doctor today.
 * Falls back to 15 minutes if no completed consultations exist.
 */
export async function calculateEstimatedWait(
  tenantId: string,
  doctorId: string
): Promise<{ waitingAhead: number; estimatedWait: number }> {
  const supabase = createBrowserClient()
  const today = getTodayIST()

  const { count: waitingAhead } = await supabase
    .from("queue_entries")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("date", today)
    .eq("doctor_id", doctorId)
    .eq("status", "waiting")

  // Fetch avg consult time from today's completed entries
  const { data: completedEntries } = await supabase
    .from("queue_entries")
    .select("consultation_start, consultation_end")
    .eq("tenant_id", tenantId)
    .eq("doctor_id", doctorId)
    .eq("date", today)
    .eq("status", "completed")
    .not("consultation_start", "is", null)
    .not("consultation_end", "is", null)

  let avgConsultMin = 15
  if (completedEntries && completedEntries.length > 0) {
    const durations = completedEntries
      .map(
        (e) =>
          (new Date(e.consultation_end!).getTime() -
            new Date(e.consultation_start!).getTime()) /
          60000
      )
      .filter((d) => d > 0 && d <= 120)
    if (durations.length > 0) {
      avgConsultMin = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      )
    }
  }

  const ahead = waitingAhead || 0
  return { waitingAhead: ahead, estimatedWait: ahead * avgConsultMin }
}
