"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import type { QueueEntry } from "@/types/database"

export default function PublicQueuePage() {
  const params = useParams()
  const tenantId = params.tenantId as string
  const today = getTodayIST()

  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [hospitalName, setHospitalName] = useState("")
  const [currentTime, setCurrentTime] = useState("")
  const [flashToken, setFlashToken] = useState<string | null>(null)
  const prevInConsultRef = useRef<string[]>([])

  // Fetch queue + hospital name
  useEffect(() => {
    const supabase = createBrowserClient()

    const fetchData = async () => {
      const [queueRes, tenantRes] = await Promise.all([
        supabase
          .from("queue_entries")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("date", today)
          .in("status", ["waiting", "in_consultation"])
          .order("priority", { ascending: false })
          .order("queue_number"),
        supabase
          .from("tenants")
          .select("hospital_name")
          .eq("tenant_id", tenantId)
          .single(),
      ])

      if (queueRes.data) {
        const newEntries = queueRes.data as QueueEntry[]
        setEntries(newEntries)

        const newInConsult = newEntries
          .filter((e) => e.status === "in_consultation")
          .map((e) => e.queue_id)

        const justCalled = newInConsult.find(
          (id) => !prevInConsultRef.current.includes(id)
        )
        if (justCalled) {
          const entry = newEntries.find((e) => e.queue_id === justCalled)
          if (entry) {
            setFlashToken(String(entry.queue_number))
            try {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.value = 880
              gain.gain.value = 0.3
              osc.start()
              osc.stop(ctx.currentTime + 0.15)
              setTimeout(() => {
                const osc2 = ctx.createOscillator()
                const gain2 = ctx.createGain()
                osc2.connect(gain2)
                gain2.connect(ctx.destination)
                osc2.frequency.value = 1100
                gain2.gain.value = 0.3
                osc2.start()
                osc2.stop(ctx.currentTime + 0.2)
              }, 200)
            } catch {
              // Audio not available
            }
            setTimeout(() => setFlashToken(null), 5000)
          }
        }
        prevInConsultRef.current = newInConsult
      }
      if (tenantRes.data) setHospitalName((tenantRes.data as { hospital_name: string }).hospital_name)
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [tenantId, today])

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      )
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`public-queue-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `tenant_id=eq.${tenantId}` },
        () => {
          supabase
            .from("queue_entries")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("date", today)
            .in("status", ["waiting", "in_consultation"])
            .order("priority", { ascending: false })
            .order("queue_number")
            .then(({ data }) => {
              if (data) {
                const newEntries = data as QueueEntry[]

                const newInConsult = newEntries
                  .filter((e) => e.status === "in_consultation")
                  .map((e) => e.queue_id)

                const justCalled = newInConsult.find(
                  (id) => !prevInConsultRef.current.includes(id)
                )
                if (justCalled) {
                  const entry = newEntries.find((e) => e.queue_id === justCalled)
                  if (entry) {
                    setFlashToken(String(entry.queue_number))
                    try {
                      const ctx = new AudioContext()
                      const osc = ctx.createOscillator()
                      const gain = ctx.createGain()
                      osc.connect(gain)
                      gain.connect(ctx.destination)
                      osc.frequency.value = 880
                      gain.gain.value = 0.3
                      osc.start()
                      osc.stop(ctx.currentTime + 0.15)
                      setTimeout(() => {
                        const osc2 = ctx.createOscillator()
                        const gain2 = ctx.createGain()
                        osc2.connect(gain2)
                        gain2.connect(ctx.destination)
                        osc2.frequency.value = 1100
                        gain2.gain.value = 0.3
                        osc2.start()
                        osc2.stop(ctx.currentTime + 0.2)
                      }, 200)
                    } catch {
                      // Audio not available
                    }
                    setTimeout(() => setFlashToken(null), 5000)
                  }
                }
                prevInConsultRef.current = newInConsult

                setEntries(newEntries)
              }
            })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenantId, today])

  const waiting = entries.filter((e) => e.status === "waiting")
  const inConsultation = entries.filter((e) => e.status === "in_consultation")

  // Group waiting by doctor
  const doctorGroups = new Map<string, QueueEntry[]>()
  waiting.forEach((e) => {
    const key = e.doctor_name || "Unknown"
    if (!doctorGroups.has(key)) doctorGroups.set(key, [])
    doctorGroups.get(key)!.push(e)
  })

  // Next-up patients (first waiting per doctor)
  const nextUpPatients: QueueEntry[] = []
  doctorGroups.forEach((patients) => {
    if (patients.length > 0) nextUpPatients.push(patients[0])
  })

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500 text-lg">Invalid queue URL. Please check with the hospital reception.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      {/* Flash overlay */}
      {flashToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 animate-in fade-in duration-300">
          <div className="text-center animate-in zoom-in-75 duration-500">
            <p className="text-lg font-semibold text-gray-500 mb-6 tracking-widest uppercase">Token Called</p>
            <div className="w-44 h-44 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-xl">
              <span className="text-7xl font-black text-white">{flashToken}</span>
            </div>
            <p className="text-lg text-gray-600 mt-8">Please proceed to the doctor&apos;s cabin</p>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">{hospitalName || "Hospital"}</h1>
          <p className="text-sm text-slate-300 mt-0.5">OPD Token Display</p>
        </div>
        <div className="text-right">
          <p className="text-3xl lg:text-4xl font-mono font-bold">{currentTime}</p>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
      </div>

      <div className="p-5 lg:p-8 pb-16">
        {/* Two-column layout: Left = Now Serving + Next, Right = Waiting */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">

          {/* LEFT COLUMN — Now Serving + Next Up */}
          <div className="space-y-5">

            {/* NOW SERVING — only shown when someone is actively being consulted */}
            {inConsultation.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-sm font-bold text-emerald-600 tracking-widest uppercase">Now Serving</h2>
                </div>
                <div className="space-y-3">
                  {inConsultation.map((entry) => (
                    <div
                      key={entry.queue_id}
                      className="rounded-xl bg-emerald-50 border-2 border-emerald-200 p-5 flex items-center gap-5"
                    >
                      <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-4xl font-black text-white shrink-0 shadow-md">
                        {entry.queue_number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xl font-bold truncate">{entry.patient_name}</p>
                        <p className="text-sm text-emerald-700 mt-1 truncate">{entry.doctor_name}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 rounded-full px-3 py-1 uppercase tracking-wider shrink-0">
                        In Cabin
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Idle state — when no one is being served and no one is waiting */}
            {inConsultation.length === 0 && waiting.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                <p className="text-2xl font-bold text-gray-300 mb-2">Welcome</p>
                <p className="text-sm text-gray-400">No patients in queue right now</p>
              </div>
            )}

            {/* NEXT UP */}
            {nextUpPatients.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h2 className="text-sm font-bold text-blue-600 tracking-widest uppercase">Next Up</h2>
                </div>
                <div className="space-y-3">
                  {nextUpPatients.map((entry) => (
                    <div
                      key={entry.queue_id}
                      className={cn(
                        "rounded-xl border-2 p-4 flex items-center gap-4",
                        entry.priority === 2
                          ? "bg-red-50 border-red-200"
                          : entry.priority === 1
                            ? "bg-amber-50 border-amber-200"
                            : "bg-blue-50 border-blue-200"
                      )}
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black text-white shrink-0 shadow",
                        entry.priority === 2
                          ? "bg-red-500"
                          : entry.priority === 1
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      )}>
                        {entry.queue_number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold truncate">{entry.patient_name}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{entry.doctor_name}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold rounded-full px-2.5 py-1 uppercase tracking-wider shrink-0",
                        entry.priority === 2
                          ? "text-red-700 bg-red-100"
                          : entry.priority === 1
                            ? "text-amber-700 bg-amber-100"
                            : "text-blue-700 bg-blue-100"
                      )}>
                        {entry.priority === 2 ? "Emergency" : entry.priority === 1 ? "Urgent" : "Be Ready"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — Waiting Queue */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <h2 className="text-sm font-bold text-gray-500 tracking-widest uppercase">
                Waiting ({waiting.length})
              </h2>
            </div>

            {waiting.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="text-lg text-gray-400">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(doctorGroups.entries()).map(([doctorName, patients]) => {
                  const remaining = patients.slice(1)
                  return (
                    <div key={doctorName}>
                      <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                        {doctorName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {remaining.length === 0 ? (
                          <p className="text-xs text-gray-300 italic">Next patient shown on left</p>
                        ) : (
                          remaining.map((entry) => (
                            <div
                              key={entry.queue_id}
                              className={cn(
                                "w-16 h-16 rounded-lg flex flex-col items-center justify-center border",
                                entry.priority === 2
                                  ? "bg-red-50 border-red-300 text-red-700"
                                  : entry.priority === 1
                                    ? "bg-amber-50 border-amber-300 text-amber-700"
                                    : "bg-gray-50 border-gray-200 text-gray-800"
                              )}
                            >
                              <span className="text-xl font-black leading-none">{entry.queue_number}</span>
                              {entry.priority === 2 && (
                                <span className="text-[8px] font-bold text-red-500 mt-0.5">SOS</span>
                              )}
                              {entry.priority === 1 && (
                                <span className="text-[8px] font-bold text-amber-500 mt-0.5">URG</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 text-white px-6 py-2.5 flex items-center justify-between">
        <p className="text-xs text-slate-400">Live updates</p>
        <p className="text-xs text-slate-400">Powered by AI-HOS</p>
      </div>
    </div>
  )
}
