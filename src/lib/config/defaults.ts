/**
 * Application-wide default values.
 * These can be overridden per-tenant via client_configs or tenant settings.
 * Centralised here to eliminate magic numbers scattered across routes.
 */

/** OP Pass validity in days after issue */
export const OP_PASS_VALIDITY_DAYS = 15

/** OTP length for patient authentication */
export const OTP_LENGTH = 6

/** OTP expiry in minutes */
export const OTP_EXPIRY_MINUTES = 5

/** ABDM consent validity in days */
export const ABDM_CONSENT_EXPIRY_DAYS = 30

/** Maximum file upload size in bytes (2 MB) */
export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024

/** Feedback request delay after consultation (ms) — 30 minutes */
export const FEEDBACK_DELAY_MS = 30 * 60 * 1000

/** Follow-up reminder time — 9 AM IST = 3:30 UTC (hours, minutes) */
export const FOLLOWUP_REMINDER_UTC = { hours: 3, minutes: 30 }

/** Default hospital name fallback */
export const DEFAULT_HOSPITAL_NAME = "Hospital"
