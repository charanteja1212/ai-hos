"use client"

import { useState, useEffect, useCallback } from "react"
import { useBranch } from "@/components/providers/branch-context"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Star, MessageSquare, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, Search, Download } from "lucide-react"
import { motion } from "framer-motion"

interface Feedback {
  id: string
  booking_id: string
  patient_phone: string
  patient_name: string
  doctor_id: string
  doctor_name: string
  specialty: string
  rating: number
  comment: string
  source: string
  created_at: string
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  )
}

export default function FeedbackPage() {
  const { activeTenantId: tenantId } = useBranch()

  const PAGE_SIZE = 30
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingFilter, setRatingFilter] = useState("all")
  const [doctorFilter, setDoctorFilter] = useState("all")
  const [doctors, setDoctors] = useState<{ doctor_id: string; name: string }[]>([])

  // Stats
  const [stats, setStats] = useState({ total: 0, avgRating: 0, fiveStar: 0, oneStar: 0 })

  // Fetch doctors
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("doctor_id, name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        if (data) setDoctors(data)
      })
  }, [tenantId])

  // Fetch feedback
  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    let query = supabase
      .from("feedback")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })

    if (ratingFilter !== "all") query = query.eq("rating", parseInt(ratingFilter))
    if (doctorFilter !== "all") query = query.eq("doctor_id", doctorFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      query = query.or(`patient_name.ilike.%${q}%,doctor_name.ilike.%${q}%,comment.ilike.%${q}%`)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count, error } = await query.range(from, to)

    if (!error) {
      setFeedback((data || []) as Feedback[])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [tenantId, ratingFilter, doctorFilter, searchQuery, page])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const supabase = createBrowserClient()

    const { count: total } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)

    const { data: allRatings } = await supabase
      .from("feedback")
      .select("rating")
      .eq("tenant_id", tenantId)

    const avgRating = allRatings && allRatings.length > 0
      ? allRatings.reduce((sum: number, r: { rating: number }) => sum + (r.rating || 0), 0) / allRatings.length
      : 0

    const { count: fiveStar } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("rating", 5)

    const { count: oneStar } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("rating", 1)

    setStats({
      total: total || 0,
      avgRating: avgRating,
      fiveStar: fiveStar || 0,
      oneStar: oneStar || 0,
    })
  }, [tenantId])

  useEffect(() => { fetchFeedback() }, [fetchFeedback])
  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(0) }, [searchQuery, ratingFilter, doctorFilter])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const exportCSV = useCallback(() => {
    if (feedback.length === 0) return
    const headers = ["Date", "Patient", "Phone", "Doctor", "Specialty", "Rating", "Comment", "Booking ID"]
    const rows = feedback.map((f) => [
      new Date(f.created_at).toLocaleDateString("en-IN"),
      f.patient_name || "",
      f.patient_phone || "",
      f.doctor_name ? `Dr. ${f.doctor_name}` : "",
      f.specialty || "",
      String(f.rating),
      `"${(f.comment || "").replace(/"/g, '""')}"`,
      f.booking_id || "",
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `feedback_export.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [feedback])

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<MessageSquare className="w-6 h-6" />}
        gradient="gradient-purple"
        title="Patient Feedback"
        subtitle="Review and monitor patient satisfaction"
        badge={<Badge variant="secondary" className="text-xs">{stats.total} reviews</Badge>}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchFeedback(); fetchStats() }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            {feedback.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Reviews</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg Rating</p>
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold">{stats.avgRating ? Number(stats.avgRating).toFixed(1) : "—"}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">5-Star</p>
            <p className="text-2xl font-bold text-green-500">{stats.fiveStar}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">1-Star</p>
            <p className="text-2xl font-bold text-red-500">{stats.oneStar}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, doctor, or comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.doctor_id} value={d.doctor_id}>Dr. {d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : feedback.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No feedback found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="hidden md:table-cell">Comment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.map((f, idx) => (
                <motion.tr
                  key={f.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b"
                >
                  <TableCell>
                    <div className="font-medium">{f.patient_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{f.booking_id}</div>
                  </TableCell>
                  <TableCell>
                    <div>{f.doctor_name ? `Dr. ${f.doctor_name}` : "—"}</div>
                    <div className="text-xs text-muted-foreground">{f.specialty}</div>
                  </TableCell>
                  <TableCell>
                    <StarRating rating={f.rating} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[300px]">
                    <p className="text-sm text-muted-foreground truncate">{f.comment || "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
