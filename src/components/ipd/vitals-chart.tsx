"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LazyLineChart as LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "@/components/ui/lazy-recharts"
import dynamic from "next/dynamic"
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false })
import { Activity } from "lucide-react"
import type { NursingNote } from "@/types/database"

interface VitalsChartProps {
  notes: NursingNote[]
}

interface VitalDataPoint {
  time: string
  systolic?: number
  diastolic?: number
  pulse?: number
  temp?: number
  spo2?: number
  rr?: number
}

export function VitalsChart({ notes }: VitalsChartProps) {
  const chartData = useMemo(() => {
    // Extract vitals from nursing notes (type "vitals")
    const vitalNotes = notes
      .filter(n => n.type === "vitals" && n.vitals)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return vitalNotes.map(n => {
      const v = n.vitals!
      const point: VitalDataPoint = {
        time: new Date(n.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }),
      }
      if (v.bp_systolic) point.systolic = v.bp_systolic
      if (v.bp_diastolic) point.diastolic = v.bp_diastolic
      if (v.pulse) point.pulse = Number(v.pulse)
      if (v.temperature) point.temp = Number(v.temperature)
      if (v.spo2) point.spo2 = Number(v.spo2)
      if (v.respiratory_rate) point.rr = Number(v.respiratory_rate)
      return point
    })
  }, [notes])

  if (chartData.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Activity className="w-6 h-6 mx-auto mb-2 opacity-50" />
          Need at least 2 vitals readings to show trends
        </CardContent>
      </Card>
    )
  }

  const hasBP = chartData.some(d => d.systolic)
  const hasPulse = chartData.some(d => d.pulse)
  const hasTemp = chartData.some(d => d.temp)
  const hasSpo2 = chartData.some(d => d.spo2)

  return (
    <div className="space-y-4">
      {/* BP & Pulse */}
      {(hasBP || hasPulse) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Blood Pressure & Pulse</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <RechartsTooltip />
                <Legend />
                {hasBP && <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                {hasBP && <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                {hasPulse && <Line type="monotone" dataKey="pulse" name="Pulse" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* SpO2 & Temperature */}
      {(hasSpo2 || hasTemp) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SpO2 & Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <RechartsTooltip />
                <Legend />
                {hasSpo2 && <Line type="monotone" dataKey="spo2" name="SpO2 %" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                {hasTemp && <Line type="monotone" dataKey="temp" name="Temp °F" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
