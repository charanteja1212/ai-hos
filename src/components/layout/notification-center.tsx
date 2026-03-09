"use client"

import { useState } from "react"
import { useNotifications } from "@/hooks/use-notifications"
import { useBranch } from "@/components/providers/branch-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Bell,
  BellOff,
  BedDouble,
  CheckCheck,
  LogOut,
  ArrowRightLeft,
  Pill,
  Receipt,
  ShoppingBag,
  TestTube,
  Beaker,
  UserPlus,
  Volume2,
  VolumeX,
  Filter,
  X,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"
import type { Notification } from "@/types/database"

interface NotificationCenterProps {
  user: SessionUser
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  queue_checkin: UserPlus,
  pharmacy_ready: Pill,
  pharmacy_dispensed: ShoppingBag,
  lab_completed: TestTube,
  lab_collected: Beaker,
  new_admission: BedDouble,
  patient_discharged: LogOut,
  patient_transferred: ArrowRightLeft,
  invoice_created: Receipt,
}

const TYPE_COLORS: Record<string, string> = {
  queue_checkin: "text-blue-500",
  pharmacy_ready: "text-green-500",
  pharmacy_dispensed: "text-teal-500",
  lab_completed: "text-purple-500",
  lab_collected: "text-orange-500",
  new_admission: "text-orange-500",
  patient_discharged: "text-green-500",
  patient_transferred: "text-blue-500",
  invoice_created: "text-amber-500",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const Icon = TYPE_ICONS[notification.type] || Bell
  const color = TYPE_COLORS[notification.type] || "text-muted-foreground"

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        notification.is_read
          ? "opacity-60 hover:opacity-80"
          : "bg-primary/5 hover:bg-primary/10"
      }`}
      onClick={() => !notification.is_read && onRead(notification.id)}
    >
      <div className={`mt-0.5 shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-medium truncate ${notification.is_read ? "" : "text-foreground"}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
    </motion.div>
  )
}

const TYPE_LABELS: Record<string, string> = {
  queue_checkin: "Check-in",
  pharmacy_ready: "Pharmacy Ready",
  pharmacy_dispensed: "Dispensed",
  lab_completed: "Lab Done",
  lab_collected: "Lab Collected",
  new_admission: "Admission",
  patient_discharged: "Discharged",
  patient_transferred: "Transfer",
  invoice_created: "Invoice",
}

type TabFilter = "all" | "unread"

export function NotificationCenter({ user }: NotificationCenterProps) {
  const { activeTenantId } = useBranch()
  const [tab, setTab] = useState<TabFilter>("all")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    soundEnabled,
    toggleSound,
  } = useNotifications({
    tenantId: activeTenantId,
    role: user.role,
    userId: user.doctorId || user.id,
  })

  // Apply filters
  let filtered = notifications
  if (tab === "unread") {
    filtered = filtered.filter((n) => !n.is_read)
  }
  if (typeFilter) {
    filtered = filtered.filter((n) => n.type === typeFilter)
  }

  // Get unique types present in notifications for the type filter chips
  const presentTypes = [...new Set(notifications.map((n) => n.type))]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl relative group">
          <Bell className="w-4 h-4 transition-transform group-hover:rotate-12" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={toggleSound}
              title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs rounded-lg gap-1"
                onClick={markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Read all
              </Button>
            )}
          </div>
        </div>

        {/* Tab filters: All / Unread */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <button
            onClick={() => setTab("all")}
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
              tab === "all"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            All
          </button>
          <button
            onClick={() => setTab("unread")}
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
              tab === "unread"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>

          {/* Type filter dropdown */}
          {presentTypes.length > 1 && (
            <div className="ml-auto flex items-center gap-1">
              {typeFilter ? (
                <button
                  onClick={() => setTypeFilter(null)}
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-primary/10 text-primary"
                >
                  {TYPE_LABELS[typeFilter] || typeFilter}
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent/40 transition-colors">
                      <Filter className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-40 p-1" sideOffset={4}>
                    {presentTypes.map((type) => {
                      const Icon = TYPE_ICONS[type] || Bell
                      const color = TYPE_COLORS[type] || "text-muted-foreground"
                      return (
                        <button
                          key={type}
                          onClick={() => setTypeFilter(type)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/40 transition-colors text-left"
                        >
                          <Icon className={cn("w-3.5 h-3.5", color)} />
                          {TYPE_LABELS[type] || type}
                        </button>
                      )
                    })}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-72">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <BellOff className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">
                {tab === "unread" ? "No unread notifications" : "No notifications"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {tab === "unread" ? "You&apos;re all caught up" : "Nothing here yet"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
