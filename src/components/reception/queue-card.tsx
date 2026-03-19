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
        "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700",
        "transition-all duration-200",
        isActive && "bg-cyan-50/50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800/40",
        isEmergency && !isActive && "border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10",
        isUrgent && !isActive && "border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10",
      )}
    >
      <div className="p-3 space-y-2.5">
        {/* Header: queue number + name + badges */}
        <div className="flex items-center gap-2.5">
          {/* Queue number */}
          <div className={cn(
            "relative flex items-center justify-center w-9 h-9 rounded-xl font-bold text-sm shrink-0",
            isActive
              ? "bg-cyan-700 text-white"
              : isEmergency
                ? "bg-red-600 text-white"
                : isUrgent
                  ? "bg-amber-500 text-white"
                  : "bg-white dark:bg-gray-700 text-foreground border border-gray-200 dark:border-gray-600"
          )}>
            {entry.queue_number}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping-dot" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">
              {entry.patient_name || "Unknown"}
            </p>
            {entry.doctor_name && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Stethoscope className="w-3 h-3 shrink-0 text-cyan-400" />
                {entry.doctor_name}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {entry.walk_in && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
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
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors",
                  isEmergency ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
                    : isUrgent ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300"
                )}
                title="Click to change priority"
              >
                {isEmergency ? <Zap className="w-2.5 h-2.5" /> : isUrgent ? <AlertTriangle className="w-2.5 h-2.5" /> : null}
                {isEmergency ? "Emergency" : isUrgent ? "Urgent" : "Normal"}
              </button>
            ) : entry.priority > 0 ? (
              <span className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
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
            <span className="text-[10px] font-medium text-cyan-700/70 bg-cyan-50 dark:bg-cyan-900/20 rounded-full px-2 py-0.5">
              ~{estimatedWaitMin}m wait
            </span>
          )}
          {isActive && entry.consultation_start && (
            <span className="flex items-center gap-1 ml-auto">
              <Stethoscope className="w-3 h-3 text-cyan-600" />
              <ElapsedTimer startTime={entry.consultation_start} warningMinutes={15} dangerMinutes={30} />
            </span>
          )}
        </div>

        {/* === ACTION BUTTONS === */}
        {!isCompleted && (
          <div className="flex gap-2 pt-2">
            {entry.status === "waiting" && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-8 gap-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold"
                  onClick={() => onStatusChange(entry.queue_id, "in_consultation")}
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Consult
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
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
                  className="flex-1 h-8 gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                  onClick={() => onStatusChange(entry.queue_id, "completed")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Done
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg"
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
