"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ElapsedTimer } from "@/components/ui/elapsed-timer"
import {
  Pill,
  Package,
  CheckCircle2,
  ShoppingBag,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PharmacyOrder } from "@/types/database"

interface OrderKanbanCardProps {
  order: PharmacyOrder
  onAdvance?: (orderId: string, nextStatus: string) => void
  onSelect: (order: PharmacyOrder) => void
}

const nextStatusMap: Record<string, { status: string; label: string; icon: React.ReactNode }> = {
  pending: { status: "preparing", label: "Start", icon: <Package className="w-3.5 h-3.5" /> },
  preparing: { status: "ready", label: "Ready", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ready: { status: "dispensed", label: "Dispense", icon: <ShoppingBag className="w-3.5 h-3.5" /> },
}

const borderColors: Record<string, string> = {
  pending: "border-l-amber-500",
  preparing: "border-l-blue-500",
  ready: "border-l-green-500",
  dispensed: "border-l-gray-400",
}

export function OrderKanbanCard({ order, onAdvance, onSelect }: OrderKanbanCardProps) {
  const next = nextStatusMap[order.status]
  const itemCount = order.items?.length || 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "cursor-pointer card-hover border-l-4",
          borderColors[order.status] || "border-l-gray-300"
        )}
        onClick={() => onSelect(order)}
      >
        <CardContent className="p-3 space-y-2">
          {/* Header: patient name + medicine count */}
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm truncate">
              {order.patient_name || order.patient_phone}
            </p>
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <Pill className="w-3 h-3" />
              {itemCount}
            </Badge>
          </div>

          {/* Doctor + time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">Dr. {order.doctor_name}</span>
            {order.created_at && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <ElapsedTimer
                  startTime={order.created_at}
                  warningMinutes={30}
                  dangerMinutes={60}
                />
              </span>
            )}
          </div>

          {/* Top medicines preview */}
          <div className="space-y-0.5">
            {order.items?.slice(0, 2).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <Pill className="w-2.5 h-2.5 text-green-500 shrink-0" />
                <span className="truncate">{item.medicine_name}</span>
                <span className="text-muted-foreground/60 ml-auto shrink-0">{item.dosage}</span>
              </div>
            ))}
            {itemCount > 2 && (
              <p className="text-[10px] text-muted-foreground/60 pl-4">+{itemCount - 2} more</p>
            )}
          </div>

          {/* Advance button */}
          {next && onAdvance && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1.5 mt-1"
              onClick={(e) => { e.stopPropagation(); onAdvance(order.order_id, next.status) }}
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
