/**
 * Environment variable validation — fail fast at startup if critical vars are missing.
 * Import this in your root layout or instrumentation file.
 */

import { z } from "zod"

const envSchema = z.object({
  // ─── Database (required) ───
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // ─── Auth (required) ───
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),

  // ─── WhatsApp (optional but warn) ───
  WA_VERIFY_TOKEN: z.string().optional(),
  WA_ACCESS_TOKEN: z.string().optional(),
  WA_API_URL: z.string().optional(),

  // ─── AI (optional) ───
  OPENAI_API_KEY: z.string().optional(),

  // ─── Payment (optional) ───
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // ─── Monitoring (optional) ───
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // ─── Redis (optional) ───
  REDIS_URL: z.string().optional(),

  // ─── App ───
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables at startup.
 * Throws with clear error messages listing ALL missing/invalid vars.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    )

    console.error(
      "\n" +
      "━".repeat(60) + "\n" +
      "  ENVIRONMENT VALIDATION FAILED\n" +
      "━".repeat(60) + "\n" +
      errors.join("\n") + "\n" +
      "━".repeat(60) + "\n"
    )

    // In production, crash immediately. In dev, warn but continue.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing/invalid environment variables:\n${errors.join("\n")}`)
    }
  }

  // Warn about optional but recommended vars
  const warnings: string[] = []
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) warnings.push("NEXT_PUBLIC_SENTRY_DSN not set — error tracking disabled")
  if (!process.env.REDIS_URL) warnings.push("REDIS_URL not set — using in-memory rate limiting")
  if (!process.env.WA_VERIFY_TOKEN) warnings.push("WA_VERIFY_TOKEN not set — WhatsApp webhook disabled")
  if (!process.env.RAZORPAY_KEY_ID) warnings.push("RAZORPAY_KEY_ID not set — payments disabled")

  if (warnings.length > 0) {
    console.warn(
      "\n⚠ Environment warnings:\n" +
      warnings.map(w => `  - ${w}`).join("\n") + "\n"
    )
  }

  return result.success ? result.data : (process.env as unknown as Env)
}
