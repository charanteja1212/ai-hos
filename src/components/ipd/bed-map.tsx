"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BedDouble,
  ChevronDown,
  Clock,
  IndianRupee,
  Stethoscope,
  User,
  Wrench,
  Heart,
  ShieldCheck,
} from "lucide-react"
import type { BedStatus } from "@/hooks/use-ward-beds"
import type { WardConfig } from "@/types/database"

interface BedMapProps {
  wards: Record<string, WardConfig>
  bedMap: Record<string, BedStatus[]>
  totalBeds: number
  occupiedBeds: number
  onBedClick?: (wardName: string, bed: BedStatus) => void
}

function getWardGradient(ward: string) {
  const w = ward.toLowerCase()
  if (w.includes("icu")) return "from-red-500 to-rose-600"
  if (w.includes("nicu")) return "from-red-600 to-pink-600"
  if (w.includes("private")) return "from-purple-500 to-indigo-600"
  if (w.includes("semi")) return "from-cyan-600 to-cyan-600"
  if (w.includes("maternity")) return "from-pink-500 to-rose-500"
  if (w.includes("pediatric")) return "from-emerald-500 to-teal-600"
  if (w.includes("surgical")) return "from-amber-500 to-orange-600"
  return "from-cyan-600 to-indigo-600"
}

function getWardIcon(ward: string) {
  const w = ward.toLowerCase()
  if (w.includes("icu") || w.includes("nicu")) return <Heart className="w-4 h-4" />
  if (w.includes("surgical")) return <ShieldCheck className="w-4 h-4" />
  return <BedDouble className="w-4 h-4" />
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

function getDaysStayed(dateStr?: string) {
  if (!dateStr) return 0
  const start = new Date(dateStr)
  return Math.max(1, Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

// ─── Bed Tile ───

function BedTile({
  bedStatus,
  wardName,
  onBedClick,
}: {
  bedStatus: BedStatus
  wardName: string
  onBedClick?: (wardName: string, bed: BedStatus) => void
}) {
  const isOccupied = bedStatus.status === "occupied"
  const isMaintenance = bedStatus.status === "maintenance"
  const adm = bedStatus.admission
  const days = adm ? getDaysStayed(adm.admission_date || adm.created_at) : 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onBedClick?.(wardName, bedStatus)}
          className={cn(
            "rounded-xl p-2.5 text-left transition-all border relative overflow-hidden group",
            isOccupied &&
              "bg-gradient-to-br from-orange-50 to-amber-50/50 border-orange-200/60 dark:from-orange-950/20 dark:to-amber-950/10 dark:border-orange-800/40 shadow-sm",
            bedStatus.status === "available" &&
              "bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200/60 dark:from-green-950/20 dark:to-emerald-950/10 dark:border-green-800/40",
            isMaintenance &&
              "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 dark:from-gray-800/20 dark:to-slate-800/20 dark:border-gray-700 opacity-50"
          )}
        >
          {/* Bed number header */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono font-bold text-foreground">{bedStatus.bed}</span>
            {isOccupied && days > 0 && (
              <span className={cn(
                "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                days >= 7 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"
              )}>
                {days}d
              </span>
            )}
            {isMaintenance && <Wrench className="w-3 h-3 text-muted-foreground" />}
          </div>

          {isOccupied && adm ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-[8px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    {getInitials(adm.patient_name || "P")}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[10px] font-semibold truncate flex-1">{adm.patient_name}</p>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Stethoscope className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{adm.doctor_name}</span>
              </div>
            </div>
          ) : !isMaintenance ? (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Available</span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Under maintenance</p>
          )}

          {/* Hover glow */}
          {isOccupied && (
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
          )}
        </motion.button>
      </TooltipTrigger>

      {isOccupied && adm && (
        <TooltipContent side="top" className="p-3 max-w-[220px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                  {getInitials(adm.patient_name || "P")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-xs">{adm.patient_name}</p>
                <p className="text-[10px] text-muted-foreground">{adm.patient_phone}</p>
              </div>
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="w-3 h-3 text-muted-foreground" />
                <span>{adm.doctor_name}</span>
              </div>
              {adm.diagnosis && (
                <div className="flex items-start gap-1.5">
                  <Heart className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{adm.diagnosis}</span>
                </div>
              )}
              {adm.admission_date && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span>Day {days} &middot; Admitted {adm.admission_date.split("T")[0]}</span>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  )
}

// ─── Ward Section ───

function WardSection({
  wardName,
  config,
  beds,
  idx,
  collapsed,
  onToggle,
  onBedClick,
}: {
  wardName: string
  config: WardConfig
  beds: BedStatus[]
  idx: number
  collapsed: boolean
  onToggle: () => void
  onBedClick?: (wardName: string, bed: BedStatus) => void
}) {
  const wardOccupied = beds.filter((b) => b.status === "occupied").length
  const wardAvailable = beds.filter((b) => b.status === "available").length
  const pct = beds.length > 0 ? Math.round((wardOccupied / beds.length) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.06 }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      {/* Ward Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
      >
        {/* Ward icon with gradient */}
        <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", getWardGradient(wardName))}>
          {getWardIcon(wardName)}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{wardName}</h3>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {wardOccupied}/{beds.length}
            </Badge>
            {wardAvailable > 0 && (
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                {wardAvailable} free
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mt-2 max-w-[200px]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.06 + 0.2 }}
              className={cn(
                "h-full rounded-full",
                pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500"
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground flex items-center gap-0.5 hidden sm:flex">
            <IndianRupee className="w-3 h-3" />
            {config.daily_rate}/day
          </span>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", collapsed && "-rotate-90")} />
        </div>
      </button>

      {/* Bed Grid */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                <TooltipProvider delayDuration={150}>
                  {beds.map((bedStatus) => (
                    <BedTile key={bedStatus.bed} bedStatus={bedStatus} wardName={wardName} onBedClick={onBedClick} />
                  ))}
                </TooltipProvider>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───

export function BedMap({ wards, bedMap, totalBeds, occupiedBeds, onBedClick }: BedMapProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
  const availableBeds = totalBeds - occupiedBeds

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Bed Occupancy Overview</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {occupiedBeds} occupied &middot; {availableBeds} available &middot; {totalBeds} total
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gradient-to-br from-green-400 to-green-600 shadow-sm" />
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gradient-to-br from-orange-400 to-amber-600 shadow-sm" />
                Occupied
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gradient-to-br from-gray-300 to-gray-400 shadow-sm" />
                Maintenance
              </span>
            </div>
          </div>
        </div>

        {/* Premium progress bar */}
        <div className="mt-3 relative">
          <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full bg-gradient-to-r",
                occupancyPct > 85
                  ? "from-red-400 to-red-600"
                  : occupancyPct > 60
                  ? "from-amber-400 to-amber-600"
                  : "from-green-400 to-green-600"
              )}
            />
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute right-0 -top-5 text-[10px] font-bold text-muted-foreground"
          >
            {occupancyPct}%
          </motion.span>
        </div>
      </div>

      {/* Ward Sections */}
      <div className="space-y-3">
        {Object.entries(wards).map(([wardName, config], idx) => (
          <WardSection
            key={wardName}
            wardName={wardName}
            config={config}
            beds={bedMap[wardName] || []}
            idx={idx}
            collapsed={!!collapsed[wardName]}
            onToggle={() => setCollapsed((p) => ({ ...p, [wardName]: !p[wardName] }))}
            onBedClick={onBedClick}
          />
        ))}
      </div>
    </div>
  )
}
