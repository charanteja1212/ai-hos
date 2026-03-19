import { NextResponse } from "next/server"

/**
 * Standardized API response envelope for AI-HOS.
 *
 * Success: { success: true, data: T }
 * Error:   { success: false, error: string, code?: string, details?: unknown }
 *
 * Usage:
 *   return apiSuccess({ patient })
 *   return apiError("Patient not found", 404)
 *   return apiValidationError(zodResult.error)
 */

// ─── Success ───

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true as const, data }, { status })
}

export function apiCreated<T>(data: T) {
  return apiSuccess(data, 201)
}

// ─── Errors ───

export function apiError(
  message: string,
  status = 500,
  code?: string,
  details?: unknown
) {
  const body: { success: false; error: string; code?: string; details?: unknown } = {
    success: false,
    error: message,
  }
  if (code) body.code = code
  if (details) body.details = details
  return NextResponse.json(body, { status })
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError(message, 401, "UNAUTHORIZED")
}

export function apiForbidden(message = "Forbidden") {
  return apiError(message, 403, "FORBIDDEN")
}

export function apiNotFound(message = "Not found") {
  return apiError(message, 404, "NOT_FOUND")
}

export function apiBadRequest(message: string, details?: unknown) {
  return apiError(message, 400, "BAD_REQUEST", details)
}

export function apiConflict(message: string) {
  return apiError(message, 409, "CONFLICT")
}

export function apiRateLimited(message = "Too many requests") {
  return apiError(message, 429, "RATE_LIMITED")
}

// ─── Validation ───

import type { ZodError } from "zod"

export function apiValidationError(zodError: ZodError) {
  const message = zodError.issues[0]?.message || "Validation failed"
  return apiError(message, 400, "VALIDATION_ERROR", zodError.issues)
}
