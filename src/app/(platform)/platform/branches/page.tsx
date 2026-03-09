"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { StatCard } from "@/components/shared/stat-card"
import { Badge } from "@/components/ui/badge"
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
  GitBranch,
  Building2,
  MapPin,
  Phone,
  XCircle,
  CheckCircle2,
  MessageSquare,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatPhone } from "@/lib/utils/format"

import type { Tenant, Client } from "@/types/database"
import type { SessionUser } from "@/types/auth"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export default function BranchesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const [branches, setBranches] = useState<Tenant[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Auth guard — SUPER_ADMIN only
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  useEffect(() => {
    const supabase = createBrowserClient()
    Promise.all([
      supabase.from("tenants").select("*").order("hospital_name"),
      supabase.from("clients").select("client_id, name"),
    ]).then(([bRes, cRes]) => {
      setBranches((bRes.data || []) as Tenant[])
      setClients((cRes.data || []) as Client[])
      setLoading(false)
    }).catch((err) => {
      console.error("[branches] Failed to load branch data:", err)
      setError(true)
      setLoading(false)
    })
  }, [])

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of clients) m[c.client_id] = c.name
    return m
  }, [clients])

  const filtered = useMemo(() => {
    let list = branches
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        b.hospital_name.toLowerCase().includes(q) ||
        (b.city || "").toLowerCase().includes(q) ||
        (clientMap[b.client_id || ""] || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [branches, search, statusFilter, clientMap])

  const activeBranches = branches.filter(b => b.status === "active").length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load branches</h2>
        <p className="text-sm text-muted-foreground mt-1">Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<GitBranch className="w-6 h-6" />}
        gradient="gradient-green"
        title="All Branches"
        subtitle="Manage branches across all clients"
        badge={<Badge variant="secondary" className="text-xs">{branches.length} total</Badge>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Branches" value={branches.length} gradient="gradient-blue" icon={<GitBranch className="w-10 h-10" />} index={0} />
        <StatCard label="Active" value={activeBranches} gradient="gradient-green" icon={<CheckCircle2 className="w-10 h-10" />} index={1} />
        <StatCard label="WhatsApp Enabled" value={branches.filter(b => b.whatsapp_phone_id).length} gradient="gradient-purple" icon={<MessageSquare className="w-10 h-10" />} index={2} />
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search branches by name, city, or client..."
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-0">
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        No branches found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((branch, idx) => (
                      <motion.tr
                        key={branch.tenant_id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-accent/30 border-b transition-colors duration-150"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl gradient-green flex items-center justify-center text-white">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{branch.hospital_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{branch.tenant_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{clientMap[branch.client_id || ""] || "-"}</TableCell>
                        <TableCell>
                          {branch.city ? (
                            <span className="flex items-center gap-1 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {branch.city}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{branch.phone ? formatPhone(branch.phone) : "-"}</TableCell>
                        <TableCell>
                          {branch.whatsapp_phone_id ? (
                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={STATUS_BADGE[branch.status] || ""}>
                            {branch.status}
                          </Badge>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
