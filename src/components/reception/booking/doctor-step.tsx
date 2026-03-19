"use client"

import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Stethoscope,
  ChevronRight,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Doctor } from "@/types/database"
import type { DoctorStepProps } from "./types"

export function DoctorStep({
  patient,
  patientFound,
  doctors,
  doctorSearch,
  loading,
  onDoctorSearchChange,
  onSelectDoctor,
}: DoctorStepProps) {
  const specialties = [...new Set(doctors.map((d) => d.specialty))]
  const filteredDoctors = doctorSearch
    ? doctors.filter((d) => d.name.toLowerCase().includes(doctorSearch.toLowerCase()) || d.specialty.toLowerCase().includes(doctorSearch.toLowerCase()))
    : doctors

  return (
    <motion.div
      key="doctor"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-4"
    >
      {/* Patient summary */}
      {patient && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-700 text-xs font-bold shrink-0">
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{patient.name}</p>
            <p className="text-[10px] text-gray-400 font-mono">{patient.phone}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] font-medium bg-gray-100 text-gray-500">
            {patientFound ? "Existing" : "New"}
          </Badge>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-900">Select Doctor</p>
        <p className="text-xs text-gray-400 mt-0.5">{doctors.length} doctors available</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        <Input
          className="h-10 pl-9 text-sm rounded-xl border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 bg-gray-50/50"
          placeholder="Search doctor or specialty..."
          aria-label="Search doctors by name or specialty"
          value={doctorSearch}
          onChange={(e) => onDoctorSearchChange(e.target.value)}
        />
      </div>

      {/* Doctor list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto -mx-1 px-1">
        {(doctorSearch ? [{ specialty: "Results", doctors: filteredDoctors }] : specialties.map(s => ({ specialty: s, doctors: doctors.filter(d => d.specialty === s) }))).map(({ specialty, doctors: specDoctors }) => (
          <div key={specialty}>
            {!doctorSearch && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-3 first:mt-0">{specialty}</p>
            )}
            {specDoctors.map((doctor, di) => (
              <motion.button
                key={doctor.doctor_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: di * 0.03 }}
                onClick={() => onSelectDoctor(doctor)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:bg-cyan-50/50 hover:border-cyan-100 transition-all text-left group mb-1"
              >
                {(doctor as Doctor & { image_url?: string }).image_url ? (
                  <img
                    src={(doctor as Doctor & { image_url?: string }).image_url!}
                    alt={doctor.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-cyan-800 transition-colors">{doctor.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{doctor.specialty}</span>
                    {(doctor as Doctor & { consultation_fee?: number }).consultation_fee && (
                      <span className="text-xs text-gray-300 font-mono">
                        ₹{(doctor as Doctor & { consultation_fee?: number }).consultation_fee}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-cyan-400 transition-colors shrink-0" />
              </motion.button>
            ))}
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2 text-cyan-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Loading availability...</span>
        </div>
      )}
    </motion.div>
  )
}
