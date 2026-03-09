"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  Loader2,
  Heart,
  Smartphone,
  KeyRound,
  ShieldCheck,
} from "lucide-react"

type Step = "phone" | "otp"

export default function PatientLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [patientName, setPatientName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendOtp = useCallback(async () => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Normalize: add 91 prefix if not present
      const normalizedPhone = digits.length === 10 ? `91${digits}` : digits

      const res = await fetch("/api/patient-auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to send OTP")
        return
      }

      setPatientName(data.name || "")
      setStep("otp")
      setCountdown(30)
      // Focus first OTP input after transition
      setTimeout(() => otpRefs.current[0]?.focus(), 300)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [phone])

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return

      const newOtp = [...otp]
      newOtp[index] = value.slice(-1) // Only keep last digit
      setOtp(newOtp)
      setError("")

      // Auto-focus next input
      if (value && index < 5) {
        otpRefs.current[index + 1]?.focus()
      }

      // Auto-submit when all 6 digits entered
      if (value && index === 5 && newOtp.every((d) => d)) {
        handleVerifyOtp(newOtp.join(""))
      }
    },
    [otp] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    },
    [otp]
  )

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      const newOtp = pasted.split("")
      setOtp(newOtp)
      otpRefs.current[5]?.focus()
      handleVerifyOtp(pasted)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const verifyingRef = useRef(false)

  const handleVerifyOtp = useCallback(
    async (otpCode?: string) => {
      if (verifyingRef.current) return // Prevent double submission
      const code = otpCode || otp.join("")
      if (code.length !== 6) {
        setError("Please enter the 6-digit OTP")
        return
      }

      verifyingRef.current = true
      setLoading(true)
      setError("")

      const digits = phone.replace(/\D/g, "")
      const normalizedPhone = digits.length === 10 ? `91${digits}` : digits

      try {
        const result = await signIn("patient-login", {
          phone: normalizedPhone,
          otp: code,
          redirect: false,
        })

        if (result?.error) {
          setError("Invalid or expired OTP. Please try again.")
          setOtp(["", "", "", "", "", ""])
          otpRefs.current[0]?.focus()
        } else {
          router.push("/patient")
        }
      } catch {
        setError("Verification failed. Please try again.")
      } finally {
        setLoading(false)
        verifyingRef.current = false
      }
    },
    [otp, phone, router]
  )

  const handleResend = useCallback(() => {
    setOtp(["", "", "", "", "", ""])
    setError("")
    handleSendOtp()
  }, [handleSendOtp])

  return (
    <div className="min-h-screen bg-[#08080D] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Header card */}
        <div className="rounded-t-2xl bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-700 p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mx-auto mb-3 flex items-center justify-center">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Patient Portal</h1>
          <p className="text-sm text-white/70 mt-1">
            Access your medical records securely
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-b-2xl bg-[#12121A] border border-white/5 p-6">
          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-teal-400" />
                    Phone Number
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400">
                      +91
                    </div>
                    <Input
                      type="tel"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        setError("")
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                      maxLength={10}
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-11"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  onClick={handleSendOtp}
                  disabled={loading || phone.replace(/\D/g, "").length < 10}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  Send OTP via WhatsApp
                </Button>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>A 6-digit code will be sent to your WhatsApp</span>
                </div>

                <div className="pt-2 border-t border-white/5 text-center">
                  <Link
                    href="/login"
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Hospital staff? Login here &rarr;
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <button
                  onClick={() => {
                    setStep("phone")
                    setOtp(["", "", "", "", "", ""])
                    setError("")
                  }}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change number
                </button>

                {patientName && (
                  <p className="text-sm text-gray-300">
                    Welcome back, <span className="text-white font-medium">{patientName}</span>
                  </p>
                )}

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-teal-400" />
                    Enter OTP
                  </Label>
                  <p className="text-xs text-gray-500">
                    Sent to +{phone.replace(/\D/g, "").length === 10 ? `91${phone.replace(/\D/g, "")}` : phone.replace(/\D/g, "")} via WhatsApp
                  </p>

                  <div className="flex justify-between gap-2 mt-3">
                    {otp.map((digit, i) => (
                      <Input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={i === 0 ? handleOtpPaste : undefined}
                        className="w-12 h-14 text-center text-xl font-mono bg-white/5 border-white/10 text-white rounded-xl focus:border-teal-500 focus:ring-teal-500"
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otp.some((d) => !d)}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-medium"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  Verify & Login
                </Button>

                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-xs text-gray-500">
                      Resend OTP in <span className="text-teal-400 font-mono">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={loading}
                      className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
