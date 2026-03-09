"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, Mail, CheckCircle, Heart, Sparkles } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.includes("@")) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Something went wrong")
        return
      }

      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#08080D] relative overflow-hidden select-none">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,#0D1B2A_0%,#08080D_60%)]" />
      <div
        className="fixed w-[80vmax] h-[80vmax] rounded-full opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, #007AFF 0%, transparent 65%)",
          top: "-35%",
          left: "-25%",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex relative"
          >
            <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </motion.div>
          </motion.div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Reset Password
            </span>
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {sent ? "Check your email" : "Enter your email to receive a reset link"}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden"
          style={{
            boxShadow: "0 24px 80px rgba(0,122,255,0.1), 0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div className="bg-[#111118] p-6 border border-white/[0.06] rounded-3xl">
            {sent ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
                <h3 className="font-semibold text-white text-lg">Email Sent</h3>
                <p className="text-sm text-white/40 mt-2 leading-relaxed">
                  If an account exists for <strong className="text-white/70">{email}</strong>,
                  you&apos;ll receive a password reset link shortly.
                </p>
                <p className="text-xs text-white/30 mt-3">
                  Check your spam folder if you don&apos;t see it.
                </p>
                <Link href="/login" className="mt-6">
                  <Button
                    variant="ghost"
                    className="text-white/50 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      className="h-12 pl-10 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: "#007AFF40" }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5 border border-red-500/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-12 rounded-xl font-semibold text-white border-0 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-700 hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3 inline mr-1" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
