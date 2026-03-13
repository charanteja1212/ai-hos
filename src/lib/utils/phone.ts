/**
 * Normalize Indian phone numbers to consistent 10-digit format.
 * Strips all non-digits, removes leading "91" country code if present.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // If 12 digits starting with 91, strip country code
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2)
  }
  // If already 10 digits, return as-is
  if (digits.length === 10) {
    return digits
  }
  // Fallback: return digits as-is
  return digits
}

/**
 * Get all possible phone variants for DB lookups.
 * Returns [10-digit, 91+10-digit] for flexible matching.
 */
export function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (normalized.length === 10) {
    return [normalized, `91${normalized}`]
  }
  return [normalized]
}
