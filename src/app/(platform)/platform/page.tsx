"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  Globe,
  Building2,
  GitBranch,
  Stethoscope,
  Users,
  ExternalLink,
  XCircle,
  Activity,
  Settings,
  BarChart3,
  FileText,
  ArrowRight,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"
import type { Client, Tenant } from "@/types/database"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  trial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  starter: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  professional: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  trial: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export default function PlatformDashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined

  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Tenant[]>([])
  const [doctorCount, setDoctorCount] = useState(0)
  const [patientCount, setPatientCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Auth guard
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  useEffect(() => {
    fetch("/api/platform?scope=dashboard")
      .then((res) => res.json())
      .then((data) => {
        setClients((data.clients || []) as Client[])
        setBranches((data.branches || []) as Tenant[])
        setDoctorCount(data.doctorCount || 0)
        setPatientCount(data.patientCount || 0)
        setLoading(false)
      })
      .catch((err) => {
        console.error("[platform] Failed to load dashboard data:", err)
        setError(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load platform data</h2>
        <p className="text-muted-foreground">
          Please check your connection and refresh the page.
        </p>
      </div>
    )
  }

  const getBranchCount = (clientId: string) =>
    branches.filter((b) => b.client_id === clientId).length

  return (
    <div className="space-y-5">
      {/* ══════ HEADER ══════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Platform Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          Healthcare SaaS management &middot; {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
        </p>
      </motion.div>

      {/* ══════ INLINE STATS BAR ══════ */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-3 flex-wrap">
        {[
          { label: "Clients", val: clients.length, icon: Building2, accent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400" },
          { label: "Branches", val: branches.length, icon: GitBranch, accent: "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400" },
          { label: "Doctors", val: doctorCount, icon: Stethoscope, accent: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
          { label: "Patients", val: patientCount, icon: Users, accent: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-full pl-1.5 pr-3.5 py-1.5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", s.accent)}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">
                {s.val > 0 ? s.val : "\u2014"}
              </span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "System Health", icon: Activity, href: "/platform/health", color: "bg-green-500/10 text-green-600" },
            { label: "Analytics", icon: BarChart3, href: "/platform/analytics", color: "bg-cyan-600/10 text-cyan-700" },
            { label: "Audit Logs", icon: FileText, href: "/platform/logs", color: "bg-purple-500/10 text-purple-600" },
            { label: "Plans & Tiers", icon: Shield, href: "/platform/plans", color: "bg-amber-500/10 text-amber-600" },
            { label: "Settings", icon: Settings, href: "/platform/settings", color: "bg-gray-500/10 text-gray-600" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto hidden sm:block" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Clients Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">All Clients</h2>
              <Badge variant="secondary" className="text-xs">
                {clients.length}
              </Badge>
            </div>
            <Link
              href="/platform/clients"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      </motion.div>
                      No clients yet. Go to Clients to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client, idx) => (
                    <motion.tr
                      key={client.client_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-accent/30 border-b transition-colors duration-150 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/platform/clients/${client.client_id}`
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white font-bold text-sm">
                            {client.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            PLAN_BADGE[client.subscription_plan] || ""
                          }
                        >
                          {client.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {getBranchCount(client.client_id)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {client.max_branches}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            STATUS_BADGE[client.status] || ""
                          }
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {client.created_at
                          ? new Date(client.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : "-"}
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
