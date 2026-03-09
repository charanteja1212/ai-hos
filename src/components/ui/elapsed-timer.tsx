"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ElapsedTimerProps {
  startTime: string
  warningMinutes?: number
  dangerMinutes?: number
  className?: string
}

export function ElapsedTimer({ startTime, warningMinutes = 15, dangerMinutes = 30, className }: ElapsedTimerProps) {
  const [elapsed, setElapsed] = useState("")
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setMinutes(m)
      setElapsed(`${m}m ${s.toString().padStart(2, "0")}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <span
      className={cn(
        "text-xs font-mono",
        minutes < warningMinutes && "text-blue-600 dark:text-blue-400",
        minutes >= warningMinutes && minutes < dangerMinutes && "text-amber-600 dark:text-amber-400",
        minutes >= dangerMinutes && "text-red-600 dark:text-red-400 animate-pulse-soft",
        className
      )}
    >
      {elapsed}
    </span>
  )
}
