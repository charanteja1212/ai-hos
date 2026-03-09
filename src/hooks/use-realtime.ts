"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeOptions {
  table: string
  schema?: string
  event?: "INSERT" | "UPDATE" | "DELETE" | "*"
  filter?: string
  onInsert?: (payload: Record<string, unknown>) => void
  onUpdate?: (payload: Record<string, unknown>) => void
  onDelete?: (payload: Record<string, unknown>) => void
  onChange?: (payload: Record<string, unknown>, eventType: string) => void
  enabled?: boolean
}

export function useRealtime({
  table,
  schema = "public",
  event = "*",
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Store callbacks in refs to avoid channel teardown/recreation on every render
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onChangeRef = useRef(onChange)

  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return

    const supabase = createBrowserClient()
    const channelName = `realtime-${table}-${filter || "all"}-${Math.random().toString(36).slice(2, 8)}`

    const channelConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    }
    if (filter) {
      channelConfig.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        channelConfig as never,
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const data = payload.new || payload.old
          if (payload.eventType === "INSERT" && onInsertRef.current) onInsertRef.current(data)
          if (payload.eventType === "UPDATE" && onUpdateRef.current) onUpdateRef.current(data)
          if (payload.eventType === "DELETE" && onDeleteRef.current) onDeleteRef.current(payload.old)
          if (onChangeRef.current) onChangeRef.current(data, payload.eventType)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  // Only recreate channel when these stable values change, NOT callbacks
  }, [table, schema, event, filter, enabled])

  return channelRef.current
}
