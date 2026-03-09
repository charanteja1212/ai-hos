"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Workflow,
  Wifi,
  TrendingUp,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"

interface ServiceStatus {
  name: string
  status: "healthy" | "degraded" | "down"
  latencyMs: number | null
  details?: string
}

interface HealthSnapshot {
  time: string
  overall: "healthy" | "degraded" | "down"
  services: ServiceStatus[]
}

const STATUS_CONFIG = {
  healthy: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2, dot: "bg-green-500", border: "border-green-200 dark:border-green-900" },
  degraded: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertTriangle, dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-900" },
  down: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle, dot: "bg-red-500", border: "border-red-200 dark:border-red-900" },
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "Supabase DB": Database,
  "Supabase REST": Server,
  "Next.js App": Server,
  "n8n Engine": Workflow,
}

const REFRESH_OPTIONS = [
  { label: "Off", value: "0" },
  { label: "30s", value: "30" },
  { label: "1 min", value: "60" },
  { label: "5 min", value: "300" },
]

export default function SystemHealthPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState("0")
  const [history, setHistory] = useState<HealthSnapshot[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  const checkHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const results: ServiceStatus[] = []
    const supabase = createBrowserClient()

    // Check Supabase DB
    try {
      const start = performance.now()
      const { error } = await supabase.from("tenants").select("tenant_id", { count: "exact", head: true })
      const latency = Math.round(performance.now() - start)
      results.push({
        name: "Supabase DB",
        status: error ? "down" : latency > 2000 ? "degraded" : "healthy",
        latencyMs: latency,
        details: error ? error.message : `${latency}ms response`,
      })
    } catch {
      results.push({ name: "Supabase DB", status: "down", latencyMs: null, details: "Connection failed" })
    }

    // Check Supabase REST API
    try {
      const start = performance.now()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
      })
      const latency = Math.round(performance.now() - start)
      results.push({
        name: "Supabase REST",
        status: res.ok ? (latency > 2000 ? "degraded" : "healthy") : "down",
        latencyMs: latency,
        details: res.ok ? `${latency}ms response` : `HTTP ${res.status}`,
      })
    } catch {
      results.push({ name: "Supabase REST", status: "down", latencyMs: null, details: "Connection failed" })
    }

    // Check Next.js App (self-ping)
    try {
      const start = performance.now()
      const res = await fetch("/api/platform?scope=health-ping")
      const latency = Math.round(performance.now() - start)
      results.push({
        name: "Next.js App",
        status: latency > 3000 ? "degraded" : "healthy",
        latencyMs: latency,
        details: `${latency}ms (HTTP ${res.status})`,
      })
    } catch {
      results.push({ name: "Next.js App", status: "down", latencyMs: null, details: "Connection failed" })
    }

    // Check n8n Engine
    try {
      const start = performance.now()
      const res = await fetch("/api/platform?scope=n8n-health")
      const latency = Math.round(performance.now() - start)
      if (res.ok) {
        const data = await res.json()
        results.push({
          name: "n8n Engine",
          status: data.healthy ? (latency > 3000 ? "degraded" : "healthy") : "degraded",
          latencyMs: latency,
          details: data.healthy ? `${data.activeWorkflows || "?"} active workflows` : (data.error || "Unreachable"),
        })
      } else {
        results.push({
          name: "n8n Engine",
          status: "down",
          latencyMs: latency,
          details: `HTTP ${res.status}`,
        })
      }
    } catch {
      results.push({ name: "n8n Engine", status: "down", latencyMs: null, details: "Connection failed" })
    }

    setServices(results)
    const now = new Date()
    setLastChecked(now)

    const overall: "healthy" | "degraded" | "down" = results.some(s => s.status === "down") ? "down" : results.some(s => s.status === "degraded") ? "degraded" : "healthy"
    setHistory((prev) => [
      { time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), overall, services: results },
      ...prev,
    ].slice(0, 20))

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const seconds = parseInt(autoRefresh)
    if (seconds > 0) {
      intervalRef.current = setInterval(() => checkHealth(true), seconds * 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, checkHealth])

  const overallStatus = services.some(s => s.status === "down")
    ? "down"
    : services.some(s => s.status === "degraded")
      ? "degraded"
      : "healthy"

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const overallConfig = STATUS_CONFIG[overallStatus]
  const uptimePercent = history.length > 0
    ? Math.round((history.filter(h => h.overall === "healthy").length / history.length) * 100)
    : 100

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Activity className="w-6 h-6" />}
        gradient="gradient-green"
        title="System Health"
        subtitle="Monitor platform infrastructure"
        action={
          <div className="flex items-center gap-2">
            <Select value={autoRefresh} onValueChange={setAutoRefresh}>
              <SelectTrigger className="h-8 w-[90px] text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={() => checkHealth(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          </div>
        }
      />

      {/* Overall Status Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={cn("border-2", overallConfig.border)}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", overallConfig.color)}>
              <overallConfig.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {overallStatus === "healthy" ? "All Systems Operational" : overallStatus === "degraded" ? "Partial Degradation" : "System Outage"}
              </h3>
              <div className="flex items-center gap-3 mt-0.5">
                {lastChecked && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last checked: {lastChecked.toLocaleTimeString("en-IN")}
                  </p>
                )}
                {autoRefresh !== "0" && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Wifi className="w-2.5 h-2.5" />
                    Auto-refresh: {REFRESH_OPTIONS.find(o => o.value === autoRefresh)?.label}
                  </Badge>
                )}
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-center gap-1">
              <span className="text-2xl font-bold">{uptimePercent}%</span>
              <span className="text-[10px] text-muted-foreground">session uptime</span>
            </div>
            <div className={cn("w-3 h-3 rounded-full animate-pulse", overallConfig.dot)} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((service, idx) => {
          const config = STATUS_CONFIG[service.status]
          const Icon = SERVICE_ICONS[service.name] || Server
          return (
            <motion.div key={service.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="card-hover h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{service.name}</p>
                        <Badge variant="secondary" className={cn("text-[10px] mt-1", config.color)}>{service.status}</Badge>
                      </div>
                    </div>
                    <div className={cn("w-2.5 h-2.5 rounded-full mt-1", config.dot)} />
                  </div>
                  <div className="space-y-1.5">
                    {service.latencyMs !== null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Latency</span>
                        <span className={cn(
                          "font-mono font-medium",
                          service.latencyMs < 500 ? "text-green-600" : service.latencyMs < 2000 ? "text-amber-600" : "text-red-600"
                        )}>
                          {service.latencyMs}ms
                        </span>
                      </div>
                    )}
                    {service.details && <p className="text-xs text-muted-foreground">{service.details}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Check History */}
      {history.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Check History</h3>
                <Badge variant="secondary" className="text-[10px]">{history.length} checks</Badge>
              </div>
              {/* Timeline bars */}
              <div className="flex items-end gap-0.5 h-8 mb-3">
                {history.slice().reverse().map((snap, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-t-sm min-w-[4px] transition-all",
                      snap.overall === "healthy" ? "bg-green-500" : snap.overall === "degraded" ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ height: snap.overall === "healthy" ? "100%" : snap.overall === "degraded" ? "60%" : "30%" }}
                    title={`${snap.time}: ${snap.overall}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{history[history.length - 1]?.time}</span>
                <span>{history[0]?.time}</span>
              </div>
              {/* Recent events */}
              <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
                {history.slice(0, 10).map((snap, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_CONFIG[snap.overall].dot)} />
                    <span className="font-mono text-muted-foreground w-20 shrink-0">{snap.time}</span>
                    <span className="capitalize">{snap.overall}</span>
                    {snap.services.some(s => s.status !== "healthy") && (
                      <span className="text-muted-foreground/60 truncate">
                        — {snap.services.filter(s => s.status !== "healthy").map(s => s.name).join(", ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
