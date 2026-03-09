"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { IndianRupee, Loader2, Plus, Receipt } from "lucide-react"
import type { Admission, DailyCharge } from "@/types/database"
import { getTodayIST } from "@/lib/utils/date"

interface DailyChargesPanelProps {
  admission: Admission | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

const CATEGORIES = [
  { value: "bed", label: "Bed" },
  { value: "medicine", label: "Medicine" },
  { value: "procedure", label: "Procedure" },
  { value: "consumable", label: "Consumable" },
  { value: "other", label: "Other" },
] as const

const CATEGORY_COLORS: Record<string, string> = {
  bed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medicine: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  procedure: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  consumable: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export function DailyChargesPanel({ admission, open, onClose, onUpdated }: DailyChargesPanelProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<DailyCharge["category"]>("other")
  const [saving, setSaving] = useState(false)

  const charges: DailyCharge[] = admission?.daily_charges || []
  const total = charges.reduce((s, c) => s + c.amount, 0)

  const handleAdd = useCallback(async () => {
    if (!admission || !description.trim() || !amount) {
      toast.error("Please fill in description and amount")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    try {
      const { data: current } = await supabase
        .from("admissions")
        .select("daily_charges")
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", admission.tenant_id)
        .single()

      const existing: DailyCharge[] = [...((current?.daily_charges as DailyCharge[]) || [])]
      existing.push({
        date: getTodayIST(),
        description: description.trim(),
        amount: parseFloat(amount) || 0,
        category,
      })

      const { error } = await supabase
        .from("admissions")
        .update({ daily_charges: existing })
        .eq("admission_id", admission.admission_id)
        .eq("tenant_id", admission.tenant_id)

      if (error) throw error

      toast.success("Charge added")
      setDescription("")
      setAmount("")
      setCategory("other")
      onUpdated()
    } catch (err) {
      console.error("[daily-charges] Failed:", err)
      toast.error("Failed to add charge")
    } finally {
      setSaving(false)
    }
  }, [admission, description, amount, category, onUpdated])

  return (
    <PremiumDialog
      open={open}
      onOpenChange={onClose}
      title="Daily Charges"
      subtitle={admission?.patient_name || ""}
      icon={<Receipt className="w-5 h-5" />}
      gradient="gradient-orange"
      maxWidth="sm:max-w-lg"
    >
      {admission && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Add charge form */}
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Charge
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  placeholder="e.g., IV fluids, wound dressing..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (Rs)</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as DailyCharge["category"])}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleAdd} disabled={saving || !description.trim() || !amount} size="sm" className="w-full">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add Charge
            </Button>
          </div>

          {/* Charges table */}
          {charges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No charges yet</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{c.date}</TableCell>
                      <TableCell className="text-xs">{c.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${CATEGORY_COLORS[c.category]}`}>
                          {c.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        Rs {c.amount.toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-3 glass rounded-xl">
                <p className="text-sm font-semibold">Total Charges</p>
                <p className="text-lg font-bold flex items-center gap-0.5">
                  <IndianRupee className="w-4 h-4" />
                  {total.toLocaleString("en-IN")}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </PremiumDialog>
  )
}
