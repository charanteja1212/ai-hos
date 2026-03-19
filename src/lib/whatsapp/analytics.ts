/**
 * WhatsApp bot analytics — tracks events, state transitions, drop-offs.
 * Fire-and-forget: never blocks the main bot flow.
 */

import { createServerClient } from "@/lib/supabase/server"

interface BotEvent {
  tenantId: string
  phone: string
  eventType: "message_received" | "state_transition" | "action_completed" | "error" | "drop_off"
  fromState?: string
  toState?: string
  action?: string
  language?: string
  messageLength?: number
  responseTimeMs?: number
  errorMessage?: string
  metadata?: Record<string, unknown>
}

/**
 * Log a bot analytics event. Fire-and-forget.
 */
export async function logBotEvent(event: BotEvent): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.from("bot_analytics").insert({
      tenant_id: event.tenantId,
      phone: event.phone,
      event_type: event.eventType,
      from_state: event.fromState || null,
      to_state: event.toState || null,
      action: event.action || null,
      language: event.language || "en",
      message_length: event.messageLength || null,
      response_time_ms: event.responseTimeMs || null,
      error_message: event.errorMessage || null,
      metadata: event.metadata || {},
    })
  } catch {
    // Never block bot flow for analytics
  }
}

/**
 * Track a complete message processing cycle.
 */
export async function trackBotMessage(params: {
  tenantId: string
  phone: string
  messageBody: string
  fromState: string
  toState: string
  language: string
  startTime: number
  action?: string
  error?: string
}): Promise<void> {
  const responseTimeMs = Date.now() - params.startTime

  // Log message received
  logBotEvent({
    tenantId: params.tenantId,
    phone: params.phone,
    eventType: "message_received",
    fromState: params.fromState,
    language: params.language,
    messageLength: params.messageBody.length,
  })

  // Log state transition
  if (params.fromState !== params.toState) {
    logBotEvent({
      tenantId: params.tenantId,
      phone: params.phone,
      eventType: "state_transition",
      fromState: params.fromState,
      toState: params.toState,
      language: params.language,
      responseTimeMs,
    })
  }

  // Log action if completed
  if (params.action) {
    logBotEvent({
      tenantId: params.tenantId,
      phone: params.phone,
      eventType: "action_completed",
      action: params.action,
      language: params.language,
      responseTimeMs,
    })
  }

  // Log error if occurred
  if (params.error) {
    logBotEvent({
      tenantId: params.tenantId,
      phone: params.phone,
      eventType: "error",
      fromState: params.fromState,
      errorMessage: params.error,
      language: params.language,
    })
  }
}

/**
 * Track when a user drops off (session expires without completing an action).
 */
export async function trackDropOff(params: {
  tenantId: string
  phone: string
  lastState: string
  language: string
}): Promise<void> {
  logBotEvent({
    tenantId: params.tenantId,
    phone: params.phone,
    eventType: "drop_off",
    fromState: params.lastState,
    language: params.language,
  })
}
