"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2, CheckCircle } from "lucide-react"

interface SetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetPasswordDialog({ open, onOpenChange }: SetPasswordDialogProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/create-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to set password")
        return
      }

      setDone(true)
      toast.success("Password set successfully! You can now log in with email and password.")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setDone(false)
    }
    onOpenChange(open)
  }

  return (
    <PremiumDialog
      open={open}
      onOpenChange={handleClose}
      title="Set Password"
      subtitle="Enable email & password login"
      icon={<KeyRound className="w-5 h-5" />}
      gradient="gradient-purple"
      maxWidth="sm:max-w-md"
    >
      {done ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="font-semibold text-lg">Password Created</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You can now log in using <strong>{email}</strong> and your password.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => handleClose(false)}
          >
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Set up an email and password so you can log in without selecting a role and entering a PIN.
          </p>

          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !email || !password || !confirmPassword}
            className="w-full gradient-purple text-white hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            {saving ? "Setting up..." : "Set Password"}
          </Button>
        </div>
      )}
    </PremiumDialog>
  )
}
