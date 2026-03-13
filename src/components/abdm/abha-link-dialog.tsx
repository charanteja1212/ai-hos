"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Loader2, Link2, Unlink, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { isValidAbhaNumber, isValidAbhaAddress, formatAbhaNumber } from "@/lib/abdm/config"

interface AbhaLinkDialogProps {
  patientPhone: string
  tenantId: string
  currentAbha?: string | null
  currentAbhaAddress?: string | null
  currentStatus?: "not_linked" | "linked" | "verified" | null
  onUpdate?: () => void
  children?: React.ReactNode
}

export function AbhaLinkDialog({
  patientPhone,
  tenantId,
  currentAbha,
  currentAbhaAddress,
  currentStatus,
  onUpdate,
  children,
}: AbhaLinkDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"input" | "otp" | "done">("input")

  // Manual link fields
  const [abhaNumber, setAbhaNumber] = useState("")
  const [abhaAddress, setAbhaAddress] = useState("")

  // OTP verification fields
  const [txnId, setTxnId] = useState("")
  const [otp, setOtp] = useState("")

  const isLinked = currentStatus === "linked" || currentStatus === "verified"

  const handleManualLink = useCallback(async () => {
    if (!isValidAbhaNumber(abhaNumber)) {
      toast.error("Invalid ABHA number. Must be 14 digits.")
      return
    }
    if (abhaAddress && !isValidAbhaAddress(abhaAddress)) {
      toast.error("Invalid ABHA address format (e.g. user@abdm)")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link-abha",
          tenantId,
          patientPhone,
          abhaNumber: abhaNumber.replace(/\D/g, ""),
          abhaAddress: abhaAddress || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success("ABHA number linked successfully")
      setStep("done")
      onUpdate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link ABHA")
    } finally {
      setLoading(false)
    }
  }, [abhaNumber, abhaAddress, tenantId, patientPhone, onUpdate])

  const handleRequestOtp = useCallback(async () => {
    if (!isValidAbhaNumber(abhaNumber)) {
      toast.error("Enter a valid 14-digit ABHA number")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-otp",
          tenantId,
          abhaNumber: abhaNumber.replace(/\D/g, ""),
          authMethod: "MOBILE_OTP",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTxnId(data.txnId)
      setStep("otp")
      toast.success("OTP sent to registered mobile")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }, [abhaNumber, tenantId])

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length < 4) {
      toast.error("Enter the OTP")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-otp",
          tenantId,
          txnId,
          otp,
          patientPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(`ABHA verified: ${formatAbhaNumber(data.profile.abhaNumber)}`)
      setStep("done")
      onUpdate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setLoading(false)
    }
  }, [otp, txnId, tenantId, patientPhone, onUpdate])

  const handleUnlink = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/abdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink-abha",
          tenantId,
          patientPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success("ABHA unlinked")
      setOpen(false)
      onUpdate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink ABHA")
    } finally {
      setLoading(false)
    }
  }, [tenantId, patientPhone, onUpdate])

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep("input"); setOtp(""); setTxnId("") } }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-1.5">
            {isLinked ? <Unlink className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
            {isLinked ? "Manage ABHA" : "Link ABHA"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            {isLinked ? "Manage ABHA" : "Link ABHA Number"}
          </DialogTitle>
        </DialogHeader>

        {/* Already linked — show current + unlink option */}
        {isLinked && step === "input" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <p className="text-xs font-medium text-emerald-700">Currently Linked</p>
              <p className="font-mono text-lg font-semibold">{formatAbhaNumber(currentAbha || "")}</p>
              {currentAbhaAddress && (
                <p className="text-sm text-muted-foreground">{currentAbhaAddress}</p>
              )}
              {currentStatus === "verified" && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> KYC Verified
                </div>
              )}
            </div>
            <Button variant="destructive" onClick={handleUnlink} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Unlink ABHA
            </Button>
          </div>
        ) : step === "done" ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-semibold">ABHA Linked Successfully</p>
            <p className="text-sm text-muted-foreground">The patient health ID is now linked to their record.</p>
            <Button onClick={() => setOpen(false)} className="mt-2">Done</Button>
          </div>
        ) : step === "otp" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the OTP sent to the mobile number linked with ABHA.</p>
            <div className="space-y-1.5">
              <Label>OTP</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>
            <Button onClick={handleVerifyOtp} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Verify & Link
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="manual">
            <TabsList className="w-full">
              <TabsTrigger value="manual" className="flex-1 text-xs">Manual Link</TabsTrigger>
              <TabsTrigger value="verify" className="flex-1 text-xs">Verify via OTP</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Enter the patient&apos;s 14-digit ABHA number to link it to their record.
              </p>
              <div className="space-y-1.5">
                <Label>ABHA Number</Label>
                <Input
                  value={abhaNumber}
                  onChange={(e) => setAbhaNumber(e.target.value)}
                  placeholder="XX-XXXX-XXXX-XXXX"
                  maxLength={17}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ABHA Address (optional)</Label>
                <Input
                  value={abhaAddress}
                  onChange={(e) => setAbhaAddress(e.target.value)}
                  placeholder="username@abdm"
                />
              </div>
              <Button onClick={handleManualLink} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Link ABHA
              </Button>
            </TabsContent>
            <TabsContent value="verify" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Verify the ABHA number via OTP sent to the patient&apos;s registered mobile.
              </p>
              <div className="space-y-1.5">
                <Label>ABHA Number</Label>
                <Input
                  value={abhaNumber}
                  onChange={(e) => setAbhaNumber(e.target.value)}
                  placeholder="XX-XXXX-XXXX-XXXX"
                  maxLength={17}
                  className="font-mono"
                />
              </div>
              <Button onClick={handleRequestOtp} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Send OTP
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
