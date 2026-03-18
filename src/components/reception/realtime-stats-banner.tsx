"use client"

import { motion } from "framer-motion"

interface RealtimeStatsBannerProps {
  total: number
  waiting: number
  inConsultation: number
  completed: number
  avgWaitMinutes: number
}

export function RealtimeStatsBanner({ total, waiting, inConsultation, completed, avgWaitMinutes }: RealtimeStatsBannerProps) {
  const throughput = completed > 0 && total > 0
    ? Math.round((completed / total) * 100)
    : 0

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-gray-200 dark:border-gray-700 px-5 py-3.5 flex items-center gap-6 flex-wrap">
      {/* LIVE indicator */}
      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping-dot absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Live</span>
      </div>

      <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Inline stats */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <motion.span
            key={total}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-sm font-bold text-foreground"
          >
            {total}
          </motion.span>
          <span className="text-xs text-muted-foreground">patients today</span>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.span
            key={waiting}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-sm font-bold text-amber-600 dark:text-amber-400"
          >
            {waiting}
          </motion.span>
          <span className="text-xs text-muted-foreground">waiting</span>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.span
            key={inConsultation}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-sm font-bold text-blue-600 dark:text-blue-400"
          >
            {inConsultation}
          </motion.span>
          <span className="text-xs text-muted-foreground">active</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">
            {avgWaitMinutes > 0 ? `${avgWaitMinutes}m` : "\u2014"}
          </span>
          <span className="text-xs text-muted-foreground">avg wait</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {throughput}%
          </span>
          <span className="text-xs text-muted-foreground">completion</span>
        </div>
      </div>
    </div>
  )
}
