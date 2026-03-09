"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BedDouble, ChevronDown, IndianRupee, User } from "lucide-react"
import type { BedStatus } from "@/hooks/use-ward-beds"
import type { WardConfig } from "@/types/database"

interface BedMapProps {
  wards: Record<string, WardConfig>
  bedMap: Record<string, BedStatus[]>
  totalBeds: number
  occupiedBeds: number
  onBedClick?: (wardName: string, bed: BedStatus) => void
}

export function BedMap({ wards, bedMap, totalBeds, occupiedBeds, onBedClick }: BedMapProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Overall occupancy bar */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Overall Bed Occupancy</p>
          <p className="text-sm font-bold">
            {occupiedBeds} / {totalBeds} beds ({occupancyPct}%)
          </p>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${occupancyPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              occupancyPct > 85 ? "bg-red-500" : occupancyPct > 60 ? "bg-amber-500" : "bg-green-500"
            )}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Available ({totalBeds - occupiedBeds})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Occupied ({occupiedBeds})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-400" /> Maintenance
          </span>
        </div>
      </div>

      {/* Ward sections */}
      <div className="space-y-3 stagger-children">
        {Object.entries(wards).map(([wardName, config], idx) => {
          const beds = bedMap[wardName] || []
          const wardOccupied = beds.filter((b) => b.status === "occupied").length
          const isCollapsed = collapsed[wardName]

          return (
            <motion.div
              key={wardName}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <Card className="card-hover overflow-hidden">
                <CardHeader
                  className="py-3 px-4 cursor-pointer select-none"
                  onClick={() => setCollapsed((p) => ({ ...p, [wardName]: !p[wardName] }))}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                        <BedDouble className="w-3.5 h-3.5" />
                      </div>
                      {wardName}
                      <Badge variant="secondary" className="text-[10px]">
                        {wardOccupied}/{beds.length}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {config.daily_rate}/day
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    </div>
                  </div>
                  {/* Mini occupancy bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        wardOccupied / beds.length > 0.85 ? "bg-red-500" :
                        wardOccupied / beds.length > 0.6 ? "bg-amber-500" : "bg-green-500"
                      )}
                      style={{ width: `${beds.length > 0 ? (wardOccupied / beds.length) * 100 : 0}%` }}
                    />
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="pt-0 pb-3 px-4">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      <TooltipProvider delayDuration={200}>
                        {beds.map((bedStatus) => (
                          <Tooltip key={bedStatus.bed}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onBedClick?.(wardName, bedStatus)}
                                className={cn(
                                  "rounded-lg p-2 text-left transition-all border",
                                  "hover:shadow-md hover:scale-[1.02]",
                                  bedStatus.status === "available" &&
                                    "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                                  bedStatus.status === "occupied" &&
                                    "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800",
                                  bedStatus.status === "maintenance" &&
                                    "bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700 opacity-60"
                                )}
                              >
                                <p className="text-xs font-mono font-bold">{bedStatus.bed}</p>
                                {bedStatus.status === "occupied" && bedStatus.admission ? (
                                  <div className="mt-0.5">
                                    <p className="text-[10px] font-medium truncate">
                                      {bedStatus.admission.patient_name}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground truncate">
                                      {bedStatus.admission.doctor_name}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                                    {bedStatus.status}
                                  </p>
                                )}
                              </button>
                            </TooltipTrigger>
                            {bedStatus.status === "occupied" && bedStatus.admission && (
                              <TooltipContent side="top" className="max-w-[200px]">
                                <div className="space-y-1">
                                  <p className="font-semibold text-xs flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {bedStatus.admission.patient_name}
                                  </p>
                                  <p className="text-[10px]">Doctor: {bedStatus.admission.doctor_name}</p>
                                  <p className="text-[10px]">Diagnosis: {bedStatus.admission.diagnosis || "—"}</p>
                                  {bedStatus.admission.admission_date && (
                                    <p className="text-[10px]">
                                      Admitted: {bedStatus.admission.admission_date.split("T")[0]}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
