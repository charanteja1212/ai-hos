"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, CheckCircle, Heart, Sparkles, XCircle } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [tokenError, setTokenError] = useState(false)
  const [initializing, setInitializing] = useState(true)

  // On mount, extract the recovery tokens from URL hash fragment
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const type = params.get("type")

    if (!accessToken || type !== "recovery") {
      setTokenError(true)
      setInitializing(false)
      return
    }

    // Set the Supabase session with the recovery tokens
    const supabase = createBrowserClient()
    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      })
      .then(({ error }) => {
        if (error) {
          setTokenError(true)
        }
        setInitializing(false)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message || "Failed to update password")
        return
      }

      // Sign out of Supabase Auth (we use NextAuth for app sessions)
      await supabase.auth.signOut()
      setDone(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080D]">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#08080D] relative overflow-hidden select-none">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,#0D1B2A_0%,#08080D_60%)]" />
      <div
        className="fixed w-[80vmax] h-[80vmax] rounded-full opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, #AF52DE 0%, transparent 65%)",
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
            <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
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
              New Password
            </span>
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {done ? "Password updated" : "Choose a new password for your account"}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden"
          style={{
            boxShadow: "0 24px 80px rgba(175,82,222,0.1), 0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div className="bg-[#111118] p-6 border border-white/[0.06] rounded-3xl">
            {tokenError ? (
              <div className="flex flex-col items-center py-4 text-center">
                <XCircle className="w-12 h-12 text-red-400 mb-3" />
                <h3 className="font-semibold text-white text-lg">Invalid or Expired Link</h3>
                <p className="text-sm text-white/40 mt-2 leading-relaxed">
                  This password reset link is invalid or has expired.
                  Please request a new one.
                </p>
                <Button
                  onClick={() => router.push("/forgot-password")}
                  className="mt-4 bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white hover:opacity-90"
                >
                  Request New Link
                </Button>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
                <h3 className="font-semibold text-white text-lg">Password Updated</h3>
                <p className="text-sm text-white/40 mt-2 leading-relaxed">
                  Your password has been updated successfully.
                  Redirecting to login...
                </p>
                <Loader2 className="w-5 h-5 animate-spin text-white/30 mt-3" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      className="h-12 pl-10 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: "#AF52DE40" }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 pl-10 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:ring-2 focus:border-transparent"
                      style={{ ["--tw-ring-color" as string]: "#AF52DE40" }}
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
                  disabled={loading || !password || !confirmPassword}
                  className="w-full h-12 rounded-xl font-semibold text-white border-0 bg-gradient-to-r from-purple-500 via-violet-600 to-fuchsia-700 hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
