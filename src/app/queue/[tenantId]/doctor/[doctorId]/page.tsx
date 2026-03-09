"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import type { QueueEntry } from "@/types/database"

export default function DoctorQueuePage() {
  const params = useParams()
  const tenantId = params.tenantId as string
  const doctorId = params.doctorId as string
  const today = getTodayIST()

  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [hospitalName, setHospitalName] = useState("")
  const [doctorName, setDoctorName] = useState("")
  const [doctorStatus, setDoctorStatus] = useState<string>("active")
  const [currentTime, setCurrentTime] = useState("")
  const [flashToken, setFlashToken] = useState<string | null>(null)
  const prevInConsultRef = useRef<string | null>(null)

  // Fetch queue + hospital + doctor name
  useEffect(() => {
    const supabase = createBrowserClient()

    const fetchData = async () => {
      const [queueRes, tenantRes, doctorRes] = await Promise.all([
        supabase
          .from("queue_entries")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("doctor_id", doctorId)
          .eq("date", today)
          .in("status", ["waiting", "in_consultation"])
          .order("priority", { ascending: false })
          .order("queue_number"),
        supabase
          .from("tenants")
          .select("hospital_name")
          .eq("tenant_id", tenantId)
          .single(),
        supabase
          .from("doctors")
          .select("name, status")
          .eq("doctor_id", doctorId)
          .single(),
      ])

      if (doctorRes.data) {
        const doc = doctorRes.data as { name: string; status: string }
        setDoctorName(doc.name)
        setDoctorStatus(doc.status || "active")
      }

      if (queueRes.data) {
        const newEntries = queueRes.data as QueueEntry[]
        setEntries(newEntries)

        // Detect new consultation
        const currentConsult = newEntries.find((e) => e.status === "in_consultation")
        const currentConsultId = currentConsult?.queue_id || null

        if (currentConsultId && currentConsultId !== prevInConsultRef.current) {
          setFlashToken(String(currentConsult!.queue_number))
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
        prevInConsultRef.current = currentConsultId
      }
      if (tenantRes.data) setHospitalName((tenantRes.data as { hospital_name: string }).hospital_name)
    }

    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [tenantId, doctorId, today])

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
      .channel(`doctor-queue-${doctorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `tenant_id=eq.${tenantId}` },
        () => {
          supabase
            .from("queue_entries")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("doctor_id", doctorId)
            .eq("date", today)
            .in("status", ["waiting", "in_consultation"])
            .order("priority", { ascending: false })
            .order("queue_number")
            .then(({ data }) => {
              if (data) {
                const newEntries = data as QueueEntry[]

                const currentConsult = newEntries.find((e) => e.status === "in_consultation")
                const currentConsultId = currentConsult?.queue_id || null

                if (currentConsultId && currentConsultId !== prevInConsultRef.current) {
                  setFlashToken(String(currentConsult!.queue_number))
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
                prevInConsultRef.current = currentConsultId

                setEntries(newEntries)
              }
            })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenantId, doctorId, today])

  const currentPatient = entries.find((e) => e.status === "in_consultation")
  const waiting = entries.filter((e) => e.status === "waiting")
  const nextPatient = waiting[0] || null

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Flash overlay */}
      {flashToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 animate-in fade-in duration-300">
          <div className="text-center animate-in zoom-in-75 duration-500">
            <p className="text-lg font-semibold text-gray-500 mb-6 tracking-widest uppercase">Token Called</p>
            <div className="w-44 h-44 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-xl">
              <span className="text-7xl font-black text-white">{flashToken}</span>
            </div>
            <p className="text-lg text-gray-600 mt-8">Please proceed to the cabin</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">{hospitalName || "Hospital"}</h1>
          <p className="text-base text-slate-200 mt-0.5">{doctorName || "Doctor"}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl lg:text-4xl font-mono font-bold">{currentTime}</p>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
      </div>

      {/* Break banner */}
      {doctorStatus === "on_break" && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-center gap-3">
          <span className="text-2xl">&#9749;</span>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-800">Doctor is on a break</p>
            <p className="text-sm text-amber-600">Queue will resume shortly. Please wait.</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 p-6 lg:p-10 flex flex-col gap-8">

        {/* NOW SERVING — only shown when a patient is being consulted */}
        {currentPatient ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-emerald-600 tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Now Serving
            </p>
            <div className="text-center">
              <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-lg">
                <span className="text-6xl lg:text-7xl font-black text-white">{currentPatient.queue_number}</span>
              </div>
              <p className="text-2xl lg:text-3xl font-bold mt-5">{currentPatient.patient_name}</p>
              <span className="inline-block mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 uppercase tracking-wider">
                In Cabin
              </span>
            </div>
          </div>
        ) : waiting.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-gray-300 mb-2">Welcome</p>
            <p className="text-sm text-gray-400">No patients in queue right now</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-lg font-semibold text-gray-400">Waiting for next consultation</p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* NEXT UP + WAITING */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">

          {/* Next Up */}
          <div className="lg:w-1/3">
            <p className="text-sm font-bold text-blue-600 tracking-widest uppercase mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Next Up
            </p>
            {nextPatient ? (
              <div className={cn(
                "rounded-xl border-2 p-4 flex items-center gap-4",
                nextPatient.priority === 2
                  ? "bg-red-50 border-red-200"
                  : nextPatient.priority === 1
                    ? "bg-amber-50 border-amber-200"
                    : "bg-blue-50 border-blue-200"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black text-white shrink-0",
                  nextPatient.priority === 2
                    ? "bg-red-500"
                    : nextPatient.priority === 1
                      ? "bg-amber-500"
                      : "bg-blue-500"
                )}>
                  {nextPatient.queue_number}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">#1 in queue</p>
                  <p className="text-lg font-bold truncate">{nextPatient.patient_name}</p>
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wider mt-0.5",
                    nextPatient.priority === 2 ? "text-red-600" : nextPatient.priority === 1 ? "text-amber-600" : "text-blue-600"
                  )}>
                    {nextPatient.priority === 2 ? "Emergency" : nextPatient.priority === 1 ? "Urgent" : "Be Ready"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-400">No one waiting</p>
              </div>
            )}
          </div>

          {/* Waiting Queue */}
          <div className="lg:flex-1">
            <p className="text-sm font-bold text-gray-500 tracking-widest uppercase mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              Waiting ({waiting.length})
            </p>
            {waiting.length <= 1 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-400">{waiting.length === 0 ? "Queue is empty" : "No more after next"}</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {waiting.slice(1).map((entry, idx) => (
                  <div
                    key={entry.queue_id}
                    className={cn(
                      "w-16 h-20 rounded-lg flex flex-col items-center justify-center border relative",
                      entry.priority === 2
                        ? "bg-red-50 border-red-300 text-red-700"
                        : entry.priority === 1
                          ? "bg-amber-50 border-amber-300 text-amber-700"
                          : "bg-gray-50 border-gray-200 text-gray-800"
                    )}
                  >
                    <span className="text-[9px] text-gray-400 font-medium">#{idx + 2}</span>
                    <span className="text-xl font-black leading-none">{entry.queue_number}</span>
                    {entry.priority === 2 && (
                      <span className="text-[8px] font-bold text-red-500 mt-0.5">SOS</span>
                    )}
                    {entry.priority === 1 && (
                      <span className="text-[8px] font-bold text-amber-500 mt-0.5">URG</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 text-white px-6 py-2.5 flex items-center justify-between">
        <p className="text-xs text-slate-400">Live updates</p>
        <p className="text-xs text-slate-400">Powered by AI-HOS</p>
      </div>
    </div>
  )
}
