/**
 * Telemedicine utilities for Jitsi Meet video consultations
 */

/**
 * Generate a unique Jitsi room name for a consultation
 * Format: aihos-{tenantId}-{appointmentId}-{random}
 */
export function generateRoomName(tenantId: string, appointmentId: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  return `aihos-${tenantId.substring(0, 8)}-${appointmentId.substring(0, 8)}-${random}`
}

/**
 * Get the Jitsi Meet URL for a room
 */
export function getJitsiUrl(roomName: string, displayName?: string): string {
  const params = new URLSearchParams()
  if (displayName) params.set("userInfo.displayName", displayName)
  params.set("config.prejoinPageEnabled", "false")
  params.set("config.startWithAudioMuted", "false")
  params.set("config.startWithVideoMuted", "false")
  const query = params.toString()
  return `https://meet.jit.si/${roomName}${query ? "#" + query : ""}`
}
