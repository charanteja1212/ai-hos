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
  Stethoscope,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatPhone, getInitials } from "@/lib/utils/format"

import type { Doctor, Tenant } from "@/types/database"
import type { SessionUser } from "@/types/auth"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  on_leave: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export default function DoctorsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
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
      supabase.from("doctors").select("*").order("name"),
      supabase.from("tenants").select("tenant_id, hospital_name"),
    ]).then(([dRes, tRes]) => {
      setDoctors((dRes.data || []) as Doctor[])
      setTenants((tRes.data || []) as Tenant[])
      setLoading(false)
    }).catch((err) => {
      console.error("[platform-doctors] Failed to load doctors data:", err)
      setError(true)
      setLoading(false)
    })
  }, [])

  const tenantMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of tenants) m[t.tenant_id] = t.hospital_name
    return m
  }, [tenants])

  const specialties = useMemo(() => {
    const set = new Set(doctors.map(d => d.specialty).filter(Boolean))
    return Array.from(set).sort()
  }, [doctors])

  const filtered = useMemo(() => {
    let list = doctors
    if (statusFilter !== "all") list = list.filter(d => d.status === statusFilter)
    if (specialtyFilter !== "all") list = list.filter(d => d.specialty === specialtyFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.specialty || "").toLowerCase().includes(q) ||
        (d.email || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [doctors, search, statusFilter, specialtyFilter])

  const activeCount = doctors.filter(d => d.status === "active").length

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
        <h2 className="text-lg font-semibold">Failed to load doctors</h2>
        <p className="text-sm text-muted-foreground mt-1">Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Stethoscope className="w-6 h-6" />}
        gradient="gradient-orange"
        title="All Doctors"
        subtitle="Doctors across all branches"
        badge={<Badge variant="secondary" className="text-xs">{doctors.length} total</Badge>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Doctors" value={doctors.length} gradient="gradient-blue" icon={<Stethoscope className="w-10 h-10" />} index={0} />
        <StatCard label="Active" value={activeCount} gradient="gradient-green" icon={<CheckCircle2 className="w-10 h-10" />} index={1} />
        <StatCard label="Specialties" value={specialties.length} gradient="gradient-purple" icon={<Stethoscope className="w-10 h-10" />} index={2} />
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, specialty, or email..."
        filters={
          <div className="flex gap-2">
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-lg">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {specialties.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9 text-xs rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
                    <TableHead>Doctor</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        No doctors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((doc, idx) => (
                      <motion.tr
                        key={doc.doctor_id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-accent/30 border-b transition-colors duration-150"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {getInitials(doc.name)}
                            </div>
                            <p className="font-medium text-sm">{doc.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{doc.specialty}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tenantMap[doc.tenant_id || ""] || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {doc.email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" />{doc.email}
                              </span>
                            )}
                            {doc.phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />{formatPhone(doc.phone)}
                              </span>
                            )}
                            {!doc.email && !doc.phone && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {doc.consultation_fee ? `₹${doc.consultation_fee}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={STATUS_BADGE[doc.status || "active"] || ""}>
                            {(doc.status || "active").replace(/_/g, " ")}
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
