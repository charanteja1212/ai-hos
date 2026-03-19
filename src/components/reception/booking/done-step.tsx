"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react"
import { formatDate, formatTime } from "@/lib/utils/date"
import type { DoneStepProps } from "./types"

export function DoneStep({
  bookingId,
  patient,
  selectedDoctor,
  selectedDate,
  selectedTime,
  waSent,
  tenant,
  onReset,
}: DoneStepProps) {
  return (
    <motion.div
      key="done"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="p-6 text-center space-y-5"
      role="status"
      aria-live="polite"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto"
      >
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </motion.div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Appointment Booked</h2>
        <p className="text-xs text-gray-400 mt-1">Queue assigned automatically</p>
      </div>

      {/* Booking summary */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Booking ID</span>
          <span className="text-xs font-mono font-semibold text-cyan-700">{bookingId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Patient</span>
          <span className="text-xs font-semibold text-gray-700">{patient?.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Doctor</span>
          <span className="text-xs font-semibold text-gray-700">{selectedDoctor?.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Schedule</span>
          <span className="text-xs font-semibold text-gray-700">{formatDate(selectedDate)} · {formatTime(selectedTime)}</span>
        </div>
      </div>

      {/* WhatsApp status */}
      {waSent === true && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-left"
        >
          <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">WhatsApp confirmation sent</p>
        </motion.div>
      )}
      {waSent === false && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-left space-y-2"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">WhatsApp not delivered</p>
          </div>
          <a
            href={`https://wa.me/${tenant?.whatsapp_phone_number || "918125442376"}?text=${encodeURIComponent(`Hi, I just booked appointment ${bookingId}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            Open WhatsApp
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </motion.div>
      )}

      <Button
        onClick={onReset}
        className="w-full h-12 rounded-xl text-sm font-semibold bg-cyan-700 hover:bg-cyan-800 text-white transition-colors gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Book Another
      </Button>
    </motion.div>
  )
}
