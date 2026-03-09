"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import {
  TestTube,
  Beaker,
  FileText,
  CheckCircle2,
  Clock,
  Stethoscope,
} from "lucide-react"
import type { LabOrder } from "@/types/database"

interface LabKanbanCardProps {
  order: LabOrder
  onAction?: (orderId: string, action: string) => void
  onSelect: (order: LabOrder) => void
}

const nextActionMap: Record<string, { action: string; label: string; icon: React.ReactNode } | null> = {
  ordered: { action: "collect", label: "Collect", icon: <Beaker className="w-3.5 h-3.5" /> },
  sample_collected: { action: "results", label: "Results", icon: <FileText className="w-3.5 h-3.5" /> },
  processing: { action: "results", label: "Results", icon: <FileText className="w-3.5 h-3.5" /> },
  completed: null,
}

export function LabKanbanCard({ order, onAction, onSelect }: LabKanbanCardProps) {
  const next = nextActionMap[order.status]
  const testCount = order.tests?.length || 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="cursor-pointer card-hover"
        onClick={() => onSelect(order)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm truncate">
              {order.patient_name || order.patient_phone}
            </p>
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <TestTube className="w-3 h-3" />
              {testCount}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate">
              <Stethoscope className="w-3 h-3 shrink-0" />
              {order.doctor_name}
            </span>
            {order.created_at && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <ElapsedTimer
                  startTime={order.created_at}
                  warningMinutes={60}
                  dangerMinutes={120}
                />
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {order.tests?.slice(0, 2).map((test, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <TestTube className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                <span className="truncate">{test.test_name}</span>
                {test.status === "completed" && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto shrink-0" />
                )}
              </div>
            ))}
            {testCount > 2 && (
              <p className="text-[10px] text-muted-foreground/60 pl-4">+{testCount - 2} more</p>
            )}
          </div>

          {next && onAction && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1.5 mt-1"
              onClick={(e) => { e.stopPropagation(); onAction(order.order_id, next.action) }}
            >
              {next.icon}
              {next.label}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
