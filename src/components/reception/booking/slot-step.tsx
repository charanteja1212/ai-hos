"use client"

import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Clock,
  Stethoscope,
  Sun,
  Sunset,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatTime, getTodayIST } from "@/lib/utils/date"
import type { SlotStepProps } from "./types"

function getHour(t: string) {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return parseInt(t.split(":")[0]) || 0
  let h = parseInt(match[1])
  const period = match[3]?.toUpperCase()
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return h
}

export function SlotStep({
  selectedDoctor,
  availability,
  selectedDate,
  timeSlots,
  selectedTime,
  loading,
  onSelectDate,
  onSelectTime,
  onChangeDate,
}: SlotStepProps) {
  return (
    <motion.div
      key="slot"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-5"
    >
      {/* Doctor summary */}
      {selectedDoctor && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedDoctor.name}</p>
            <p className="text-xs text-gray-400">{selectedDoctor.specialty}</p>
          </div>
        </div>
      )}

      {/* Date strip */}
      {!selectedDate && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3">Pick a date</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {availability.map((slot, i) => {
              const isToday = slot.date === getTodayIST()
              const hasSlots = slot.availableSlots > 0
              const d = new Date(slot.date + "T00:00:00")
              return (
                <motion.button
                  key={slot.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onSelectDate(slot.date)}
                  disabled={!hasSlots || loading}
                  className={cn(
                    "flex flex-col items-center min-w-[68px] py-3 px-3 rounded-xl border transition-all",
                    !hasSlots
                      ? "border-gray-100 opacity-30 cursor-not-allowed"
                      : "border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50",
                    isToday && hasSlots && "border-cyan-300 bg-cyan-50/50"
                  )}
                >
                  <span className="text-[10px] font-medium text-gray-400 uppercase">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}
                  </span>
                  <span className="text-xl font-bold text-gray-900 mt-0.5 leading-none">{d.getDate()}</span>
                  <span className="text-[10px] text-gray-300 mt-0.5">
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}
                  </span>
                  <div className={cn(
                    "mt-2 text-[9px] font-semibold px-2 py-0.5 rounded-full",
                    slot.availableSlots > 10
                      ? "bg-emerald-50 text-emerald-600"
                      : slot.availableSlots > 3
                        ? "bg-amber-50 text-amber-600"
                        : "bg-red-50 text-red-500"
                  )}>
                    {slot.availableSlots}
                  </div>
                  {isToday && <span className="text-[8px] font-bold text-cyan-600 mt-0.5">TODAY</span>}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time slots */}
      {selectedDate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">{formatDate(selectedDate)}</p>
            <button
              onClick={onChangeDate}
              className="text-xs text-cyan-600 font-medium hover:underline"
            >
              Change
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : (() => {
            const available = timeSlots.filter((s) => s.status === "available")
            if (available.length === 0) {
              return (
                <div className="text-center py-10">
                  <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No slots available</p>
                  <p className="text-xs text-gray-300 mt-1">Try another date</p>
                </div>
              )
            }
            const morning = available.filter((s) => getHour(s.time) < 12)
            const afternoon = available.filter((s) => { const h = getHour(s.time); return h >= 12 && h < 17 })
            const evening = available.filter((s) => getHour(s.time) >= 17)
            const groups = [
              { label: "Morning", slots: morning, Icon: Sun, accent: "text-amber-500", bg: "bg-amber-50" },
              { label: "Afternoon", slots: afternoon, Icon: Sunset, accent: "text-orange-500", bg: "bg-orange-50" },
              { label: "Evening", slots: evening, Icon: Moon, accent: "text-indigo-500", bg: "bg-indigo-50" },
            ].filter((g) => g.slots.length > 0)

            return (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-2">
                      <group.Icon className={cn("w-3.5 h-3.5", group.accent)} />
                      <span className="text-xs font-medium text-gray-500">{group.label}</span>
                      <span className="text-[10px] text-gray-300 ml-auto">{group.slots.length} slots</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {group.slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => onSelectTime(slot.time)}
                          className={cn(
                            "py-2.5 px-2 rounded-lg text-sm font-medium border transition-all",
                            selectedTime === slot.time
                              ? "border-cyan-600 bg-cyan-600 text-white"
                              : "border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 text-gray-700"
                          )}
                        >
                          {formatTime(slot.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </motion.div>
  )
}
