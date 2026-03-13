"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
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
  Edit,
  Loader2,
  Phone,
  Mail,
  Users,
  UsersRound,
  ClipboardList,
  TestTube,
  Pill,
  ShieldCheck,
} from "lucide-react"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { SearchBar } from "@/components/shared/search-bar"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { StatCard } from "@/components/reception/stat-card"
import { cn } from "@/lib/utils"

import type { Staff } from "@/types/database"

const STAFF_ROLES = [
  { value: "RECEPTION", label: "Reception" },
  { value: "LAB_TECH", label: "Lab Technician" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
]

const ROLE_BADGE: Record<string, string> = {
  RECEPTION: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  LAB_TECH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PHARMACIST: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  BRANCH_ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  CLIENT_ADMIN: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
}

const ROLE_LABEL: Record<string, string> = {
  RECEPTION: "Reception",
  LAB_TECH: "Lab Tech",
  PHARMACIST: "Pharmacist",
  BRANCH_ADMIN: "Branch Admin",
  ADMIN: "Admin",
  CLIENT_ADMIN: "Client Admin",
}

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  RECEPTION: ClipboardList,
  LAB_TECH: TestTube,
  PHARMACIST: Pill,
  BRANCH_ADMIN: ShieldCheck,
  ADMIN: ShieldCheck,
}

export default function StaffManagementPage() {
  const { activeTenantId: tenantId } = useBranch()

  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState("")
  const [formRole, setFormRole] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPin, setFormPin] = useState("")
  const [formStatus, setFormStatus] = useState("active")

  const fetchStaff = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name")
        .limit(500)
      if (error) console.error("[staff] fetch error:", error.message)
      if (data) setStaff(data as Staff[])
    } catch (e) {
      console.error("[staff] fetch failed:", e)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const filtered = staff.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.staff_id.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    )
  })

  const stats = useMemo(() => {
    const reception = staff.filter((s) => s.role === "RECEPTION" && s.status === "active").length
    const labTech = staff.filter((s) => s.role === "LAB_TECH" && s.status === "active").length
    const pharmacist = staff.filter((s) => s.role === "PHARMACIST" && s.status === "active").length
    return { total: staff.length, reception, labTech, pharmacist }
  }, [staff])

  const resetForm = () => {
    setFormName("")
    setFormRole("")
    setFormPhone("")
    setFormEmail("")
    setFormPin("")
    setFormStatus("active")
    setEditing(null)
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (s: Staff) => {
    setEditing(s)
    setFormName(s.name)
    setFormRole(s.role)
    setFormPhone(s.phone || "")
    setFormEmail(s.email || "")
    setFormPin("")
    setFormStatus(s.status)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Name is required"); return }
    if (!formRole) { toast.error("Role is required"); return }
    if (!editing && !formPin.trim()) { toast.error("PIN is required for new staff"); return }
    if (formPin && formPin.length < 4) { toast.error("PIN must be at least 4 characters"); return }

    setSaving(true)
    const supabase = createBrowserClient()

    // Check for duplicate PIN within same tenant and role
    if (formPin.trim()) {
      const dupQuery = supabase
        .from("staff")
        .select("staff_id, name")
        .eq("tenant_id", tenantId)
        .eq("role", formRole)
        .eq("pin", formPin.trim())
        .eq("status", "active")
      if (editing) dupQuery.neq("staff_id", editing.staff_id)
      const { data: dupStaff } = await dupQuery.limit(1).maybeSingle()
      if (dupStaff) {
        toast.error(`PIN already in use by ${dupStaff.name}. Each staff member must have a unique PIN.`)
        setSaving(false)
        return
      }
    }

    if (editing) {
      // Update
      const updates: Record<string, string> = {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || "",
        email: formEmail.trim() || "",
        status: formStatus,
      }
      if (formPin.trim()) {
        updates.pin = formPin.trim()
      }

      const { error } = await supabase
        .from("staff")
        .update(updates)
        .eq("staff_id", editing.staff_id)
        .eq("tenant_id", tenantId)

      if (error) {
        toast.error("Failed to update staff. Please try again.")
      } else {
        toast.success(`${formName} updated successfully`)
        setShowForm(false)
        resetForm()
        fetchStaff()
      }
    } else {
      // Insert
      const staffId = "STF" + Date.now()
      const { error } = await supabase.from("staff").insert({
        staff_id: staffId,
        tenant_id: tenantId,
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        pin: formPin.trim(),
        status: "active",
      })

      if (error) {
        toast.error("Failed to add staff. Please try again.")
      } else {
        toast.success(`${formName} added as ${ROLE_LABEL[formRole] || formRole}`)
        setShowForm(false)
        resetForm()
        fetchStaff()
      }
    }
    setSaving(false)
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Staff"
        subtitle="Manage reception, lab technicians, pharmacists, and branch admins"
        icon={<UsersRound className="w-6 h-6" />}
        gradient="gradient-purple"
        variant="glass"
        badge={
          <Badge variant="secondary" className="text-xs">
            {stats.total} total
          </Badge>
        }
        action={
          <Button onClick={openAdd} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            Add Staff
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Staff"
          value={stats.total}
          icon={<Users className="w-10 h-10" />}
          gradient="gradient-blue"
        />
        <StatCard
          label="Reception"
          value={stats.reception}
          icon={<ClipboardList className="w-10 h-10" />}
          gradient="gradient-purple"
        />
        <StatCard
          label="Lab Technicians"
          value={stats.labTech}
          icon={<TestTube className="w-10 h-10" />}
          gradient="gradient-orange"
        />
        <StatCard
          label="Pharmacists"
          value={stats.pharmacist}
          icon={<Pill className="w-10 h-10" />}
          gradient="gradient-teal"
        />
      </div>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, role, email, or phone..."
      />

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Staff ID</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "No staff matching your search" : "No staff members yet. Add your first staff member."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s, idx) => {
                const RoleIcon = ROLE_ICON[s.role] || Users
                const initials = s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

                return (
                  <motion.tr
                    key={s.staff_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group border-b border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs gap-1", ROLE_BADGE[s.role] || "")}>
                        <RoleIcon className="w-3 h-3" />
                        {ROLE_LABEL[s.role] || s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {s.email}
                          </div>
                        )}
                        {!s.phone && !s.email && (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          s.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                        )}
                      >
                        {s.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {s.staff_id}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openEdit(s)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </motion.tr>
                )
              })
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* Add/Edit Dialog */}
      <PremiumDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) resetForm() }}
        title={editing ? "Edit Staff" : "Add Staff"}
        subtitle={editing ? `Update ${editing.name}'s details` : "Add a new staff member to this branch"}
        icon={<UsersRound className="w-5 h-5" />}
        gradient="gradient-purple"
      >
        <div className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input
              className="mt-1.5"
              placeholder="Enter full name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div>
            <Label>Role *</Label>
            <Select value={formRole} onValueChange={setFormRole}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1.5"
                placeholder="Phone number"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1.5"
                type="email"
                placeholder="Email address"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Login PIN {editing ? "(leave blank to keep current)" : "*"}</Label>
            <Input
              className="mt-1.5"
              type="password"
              placeholder={editing ? "Enter new PIN to change" : "Enter login PIN (min 4 chars)"}
              value={formPin}
              onChange={(e) => setFormPin(e.target.value)}
            />
          </div>

          {editing && (
            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Update" : "Add Staff"}
            </Button>
          </div>
        </div>
      </PremiumDialog>
    </div>
  )
}
