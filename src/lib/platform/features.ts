/**
 * Feature Flags — Config-driven tier system
 *
 * One codebase. Three configs. Upgrade = update client_configs row.
 */

export type Tier = "basic" | "medium" | "enterprise"

export interface TierFeatures {
  whatsapp_bot: boolean
  multi_language: boolean
  lab_module: boolean
  pharmacy_module: boolean
  ipd_module: boolean
  multi_branch: boolean
  gpt4_clinical: boolean
  whisper_voice_rx: boolean
  predictive_noshow: boolean
  revenue_leak_detector: boolean
  telemedicine: boolean
  abdm_integration: boolean
  iot_gateway: boolean
  white_label: boolean
  ai_agents: boolean
}

export interface TierLimits {
  max_doctors: number
  max_branches: number
  max_staff: number
  max_patients: number
  max_appointments_per_day: number
}

// ─── Tier Presets ─────────────────────────────────────────────────────────────

export const TIER_FEATURES: Record<Tier, TierFeatures> = {
  basic: {
    whatsapp_bot: true,
    multi_language: false,
    lab_module: false,
    pharmacy_module: false,
    ipd_module: false,
    multi_branch: false,
    gpt4_clinical: false,
    whisper_voice_rx: false,
    predictive_noshow: false,
    revenue_leak_detector: false,
    telemedicine: false,
    abdm_integration: false,
    iot_gateway: false,
    white_label: false,
    ai_agents: false,
  },
  medium: {
    whatsapp_bot: true,
    multi_language: true,
    lab_module: true,
    pharmacy_module: true,
    ipd_module: false,
    multi_branch: true,
    gpt4_clinical: true,
    whisper_voice_rx: true,
    predictive_noshow: true,
    revenue_leak_detector: true,
    telemedicine: true,
    abdm_integration: false,
    iot_gateway: false,
    white_label: false,
    ai_agents: true,
  },
  enterprise: {
    whatsapp_bot: true,
    multi_language: true,
    lab_module: true,
    pharmacy_module: true,
    ipd_module: true,
    multi_branch: true,
    gpt4_clinical: true,
    whisper_voice_rx: true,
    predictive_noshow: true,
    revenue_leak_detector: true,
    telemedicine: true,
    abdm_integration: true,
    iot_gateway: true,
    white_label: true,
    ai_agents: true,
  },
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  basic: {
    max_doctors: 3,
    max_branches: 1,
    max_staff: 5,
    max_patients: 500,
    max_appointments_per_day: 50,
  },
  medium: {
    max_doctors: 15,
    max_branches: 2,
    max_staff: 30,
    max_patients: 10000,
    max_appointments_per_day: 200,
  },
  enterprise: {
    max_doctors: 999,
    max_branches: 999,
    max_staff: 999,
    max_patients: 999999,
    max_appointments_per_day: 9999,
  },
}

// ─── Feature Check Functions ──────────────────────────────────────────────────

/** Check if a specific feature is enabled for a client */
export function isFeatureEnabled(
  features: Partial<TierFeatures> | null,
  feature: keyof TierFeatures,
  fallbackTier: Tier = "basic"
): boolean {
  if (features && feature in features) {
    return !!features[feature]
  }
  return TIER_FEATURES[fallbackTier][feature]
}

/** Get effective limits for a client */
export function getEffectiveLimits(
  limits: Partial<TierLimits> | null,
  fallbackTier: Tier = "basic"
): TierLimits {
  const defaults = TIER_LIMITS[fallbackTier]
  if (!limits) return defaults
  return {
    max_doctors: limits.max_doctors ?? defaults.max_doctors,
    max_branches: limits.max_branches ?? defaults.max_branches,
    max_staff: limits.max_staff ?? defaults.max_staff,
    max_patients: limits.max_patients ?? defaults.max_patients,
    max_appointments_per_day: limits.max_appointments_per_day ?? defaults.max_appointments_per_day,
  }
}

/** Get user-facing tier display info */
export function getTierInfo(tier: Tier) {
  const info = {
    basic: {
      name: "Basic",
      price: "1,500-2,500",
      description: "Solo Doctor / Small Clinic",
      color: "green",
    },
    medium: {
      name: "Medium",
      price: "8,000-15,000",
      description: "Small Hospital / Multi-Doctor",
      color: "blue",
    },
    enterprise: {
      name: "Enterprise",
      price: "20,000-80,000",
      description: "Multi-Specialty / Multi-Branch",
      color: "purple",
    },
  }
  return info[tier]
}
