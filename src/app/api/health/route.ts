import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {}

  // 1. Supabase connectivity check
  const sbStart = Date.now()
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from("tenants").select("tenant_id").limit(1)
    checks.supabase = error
      ? { status: "degraded", latency_ms: Date.now() - sbStart, error: error.message }
      : { status: "healthy", latency_ms: Date.now() - sbStart }
  } catch (err) {
    checks.supabase = { status: "unhealthy", latency_ms: Date.now() - sbStart, error: String(err) }
  }

  // 2. Redis connectivity check
  const redisStart = Date.now()
  try {
    if (process.env.REDIS_URL) {
      const Redis = (await import("ioredis")).default
      const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000, lazyConnect: true })
      await redis.connect()
      await redis.ping()
      checks.redis = { status: "healthy", latency_ms: Date.now() - redisStart }
      await redis.disconnect()
    } else {
      checks.redis = { status: "skipped" }
    }
  } catch {
    checks.redis = { status: "degraded", latency_ms: Date.now() - redisStart, error: "Connection failed" }
  }

  // 3. Memory usage
  const mem = process.memoryUsage()
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024)

  // Overall status: unhealthy if Supabase is down, degraded if Redis is down
  const overallStatus = checks.supabase?.status === "unhealthy"
    ? "unhealthy"
    : Object.values(checks).some(c => c.status === "degraded")
      ? "degraded"
      : "healthy"

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    version: process.env.npm_package_version || "1.0.0",
    node_version: process.version,
    memory: { heap_used_mb: heapUsedMB, heap_total_mb: heapTotalMB },
    checks,
  }

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200
  return NextResponse.json(response, { status: httpStatus })
}
