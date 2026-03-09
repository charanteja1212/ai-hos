"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  UserPlus,
  Phone,
  Play,
  XCircle,
  ArrowRight,
} from "lucide-react"
import type { QueueEntry } from "@/types/database"

interface QuickActionsPanelProps {
  tenantId: string
  nextPatient: QueueEntry | null
  onStatusChange: (queueId: string, status: string) => void
}

interface PatientResult {
  name: string
  phone: string
}

export function QuickActionsPanel({ tenantId, nextPatient, onStatusChange }: QuickActionsPanelProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PatientResult[]>([])
  const [searching, setSearching] = useState(false)

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearching(true)
      const supabase = createBrowserClient()
      const safeSearch = searchQuery.replace(/[^a-zA-Z0-9\s\-\.]/g, "")
      const { data } = await supabase
        .from("patients")
        .select("name, phone")
        .eq("tenant_id", tenantId)
        .or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`)
        .limit(5)

      setSearchResults((data || []) as PatientResult[])
      setSearching(false)
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery, tenantId])

  const handlePatientClick = useCallback((phone: string) => {
    router.push(`/reception/patients?search=${phone}`)
  }, [router])

  return (
    <div className="space-y-4 sticky top-4">
      {/* Smart Search */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Quick Search</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 input-focus-glow"
              placeholder="Patient name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                {searchResults.map((p) => (
                  <button
                    key={p.phone}
                    onClick={() => handlePatientClick(p.phone)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{p.phone}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </motion.div>
            )}
            {searching && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
                Searching...
              </motion.p>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Next Up */}
      {nextPatient && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">Next Up</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                {nextPatient.queue_number}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{nextPatient.patient_name}</p>
                <p className="text-xs text-muted-foreground">{nextPatient.patient_phone}</p>
              </div>
            </div>
            {nextPatient.priority > 0 && (
              <Badge variant="destructive" className="text-xs">
                {nextPatient.priority === 2 ? "Emergency" : "Urgent"}
              </Badge>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={() => onStatusChange(nextPatient.queue_id, "in_consultation")}
              >
                <Play className="w-4 h-4" />
                Call Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(nextPatient.queue_id, "no_show")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Actions</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => router.push("/reception/book")}
          >
            <UserPlus className="w-4 h-4 text-primary" />
            New Walk-in Booking
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => router.push("/reception/appointments")}
          >
            <Search className="w-4 h-4 text-primary" />
            View Appointments
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
