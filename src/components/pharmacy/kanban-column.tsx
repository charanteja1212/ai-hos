"use client"

import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface KanbanColumnProps {
  title: string
  count: number
  dotColor: string
  headerBg: string
  countBg: string
  countText: string
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
  children: ReactNode
}

export function KanbanColumn({
  title,
  count,
  dotColor,
  headerBg,
  countBg,
  countText,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  children,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col bg-[#F7F8FA] dark:bg-gray-900/60 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", dotColor)} />
          <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{title}</span>
        </div>
        <motion.span
          key={count}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums", countBg, countText)}
        >
          {count}
        </motion.span>
      </div>

      {/* Cards area */}
      <ScrollArea className="flex-1 max-h-[520px]">
        <div className="px-2.5 pt-2.5 pb-2.5 space-y-2.5">
          {count === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3", headerBg)}>
                <div className="text-gray-400">{emptyIcon}</div>
              </div>
              <p className="text-xs font-medium text-gray-400">{emptyTitle}</p>
            </motion.div>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
