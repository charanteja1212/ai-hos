"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRealtime } from "./use-realtime"
import { toast } from "sonner"
import type { Notification } from "@/types/database"



/** Show a browser notification via service worker (when tab is not focused) */
function showBrowserNotification(title: string, body: string) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    document.hasFocus()
  ) return

  navigator.serviceWorker?.ready?.then((reg) => {
    reg.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon.svg",
      tag: "notif-" + Date.now(),
    } as NotificationOptions)
  }).catch(() => {})
}

/** Request browser notification permission (called once) */
function requestBrowserPermission() {
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission().catch(() => {})
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = "sine"
    gain.gain.value = 0.15
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => ctx.close(), 500)
  } catch {
    // Audio not supported or blocked
  }
}

interface UseNotificationsOptions {
  tenantId: string
  role: string
  userId?: string
}

export function useNotifications({ tenantId, role, userId }: UseNotificationsOptions) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("notification_sound") !== "off"
  })
  const isInitialLoad = useRef(true)

  const { data, isLoading, mutate } = useSWR(
    tenantId ? `notifications-${tenantId}-${role}-${userId || "all"}` : null,
    async () => {
      const supabase = createBrowserClient()
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const query = supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("target_role", role)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50)

      const { data, error: queryError } = await query
      if (queryError) throw queryError
      let notifications = (data || []) as Notification[]

      // For doctors, also include notifications specifically for them
      if (userId) {
        const { data: userSpecific, error: userError } = await supabase
          .from("notifications")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("target_user_id", userId)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(50)

        if (userError) throw userError
        if (userSpecific) {
          const ids = new Set(notifications.map((n) => n.id))
          const extra = (userSpecific as Notification[]).filter((n) => !ids.has(n.id))
          notifications = [...notifications, ...extra].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 50)
        }
      }

      return notifications
    },
    { refreshInterval: 30000 }
  )

  const notifications = data || []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Realtime subscription for new notifications
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  const handleInsert = useCallback(
    (payload: Record<string, unknown>) => {
      const n = payload as unknown as Notification
      // Only show toast if notification is for this role/user
      if (n.tenant_id !== tenantId) return
      if (n.target_role !== role && n.target_user_id !== userId) return

      // Show toast
      toast.info(n.title, { description: n.message, duration: 5000 })

      // Play sound
      if (soundEnabledRef.current) {
        playBeep()
      }

      // Browser notification (when tab not focused)
      showBrowserNotification(n.title, n.message || "")

      // Refresh list
      mutate()
    },
    [tenantId, role, userId, mutate]
  )

  useRealtime({
    table: "notifications",
    event: "INSERT",
    filter: `tenant_id=eq.${tenantId}`,
    onInsert: handleInsert,
    enabled: !!tenantId,
  })

  // Mark initial load complete + request browser notification permission
  useEffect(() => {
    if (data && isInitialLoad.current) {
      isInitialLoad.current = false
      requestBrowserPermission()
    }
  }, [data])

  const markAsRead = useCallback(
    async (id: string) => {
      const supabase = createBrowserClient()
      const { error: updateError } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)
      if (updateError) throw updateError
      mutate()
    },
    [mutate]
  )

  const markAllRead = useCallback(async () => {
    const supabase = createBrowserClient()
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("target_role", role)
      .eq("is_read", false)
      .gte("created_at", cutoff)
    if (updateError) throw updateError
    mutate()
  }, [tenantId, role, mutate])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem("notification_sound", next ? "on" : "off")
      return next
    })
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    soundEnabled,
    toggleSound,
  }
}
