import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runSmartAlerts } from "@/lib/notifications/smart-alerts"
import { createRouteLogger } from "@/lib/logger"
import type { SessionUser } from "@/types/auth"

const log = createRouteLogger("/api/notifications/smart-alerts")

/**
 * GET /api/notifications/smart-alerts?tenantId=xxx
 *
 * Returns all active smart alerts for a tenant.
 * Called by the admin dashboard to show actionable alerts.
 * Can also be triggered by a cron job for automated notifications.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as SessionUser
    const tenantId = req.nextUrl.searchParams.get("tenantId") || user.tenantId

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 })
    }

    const alerts = await runSmartAlerts(tenantId)

    // Filter alerts by user role — don't show lab alerts to reception, etc.
    const roleAlerts = alerts.filter((a) => {
      if (!a.recipientRole) return true
      if (user.role === "ADMIN" || user.role === "BRANCH_ADMIN" || user.role === "CLIENT_ADMIN" || user.role === "SUPER_ADMIN") return true
      return a.recipientRole === user.role
    })

    return NextResponse.json({
      success: true,
      data: {
        alerts: roleAlerts,
        summary: {
          total: roleAlerts.length,
          critical: roleAlerts.filter((a) => a.priority === "critical").length,
          high: roleAlerts.filter((a) => a.priority === "high").length,
          medium: roleAlerts.filter((a) => a.priority === "medium").length,
          low: roleAlerts.filter((a) => a.priority === "low").length,
        },
      },
    })
  } catch (err) {
    log.error({ err }, "Smart alerts API failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
