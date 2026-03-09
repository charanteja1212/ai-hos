"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkline } from "@/components/ui/sparkline"
import { cn } from "@/lib/utils"

export interface DoctorPerf {
  doctor_id: string
  doctor_name: string
  specialty: string
  patients_seen: number
  avg_consultation_min: number
  completion_rate: number
  daily_counts: number[] // 7-day patient counts
}

const SPECIALTY_COLORS: Record<string, string> = {
  "General Medicine": "from-blue-500 to-cyan-500",
  "Pediatrics": "from-green-500 to-emerald-500",
  "Cardiology": "from-red-500 to-rose-500",
  "Orthopedics": "from-amber-500 to-orange-500",
  "Dermatology": "from-purple-500 to-violet-500",
  "ENT": "from-teal-500 to-cyan-500",
  "Gynecology": "from-pink-500 to-rose-500",
  "Neurology": "from-indigo-500 to-blue-500",
}

function getGradient(specialty: string): string {
  return SPECIALTY_COLORS[specialty] || "from-gray-500 to-slate-500"
}

interface DoctorPerformanceCardProps {
  doctor: DoctorPerf
  index: number
}

export const DoctorPerformanceCard = memo(function DoctorPerformanceCard({ doctor, index }: DoctorPerformanceCardProps) {
  const gradient = getGradient(doctor.specialty)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="min-w-[260px] snap-start"
    >
      <Card className="card-hover h-full relative overflow-hidden">
        {/* Top gradient strip */}
        <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", gradient)} />
        <CardContent className="p-4 pt-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0", gradient)}>
              {doctor.doctor_name?.split(" ").filter((n) => n !== "Dr.").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{doctor.doctor_name}</p>
              <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{doctor.patients_seen}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Patients</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{doctor.avg_consultation_min}m</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Time</p>
            </div>
            <div>
              <p className={cn("text-lg font-bold", doctor.completion_rate >= 80 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
                {doctor.completion_rate}%
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</p>
            </div>
          </div>

          {doctor.daily_counts.length >= 2 && (
            <div className="flex items-center justify-center">
              <Sparkline
                data={doctor.daily_counts}
                width={200}
                height={28}
                color="hsl(var(--primary))"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
})
