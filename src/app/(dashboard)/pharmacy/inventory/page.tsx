"use client"

import { useState, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useMedicines } from "@/hooks/use-pharmacy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Pill,
  AlertTriangle,
  Loader2,
  Edit,
  Package,
  Archive,
  TrendingDown,
} from "lucide-react"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { StatCard } from "@/components/reception/stat-card"
import type { Medicine } from "@/types/database"
import { formatCurrency } from "@/lib/utils/format"

const CATEGORIES = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Other"]

export default function InventoryPage() {
  const { activeTenantId: tenantId } = useBranch()

  const { medicines, isLoading, mutate } = useMedicines(tenantId)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Medicine | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Form fields
  const [formName, setFormName] = useState("")
  const [formSalt, setFormSalt] = useState("")
  const [formDosage, setFormDosage] = useState("")
  const [formCategory, setFormCategory] = useState("Tablet")
  const [formStock, setFormStock] = useState("0")
  const [formMinStock, setFormMinStock] = useState("10")
  const [formPrice, setFormPrice] = useState("0")
  const [formExpiry, setFormExpiry] = useState("")

  const filtered = medicines.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      m.medicine_name?.toLowerCase().includes(q) ||
      m.salt?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q)
    )
  })

  const stats = useMemo(() => {
    const lowStock = medicines.filter((m) => m.stock <= m.min_stock).length
    const todayStr = new Date().toISOString().split("T")[0]
    const expired = medicines.filter((m) => m.expiry_date && m.expiry_date < todayStr).length
    const categories = new Set(medicines.map((m) => m.category)).size
    return { total: medicines.length, lowStock, expired, categories }
  }, [medicines])

  const resetForm = () => {
    setFormName("")
    setFormSalt("")
    setFormDosage("")
    setFormCategory("Tablet")
    setFormStock("0")
    setFormMinStock("10")
    setFormPrice("0")
    setFormExpiry("")
    setEditing(null)
  }

  const openEdit = (med: Medicine) => {
    setEditing(med)
    setFormName(med.medicine_name)
    setFormSalt(med.salt || "")
    setFormDosage(med.dosage || "")
    setFormCategory(med.category || "Tablet")
    setFormStock(String(med.stock))
    setFormMinStock(String(med.min_stock))
    setFormPrice(String(med.price))
    setFormExpiry(med.expiry_date || "")
    setShowForm(true)
  }

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast.error("Medicine name is required")
      return
    }
    setSaving(true)
    const supabase = createBrowserClient()

    const data = {
      tenant_id: tenantId,
      medicine_name: formName.trim(),
      salt: formSalt.trim() || null,
      dosage: formDosage.trim() || null,
      category: formCategory,
      stock: parseInt(formStock) || 0,
      min_stock: parseInt(formMinStock) || 10,
      price: parseFloat(formPrice) || 0,
      expiry_date: formExpiry || null,
      status: "active",
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from("medicines")
          .update(data)
          .eq("medicine_id", editing.medicine_id)
          .eq("tenant_id", tenantId)
        if (error) throw error
        toast.success("Medicine updated")
      } else {
        const { error } = await supabase.from("medicines").insert({
          ...data,
          medicine_id: `MED-${Date.now()}`,
        })
        if (error) throw error
        toast.success("Medicine added")
      }

      resetForm()
      setShowForm(false)
      mutate()
    } catch {
      toast.error("Failed to save medicine")
    } finally {
      setSaving(false)
    }
  }, [formName, formSalt, formDosage, formCategory, formStock, formMinStock, formPrice, formExpiry, editing, tenantId, mutate])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Pill className="w-6 h-6" />}
        gradient="gradient-teal"
        title="Medicine Inventory"
        subtitle="Manage medicines and stock levels"
        badge={<Badge variant="secondary" className="text-xs">{stats.total}</Badge>}
        action={
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> Add Medicine
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Total" value={stats.total} gradient="gradient-teal" icon={<Package className="w-10 h-10" />} index={0} />
        <StatCard label="Low Stock" value={stats.lowStock} gradient="gradient-red" icon={<TrendingDown className="w-10 h-10" />} index={1} />
        <StatCard label="Expired" value={stats.expired} gradient="gradient-orange" icon={<AlertTriangle className="w-10 h-10" />} index={2} />
        <StatCard label="Categories" value={stats.categories} gradient="gradient-purple" icon={<Archive className="w-10 h-10" />} index={3} />
      </div>

      {stats.lowStock > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          {stats.lowStock} medicine(s) at or below minimum stock level
        </motion.div>
      )}

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, salt, or category..."
        filters={
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px] bg-transparent border-0 shadow-none">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  </motion.div>
                  No medicines found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((med, idx) => (
                <motion.tr
                  key={med.medicine_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-accent/30 border-b transition-colors duration-150"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center text-white">
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{med.medicine_name}</p>
                        {med.salt && (
                          <p className="text-xs text-muted-foreground">{med.salt}</p>
                        )}
                        {med.dosage && (
                          <p className="text-xs text-muted-foreground">{med.dosage}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {med.category || "\u2014"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const ratio = med.min_stock > 0 ? med.stock / med.min_stock : med.stock > 0 ? 3 : 0
                      const barColor = ratio <= 1 ? "bg-red-500" : ratio <= 2 ? "bg-amber-500" : "bg-green-500"
                      const textColor = ratio <= 1 ? "text-destructive font-bold" : ratio <= 2 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-sm"
                      const pct = Math.min(ratio / 3 * 100, 100)
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={textColor}>{med.stock}</span>
                            {ratio <= 1 && <AlertTriangle className="w-3 h-3 text-destructive" />}
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Min: {med.min_stock}</p>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {formatCurrency(med.price)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {med.expiry_date || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(med)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} medicine(s)
      </p>

      {/* Add/Edit Dialog */}
      <PremiumDialog
        open={showForm}
        onOpenChange={() => { setShowForm(false); resetForm() }}
        title={editing ? "Edit Medicine" : "Add Medicine"}
        subtitle={editing ? editing.medicine_id : "Add to inventory"}
        icon={<Pill className="w-5 h-5" />}
        gradient="gradient-teal"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Medicine Name *</Label>
              <Input placeholder="e.g. Paracetamol" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Salt/Generic Name</Label>
              <Input placeholder="e.g. Acetaminophen" value={formSalt} onChange={(e) => setFormSalt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Dosage</Label>
              <Input placeholder="e.g. 500mg" value={formDosage} onChange={(e) => setFormDosage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (Rs)</Label>
              <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Current Stock</Label>
              <Input type="number" value={formStock} onChange={(e) => setFormStock(e.target.value)} min="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stock Level</Label>
              <Input type="number" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value)} min="0" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {editing ? "Update Medicine" : "Add Medicine"}
          </Button>
        </div>
      </PremiumDialog>
    </div>
  )
}
