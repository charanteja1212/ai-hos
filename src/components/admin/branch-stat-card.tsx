"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Users, Stethoscope, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BranchStatCardProps {
  branch: { tenant_id: string; hospital_name: string; city?: string | null }
  isActive: boolean
  onClick: () => void
  stats: { appointments: number; patients: number; doctors: number; completed: number }
  index: number
}

export const BranchStatCard = memo(function BranchStatCard({ branch, isActive, onClick, stats, index }: BranchStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="shrink-0"
    >
      <Card
        className={cn(
          "w-56 cursor-pointer transition-all hover:shadow-md",
          isActive
            ? "ring-2 ring-primary shadow-md"
            : "hover:ring-1 hover:ring-primary/30"
        )}
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{branch.hospital_name}</p>
              {branch.city && (
                <p className="text-xs text-muted-foreground">{branch.city}</p>
              )}
            </div>
            {isActive ? (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary shrink-0">
                Active
              </Badge>
            ) : (
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="w-3 h-3" />
                Today
              </span>
              <span className="font-semibold">{stats.appointments} appts</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="w-3 h-3" />
                Completed
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">{stats.completed}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="w-3 h-3" />
                Patients
              </span>
              <span className="font-semibold">{stats.patients}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Stethoscope className="w-3 h-3" />
                Doctors
              </span>
              <span className="font-semibold">{stats.doctors}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
