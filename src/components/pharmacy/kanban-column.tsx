"use client"

import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/shared/empty-state"
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
    <div className="flex flex-col min-w-[260px]">
      <div className={cn("flex items-center gap-2 mb-3 p-2 rounded-xl", headerBg)}>
        <div className={cn("w-2.5 h-2.5 rounded-full", dotColor)} />
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <motion.span
          key={count}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full", countBg, countText)}
        >
          {count}
        </motion.span>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-2.5 pr-2">
          {count === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDescription}
            />
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
