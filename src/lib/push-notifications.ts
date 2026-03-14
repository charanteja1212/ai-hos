/**
 * Push Notification Utilities
 *
 * VAPID keys must be generated once and stored in env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — client-side subscription
 *   VAPID_PRIVATE_KEY — server-side sending
 *
 * Generate with: npx web-push generate-vapid-keys
 */

/**
 * Check if push notifications are supported and permitted
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/**
 * Request notification permission from the user
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied"
  return Notification.requestPermission()
}

/**
 * Subscribe to push notifications and return the subscription object.
 * Sends the subscription to the server for storage.
 */
export async function subscribeToPush(userId: string, tenantId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  const permission = await requestPermission()
  if (permission !== "granted") return null

  const registration = await navigator.serviceWorker.ready
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set")
    return null
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    })

    // Send subscription to server
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), userId, tenantId }),
    })

    return subscription
  } catch (err) {
    console.error("[push] Subscription failed:", err)
    return null
  }
}

/**
 * Show a local notification (when app is in foreground)
 */
export async function showLocalNotification(title: string, body: string, url?: string) {
  if (!isPushSupported() || Notification.permission !== "granted") return

  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(title, {
    body,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    data: { url: url || "/" },
  } as NotificationOptions)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
