"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  Stethoscope,
  Zap,
  AlertTriangle,
} from "lucide-react"
import { formatTime } from "@/lib/utils/date"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import type { QueueEntry } from "@/types/database"

interface QueueCardProps {
  entry: QueueEntry
  onStatusChange: (queueId: string, status: string) => void
  onPriorityChange?: (queueId: string, priority: number) => void
  estimatedWaitMin?: number
}

export function QueueCard({ entry, onStatusChange, onPriorityChange, estimatedWaitMin }: QueueCardProps) {
  const isActive = entry.status === "in_consultation"
  const isCompleted = entry.status === "completed" || entry.status === "no_show" || entry.status === "cancelled"
  const isEmergency = entry.priority === 2
  const isUrgent = entry.priority === 1

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-card border border-border/60",
        "shadow-sm transition-all duration-200",
        isActive && "ring-2 ring-blue-400/30 border-blue-200 dark:border-blue-800/40",
        isEmergency && !isActive && "ring-2 ring-red-400/40",
        isUrgent && !isActive && "ring-2 ring-amber-400/40",
      )}
    >
      {/* Top accent bar */}
      <div className={cn(
        "h-[3px] w-full bg-gradient-to-r",
        entry.status === "waiting" && "from-amber-400 to-orange-500",
        isActive && "from-blue-400 to-indigo-500",
        entry.status === "completed" && "from-emerald-400 to-green-500",
        entry.status === "no_show" && "from-red-400 to-rose-500",
        entry.status === "cancelled" && "from-gray-400 to-slate-500",
      )} />

      <div className="p-3 space-y-2.5">
        {/* Header: queue number + name + badges */}
        <div className="flex items-center gap-2.5">
          {/* Queue number */}
          <div className={cn(
            "relative flex items-center justify-center w-9 h-9 rounded-lg font-bold text-sm shrink-0",
            isActive
              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm"
              : isEmergency
                ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm"
                : isUrgent
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm"
                  : "bg-primary/10 text-primary"
          )}>
            {entry.queue_number}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 animate-ping-dot" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">
              {entry.patient_name || "Unknown"}
            </p>
            {entry.doctor_name && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Stethoscope className="w-3 h-3 shrink-0 text-primary/50" />
                {entry.doctor_name}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {entry.walk_in && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                Walk-in
              </span>
            )}
            {entry.status === "waiting" && onPriorityChange ? (
              <button
                onClick={() => {
                  const nextPriority = entry.priority === 0 ? 1 : entry.priority === 1 ? 2 : 0
                  onPriorityChange(entry.queue_id, nextPriority)
                }}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors",
                  isEmergency ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
                    : isUrgent ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
                )}
                title="Click to change priority"
              >
                {isEmergency ? <Zap className="w-2.5 h-2.5" /> : isUrgent ? <AlertTriangle className="w-2.5 h-2.5" /> : null}
                {isEmergency ? "Emergency" : isUrgent ? "Urgent" : "Normal"}
              </button>
            ) : entry.priority > 0 ? (
              <span className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                isEmergency ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              )}>
                {isEmergency ? <Zap className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                {isEmergency ? "Emergency" : "Urgent"}
              </span>
            ) : null}
          </div>
        </div>

        {/* Info row: phone + timers */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {entry.patient_phone && (
            <span className="flex items-center gap-1 min-w-0">
              <Phone className="w-3 h-3 shrink-0 text-muted-foreground/50" />
              <span className="truncate">{entry.patient_phone}</span>
            </span>
          )}
          {entry.check_in_time && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {formatTime(new Date(entry.check_in_time).toTimeString().slice(0, 5))}
            </span>
          )}
          {entry.status === "waiting" && entry.check_in_time && (
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3 text-amber-500" />
              <ElapsedTimer startTime={entry.check_in_time} warningMinutes={20} dangerMinutes={40} />
            </span>
          )}
          {entry.status === "waiting" && estimatedWaitMin !== undefined && estimatedWaitMin > 0 && (
            <span className="text-[10px] font-medium text-primary/70 bg-primary/5 rounded px-1.5 py-0.5">
              ~{estimatedWaitMin}m wait
            </span>
          )}
          {isActive && entry.consultation_start && (
            <span className="flex items-center gap-1 ml-auto">
              <Stethoscope className="w-3 h-3 text-blue-500" />
              <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} />
            </span>
          )}
        </div>

        {/* === ACTION BUTTONS — clear, visible, no guessing === */}
        {!isCompleted && (
          <div className="flex gap-2 pt-1 border-t border-border/40">
            {entry.status === "waiting" && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  onClick={() => onStatusChange(entry.queue_id, "in_consultation")}
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Consult
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => onStatusChange(entry.queue_id, "no_show")}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {isActive && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                  onClick={() => onStatusChange(entry.queue_id, "completed")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs text-gray-500 hover:text-gray-600"
                  onClick={() => onStatusChange(entry.queue_id, "cancelled")}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
