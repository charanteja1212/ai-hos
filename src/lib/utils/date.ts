import { format, parseISO } from "date-fns"
import { toZonedTime } from "date-fns-tz"

const IST = "Asia/Kolkata"

export function getISTNow(): Date {
  return toZonedTime(new Date(), IST)
}

export function getTodayIST(): string {
  return format(getISTNow(), "yyyy-MM-dd")
}

export function formatDate(date: string): string {
  return format(parseISO(date), "dd MMM yyyy")
}

export function formatTime(time: string): string {
  // If already in 12h format (e.g. "10:30 AM"), return as-is
  if (/[AP]M$/i.test(time.trim())) return time.trim()
  // Handle "HH:mm" or "HH:mm:ss" format
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "PM" : "AM"
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function formatDateTime(date: string, time: string): string {
  return `${formatDate(date)} at ${formatTime(time)}`
}
