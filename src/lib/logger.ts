/**
 * Structured logger — Pino-based with tenant context.
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   logger.info({ tenantId, phone }, "Appointment booked")
 *   logger.error({ tenantId, err }, "Booking failed")
 */

import pino from "pino"

const isProduction = process.env.NODE_ENV === "production"

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // In production: JSON for log aggregation (Datadog, Grafana, etc.)
  // In dev: pretty-print for readability
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),

  // Default fields on every log line
  base: {
    env: process.env.NODE_ENV || "development",
    service: "ai-hos",
  },

  // Redact sensitive fields from logs
  redact: {
    paths: [
      "password",
      "otp",
      "token",
      "wa_token",
      "openai_api_key",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
})

/**
 * Create a child logger with tenant context.
 * Use this in API routes and services for tenant-tagged logs.
 */
export function createTenantLogger(tenantId: string, extra?: Record<string, unknown>) {
  return logger.child({ tenantId, ...extra })
}

/**
 * Create a child logger for API route context.
 */
export function createRouteLogger(route: string, extra?: Record<string, unknown>) {
  return logger.child({ route, ...extra })
}
