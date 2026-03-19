"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  Stethoscope,
  User,
} from "lucide-react"
import { formatDate, formatTime } from "@/lib/utils/date"
import type { ConfirmStepProps } from "./types"

export function ConfirmStep({
  selectedDoctor,
  patient,
  selectedDate,
  selectedTime,
  loading,
  onConfirm,
}: ConfirmStepProps) {
  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-5"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">Review Appointment</p>
        <p className="text-xs text-gray-400 mt-0.5">Confirm the details below</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
        {/* Doctor */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-cyan-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{selectedDoctor?.name}</p>
            <p className="text-xs text-gray-400">{selectedDoctor?.specialty}</p>
          </div>
        </div>

        {/* Patient */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{patient?.name}</p>
            <p className="text-xs text-gray-400 font-mono">{patient?.phone}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Date</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(selectedDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Time</p>
              <p className="text-sm font-semibold text-gray-900">{formatTime(selectedTime)}</p>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={onConfirm}
        disabled={loading}
        className="w-full h-12 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Confirm & Assign Queue</>
        )}
      </Button>
    </motion.div>
  )
}
