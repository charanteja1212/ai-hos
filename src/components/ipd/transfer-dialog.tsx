"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { ArrowRightLeft, BedDouble, IndianRupee, Loader2 } from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { useWardBeds } from "@/hooks/use-ward-beds"
import type { Admission, TransferRecord } from "@/types/database"

interface TransferDialogProps {
  admission: Admission | null
  tenantId: string
  open: boolean
  onClose: () => void
  onTransferred: () => void
  userName?: string
}

export function TransferDialog({ admission, tenantId, open, onClose, onTransferred, userName }: TransferDialogProps) {
  const { wards, bedMap } = useWardBeds(tenantId)
  const [newWard, setNewWard] = useState("")
  const [newBed, setNewBed] = useState("")
  const [reason, setReason] = useState("")
  const [transferring, setTransferring] = useState(false)

  const availableBeds = newWard ? (bedMap[newWard] || []).filter((b) => b.status === "available") : []
  const wardConfig = newWard ? wards[newWard] : null

  const handleTransfer = useCallback(async () => {
    if (!admission || !newWard || !newBed) return
    setTransferring(true)
    const supabase = createBrowserClient()

    try {
      // Read current transfer history
      const { data: current } = await supabase
        .from("admissions")
        .select("transfer_history, status")
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", tenantId)
        .single()

      if (current?.status === "discharged") {
        toast.error("Patient has already been discharged")
        setTransferring(false)
        return
      }

      const history: TransferRecord[] = [...((current?.transfer_history as TransferRecord[]) || [])]
      history.push({
        id: `TR-${Date.now()}`,
        from_ward: admission.ward || "",
        from_bed: admission.bed_number || "",
        to_ward: newWard,
        to_bed: newBed,
        transferred_at: new Date().toISOString(),
        transferred_by: userName || "Staff",
        reason: reason || "Ward transfer",
      })

      const { error } = await supabase
        .from("admissions")
        .update({
          ward: newWard,
          bed_number: newBed,
          transfer_history: history,
        })
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", tenantId)

      if (error) throw error

      toast.success(`${admission.patient_name} transferred to ${newWard} — Bed ${newBed}`)

      createNotification({
        tenantId,
        type: "patient_transferred",
        title: "Patient transferred",
        message: `${admission.patient_name} moved to ${newWard} — Bed ${newBed}`,
        targetRole: "RECEPTION",
        referenceId: admission.admission_id,
        referenceType: "admission",
      })

      setNewWard("")
      setNewBed("")
      setReason("")
      onTransferred()
      onClose()
    } catch (err) {
      console.error("[transfer] Failed:", err)
      toast.error("Failed to transfer patient")
    } finally {
      setTransferring(false)
    }
  }, [admission, newWard, newBed, reason, userName, tenantId, onTransferred, onClose])

  return (
    <PremiumDialog
      open={open}
      onOpenChange={onClose}
      title="Transfer Patient"
      subtitle={admission?.admission_id}
      icon={<ArrowRightLeft className="w-5 h-5" />}
      gradient="gradient-blue"
      maxWidth="sm:max-w-lg"
    >
      {admission && (
        <div className="space-y-4">
          {/* Current location card */}
          <div className="rounded-xl gradient-orange p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Current Location</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <BedDouble className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">{admission.patient_name}</p>
                <p className="text-sm text-white/70">
                  {admission.ward} — Bed {admission.bed_number}
                </p>
              </div>
            </div>
          </div>

          {/* New ward */}
          <div className="space-y-2">
            <Label>Transfer To Ward</Label>
            <Select
              value={newWard}
              onValueChange={(v) => {
                setNewWard(v)
                setNewBed("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select new ward" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(wards).map(([name, config]) => {
                  const avail = (bedMap[name] || []).filter((b) => b.status === "available").length
                  return (
                    <SelectItem key={name} value={name} disabled={avail === 0}>
                      {name} — {avail} available
                      <span className="text-muted-foreground ml-1">(Rs {config.daily_rate}/day)</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Bed picker */}
          {newWard && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Bed</Label>
                {wardConfig && (
                  <Badge variant="secondary" className="text-[10px]">
                    <IndianRupee className="w-2.5 h-2.5 mr-0.5" />
                    {wardConfig.daily_rate}/day
                  </Badge>
                )}
              </div>
              {availableBeds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available beds in this ward</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {availableBeds.map((b) => (
                    <button
                      key={b.bed}
                      onClick={() => setNewBed(b.bed)}
                      className={cn(
                        "rounded-lg p-2 text-center text-xs font-mono border transition-all",
                        "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                        "hover:shadow-md hover:scale-[1.02]",
                        newBed === b.bed && "ring-2 ring-primary ring-offset-1"
                      )}
                    >
                      {b.bed}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Transfer Reason</Label>
            <Textarea
              placeholder="Reason for transfer (e.g., ICU upgrade, step-down care...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleTransfer}
            disabled={transferring || !newWard || !newBed}
            className="w-full"
          >
            {transferring ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRightLeft className="w-4 h-4 mr-2" />
            )}
            Confirm Transfer
          </Button>
        </div>
      )}
    </PremiumDialog>
  )
}
