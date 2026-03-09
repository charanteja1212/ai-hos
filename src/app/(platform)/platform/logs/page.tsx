"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  RefreshCw,
  Loader2,
  XCircle,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  actor_email: string
  actor_role: string
  tenant_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  login: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  status_change: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}

const PAGE_SIZE = 50

export default function AuditLogsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Auth guard — SUPER_ADMIN only
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const supabase = createBrowserClient()
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter !== "all") query = query.eq("action", actionFilter)
      if (entityFilter !== "all") query = query.eq("entity_type", entityFilter)

      const { data, count, error: err } = await query

      if (err) {
        // Table might not exist yet — show empty state instead of error
        if (err.code === "42P01" || err.message?.includes("does not exist")) {
          setLogs([])
          setTotalCount(0)
          setLoading(false)
          setRefreshing(false)
          return
        }
        throw err
      }

      setLogs((data || []) as AuditLog[])
      setTotalCount(count || 0)
    } catch (err) {
      console.error("[logs] Failed to load audit logs:", err)
      setError(true)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter, entityFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter(l =>
      l.actor_email.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    )
  }, [logs, search])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load audit logs</h2>
        <p className="text-sm text-muted-foreground mt-1">The audit_logs table may not exist yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<FileText className="w-6 h-6" />}
        gradient="gradient-orange"
        title="Audit Logs"
        subtitle="Platform activity and event logs"
        badge={<Badge variant="secondary" className="text-xs">{totalCount} entries</Badge>}
        action={
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={() => fetchLogs(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        }
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by email, entity, or action..."
        filters={
          <div className="flex gap-2">
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="status_change">Status Change</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-0">
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        {totalCount === 0 ? "No audit logs yet. Activity will be recorded here." : "No matching logs found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log, idx) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.01 }}
                        className="hover:bg-accent/30 border-b transition-colors duration-150"
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", ACTION_COLORS[log.action] || "")}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium capitalize">{log.entity_type}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">{log.entity_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate max-w-[160px]">{log.actor_email}</span>
                          </span>
                          <p className="text-[10px] text-muted-foreground capitalize">{log.actor_role}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.details ? (() => { try { return JSON.stringify(log.details).slice(0, 80) } catch { return "[unserializable]" } })() : "-"}
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages} ({totalCount} entries)</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
