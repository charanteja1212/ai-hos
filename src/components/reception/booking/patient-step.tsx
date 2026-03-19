"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  ChevronRight,
  Phone,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatientStepProps } from "./types"

export function PatientStep({
  phone,
  patientName,
  patientGender,
  patientAge,
  lookingUp,
  patientFound,
  patient,
  familyMembers,
  canProceedPatient,
  loading,
  tenantId,
  onPhoneChange,
  onPatientNameChange,
  onPatientGenderChange,
  onPatientAgeChange,
  onSelectFamilyMember,
  onProceed,
}: PatientStepProps) {
  return (
    <motion.div
      key="patient"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-5"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">Patient Details</p>
        <p className="text-xs text-gray-400 mt-0.5">Enter phone to auto-fill existing records</p>
      </div>

      {/* Phone */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
          <Phone className="w-3.5 h-3.5 text-cyan-600" />
        </div>
        <Input
          className="h-12 pl-14 pr-24 text-sm rounded-xl border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 bg-gray-50/50"
          placeholder="10-digit mobile number"
          aria-label="Patient phone number"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          autoFocus
          maxLength={13}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-live="polite" role="status">
          {lookingUp && (
            <div className="flex items-center gap-1 text-cyan-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span className="text-[10px] font-medium">Searching</span>
            </div>
          )}
          {patientFound === true && !lookingUp && (
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] font-semibold gap-1 h-6">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Found
            </Badge>
          )}
          {patientFound === false && !lookingUp && (
            <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] font-semibold gap-1 h-6">
              <Sparkles className="w-3 h-3" aria-hidden="true" /> New
            </Badge>
          )}
        </div>
      </div>

      {/* Family member selector — shows all known names for this phone */}
      {patientFound === true && familyMembers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <p className="text-xs font-medium text-gray-500">
            {familyMembers.length === 1 ? "Patient found" : `${familyMembers.length} members found — select or add new`}
          </p>
          <div className="flex flex-wrap gap-2">
            {familyMembers.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelectFamilyMember(name)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                  patientName === name
                    ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                    : "border-gray-200 bg-gray-50/50 text-gray-700 hover:border-cyan-300 hover:bg-cyan-50/30"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  patientName === name ? "bg-cyan-600 text-white" : "bg-gray-200 text-gray-500"
                )}>
                  {name[0]?.toUpperCase()}
                </div>
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onPatientNameChange("")
                onPatientGenderChange("")
                onPatientAgeChange("")
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                patientName === "" || !familyMembers.includes(patientName)
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-dashed border-gray-300 text-gray-400 hover:border-emerald-400 hover:text-emerald-600"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              New member
            </button>
          </div>
        </motion.div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="patient-name" className="text-xs font-medium text-gray-500 mb-1.5 block">Full Name</label>
        <Input
          id="patient-name"
          className="h-12 text-sm rounded-xl border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 bg-gray-50/50"
          placeholder="Patient full name"
          value={patientName}
          onChange={(e) => onPatientNameChange(e.target.value)}
        />
      </div>

      {/* Gender + Age */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="patient-gender" className="text-xs font-medium text-gray-500 mb-1.5 block">Gender</label>
          <Select value={patientGender} onValueChange={onPatientGenderChange}>
            <SelectTrigger id="patient-gender" aria-label="Select patient gender" className="h-12 text-sm rounded-xl border-gray-200 bg-gray-50/50">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="patient-age" className="text-xs font-medium text-gray-500 mb-1.5 block">Age</label>
          <Input
            id="patient-age"
            className="h-12 text-sm rounded-xl border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 bg-gray-50/50"
            type="number"
            placeholder="Age"
            value={patientAge}
            onChange={(e) => onPatientAgeChange(e.target.value)}
          />
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={onProceed}
        disabled={!canProceedPatient || loading}
        className="w-full h-12 rounded-xl text-sm font-semibold bg-cyan-700 hover:bg-cyan-800 text-white transition-colors gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        Continue
      </Button>
    </motion.div>
  )
}
