"use client"

import { useState, useEffect } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  ArrowLeftRight,
  Clock,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  actor_email: string
  actor_role: string
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  create: { icon: Plus, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  update: { icon: Pencil, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  delete: { icon: Trash2, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  login: { icon: LogIn, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  status_change: { icon: ArrowLeftRight, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
}

const PAGE_SIZE = 30

export default function ActivityLogPage() {
  const { activeTenantId } = useBranch()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")

  useEffect(() => {
    if (!activeTenantId) return
    setLoading(true)
    const supabase = createBrowserClient()

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterAction !== "all") query = query.eq("action", filterAction)
    if (filterEntity !== "all") query = query.eq("entity_type", filterEntity)
    if (search) query = query.or(`actor_email.ilike.%${search}%,entity_id.ilike.%${search}%`)

    query.then(({ data, count }) => {
      setEntries(data || [])
      setTotal(count || 0)
      setLoading(false)
    })
  }, [activeTenantId, page, filterAction, filterEntity, search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<FileText className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Activity Log"
        subtitle="Recent actions in your hospital"
        badge={<Badge variant="secondary" className="text-xs">{total} entries</Badge>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0) }}>
          <SelectTrigger className="w-[130px] rounded-xl"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="status_change">Status Change</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setPage(0) }}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="patient">Patient</SelectItem>
            <SelectItem value="doctor">Doctor</SelectItem>
            <SelectItem value="appointment">Appointment</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Entries */}
      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || filterAction !== "all" || filterEntity !== "all"
                ? "No matching log entries"
                : "No activity recorded yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update
            const ActionIcon = config.icon
            const time = new Date(entry.created_at)
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.color)}>
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={cn("text-[10px]", config.color)}>
                          {entry.action}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.entity_type}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{entry.entity_id}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{entry.actor_email}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{entry.actor_role}</span>
                      </div>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1 truncate max-w-md">
                          {JSON.stringify(entry.details).slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {time.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {" "}
                      {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
