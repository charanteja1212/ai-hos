"use client"

import { cn } from "@/lib/utils"

interface VitalRange {
  normal: [number, number]
  warning: [number, number]
  // Anything outside warning is danger
}

const VITAL_RANGES: Record<string, VitalRange> = {
  pulse: { normal: [60, 100], warning: [50, 110] },
  temp: { normal: [97, 99], warning: [96, 100.4] },
  spo2: { normal: [95, 100], warning: [90, 100] },
}

function parseBPValue(value: string): { systolic: number; diastolic: number } | null {
  const parts = value.split("/")
  if (parts.length !== 2) return null
  const systolic = parseFloat(parts[0])
  const diastolic = parseFloat(parts[1])
  if (isNaN(systolic) || isNaN(diastolic)) return null
  return { systolic, diastolic }
}

function getBPStatus(value: string): "normal" | "warning" | "danger" | null {
  const bp = parseBPValue(value)
  if (!bp) return null
  const { systolic, diastolic } = bp
  // Normal: <120/<80
  if (systolic < 120 && diastolic < 80) return "normal"
  // Elevated/Stage 1: 120-139 or 80-89
  if (systolic <= 139 || diastolic <= 89) return "warning"
  // Stage 2+: >=140 or >=90
  return "danger"
}

function getNumericStatus(key: string, value: string): "normal" | "warning" | "danger" | null {
  const num = parseFloat(value)
  if (isNaN(num)) return null
  const range = VITAL_RANGES[key]
  if (!range) return null

  if (num >= range.normal[0] && num <= range.normal[1]) return "normal"
  if (num >= range.warning[0] && num <= range.warning[1]) return "warning"
  return "danger"
}

export function getVitalStatus(key: string, value: string | undefined): "normal" | "warning" | "danger" | null {
  if (!value || value.trim() === "") return null
  if (key === "bp") return getBPStatus(value)
  if (key === "weight") return null // No range for weight
  return getNumericStatus(key, value)
}

export function getVitalRingClass(status: "normal" | "warning" | "danger" | null): string {
  if (!status) return ""
  return cn(
    "ring-2",
    status === "normal" && "ring-green-400/50",
    status === "warning" && "ring-amber-400/50",
    status === "danger" && "ring-red-400/50 animate-pulse"
  )
}

export function getVitalDotClass(status: "normal" | "warning" | "danger" | null): string {
  if (!status) return "bg-transparent"
  if (status === "normal") return "bg-green-500"
  if (status === "warning") return "bg-amber-500"
  return "bg-red-500 animate-pulse"
}
