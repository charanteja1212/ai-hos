"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  Search,
  Phone,
  Mail,
  Building2,
  CalendarDays,
  UserCheck,
  UserX,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"

interface PatientRow {
  phone: string
  name: string
  age?: number
  gender?: string
  email?: string
  visit_count?: number
  tenant_id?: string
  created_at?: string
}

export default function PlatformPatientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined

  const [patients, setPatients] = useState<PatientRow[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  useEffect(() => {
    const supabase = createBrowserClient()

    Promise.all([
      supabase
        .from("patients")
        .select("phone, name, age, gender, email, visit_count, tenant_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("patients")
        .select("phone", { count: "exact", head: true }),
      supabase
        .from("tenants")
        .select("tenant_id, hospital_name"),
    ]).then(([patientsRes, countRes, tenantsRes]) => {
      setPatients(patientsRes.data || [])
      setTotalCount(countRes.count || 0)
      const map: Record<string, string> = {}
      for (const t of tenantsRes.data || []) {
        map[t.tenant_id] = t.hospital_name
      }
      setTenantMap(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = search
    ? patients.filter((p) => {
        const q = search.toLowerCase()
        return (
          p.name?.toLowerCase().includes(q) ||
          p.phone?.includes(q) ||
          p.email?.toLowerCase().includes(q)
        )
      })
    : patients

  const withVisits = patients.filter((p) => (p.visit_count || 0) > 0).length
  const recentCount = patients.filter((p) => {
    if (!p.created_at) return false
    const d = new Date(p.created_at)
    const now = new Date()
    return now.getTime() - d.getTime() < 30 * 24 * 60 * 60 * 1000
  }).length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Users className="w-6 h-6" />}
        gradient="gradient-purple"
        title="All Patients"
        subtitle="Cross-tenant patient directory"
        badge={<Badge variant="secondary" className="text-xs">{totalCount} total</Badge>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Patients"
          value={totalCount}
          gradient="gradient-purple"
          icon={<Users className="w-10 h-10" />}
          index={0}
        />
        <StatCard
          label="Active (with visits)"
          value={withVisits}
          gradient="gradient-green"
          icon={<UserCheck className="w-10 h-10" />}
          index={1}
        />
        <StatCard
          label="New (last 30 days)"
          value={recentCount}
          gradient="gradient-blue"
          icon={<CalendarDays className="w-10 h-10" />}
          index={2}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Hospital</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead className="hidden md:table-cell">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <UserX className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      {search ? `No patients matching "${search}"` : "No patients found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p, idx) => (
                    <motion.tr
                      key={p.phone}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b hover:bg-accent/30 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 text-xs font-bold">
                            {p.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <div className="flex items-center gap-2">
                              {p.age && <span className="text-[10px] text-muted-foreground">{p.age}y</span>}
                              {p.gender && <span className="text-[10px] text-muted-foreground capitalize">{p.gender}</span>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {p.phone}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.email ? (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {p.email}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.tenant_id && tenantMap[p.tenant_id] ? (
                          <span className="text-xs flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {tenantMap[p.tenant_id]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px]", (p.visit_count || 0) > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "")}>
                          {p.visit_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border/50 text-xs text-muted-foreground">
              Showing {filtered.length} of {totalCount} patients
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
