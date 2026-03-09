"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { SearchBar } from "@/components/shared/search-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  Plus,
  Loader2,
  GitBranch,
  Eye,
  Mail,
  Phone,
  User,
  XCircle,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"
import type { Client, Tenant } from "@/types/database"
import { OnboardingWizard } from "@/components/platform/onboarding-wizard"
import { Rocket } from "lucide-react"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  trial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

const PLAN_GRADIENT: Record<string, string> = {
  basic: "gradient-green",
  starter: "gradient-blue",
  medium: "gradient-blue",
  professional: "gradient-purple",
  enterprise: "gradient-purple",
  trial: "bg-gradient-to-br from-gray-500 to-gray-600",
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

export default function ClientsListPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined

  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // Form fields
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formPlan, setFormPlan] = useState("basic")
  const [formMaxBranches, setFormMaxBranches] = useState("3")
  const [formAdminPin, setFormAdminPin] = useState("")
  const [formContactName, setFormContactName] = useState("")
  const [formContactEmail, setFormContactEmail] = useState("")
  const [formContactPhone, setFormContactPhone] = useState("")

  // Auth guard
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/platform?scope=clients")
      const data = await res.json()
      setClients((data.clients || []) as Client[])
      setBranches((data.branches || []) as Tenant[])
      setLoading(false)
    } catch {
      setError(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-generate slug from name
  useEffect(() => {
    setFormSlug(slugify(formName))
  }, [formName])

  const resetForm = () => {
    setFormName("")
    setFormSlug("")
    setFormPlan("basic")
    setFormMaxBranches("3")
    setFormAdminPin("")
    setFormContactName("")
    setFormContactEmail("")
    setFormContactPhone("")
  }

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast.error("Client name is required")
      return
    }
    if (!formSlug.trim()) {
      toast.error("Slug is required")
      return
    }
    if (!formAdminPin) {
      toast.error("Admin PIN is required")
      return
    }

    setSaving(true)

    const clientId = `CL${Date.now()}`
    const payload = {
      action: "createClient",
      client_id: clientId,
      name: formName.trim(),
      slug: formSlug.trim(),
      subscription_plan: formPlan,
      tier: formPlan,
      max_branches: parseInt(formMaxBranches) || 3,
      admin_pin: formAdminPin,
      contact_name: formContactName.trim() || null,
      contact_email: formContactEmail.trim() || null,
      contact_phone: formContactPhone.trim() || null,
      status: "active",
    }

    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create client")

      toast.success(`Client "${formName}" created`)
      resetForm()
      setShowForm(false)
      fetchData()
    } catch {
      toast.error("Failed to create client")
    } finally {
      setSaving(false)
    }
  }, [
    formName,
    formSlug,
    formPlan,
    formMaxBranches,
    formAdminPin,
    formContactName,
    formContactEmail,
    formContactPhone,
    fetchData,
  ])

  const filtered = clients.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.contact_email || "").toLowerCase().includes(q)
    )
  })

  const getBranchCount = (clientId: string) =>
    branches.filter((b) => b.client_id === clientId).length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load clients</h2>
        <p className="text-muted-foreground">
          Please check your connection and refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<Building2 className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Clients"
        subtitle="Manage hospital groups"
        badge={
          <Badge variant="secondary" className="text-xs">
            {clients.length}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWizard(true)}
            >
              <Rocket className="w-4 h-4 mr-2" /> Quick Onboard
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="gradient-blue text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </div>
        }
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name, slug, contact..."
      />

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            </motion.div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? "No clients match your search" : "No clients yet"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery
                ? "Try a different search term"
                : 'Click "Add Client" to create one'}
            </p>
          </div>
        ) : (
          filtered.map((client, idx) => {
            const branchCount = getBranchCount(client.client_id)
            return (
              <motion.div
                key={client.client_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="card-hover group relative overflow-hidden">
                  {/* Gradient accent bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      PLAN_GRADIENT[client.subscription_plan] || "gradient-blue"
                    }`}
                  />

                  <CardContent className="p-5 pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl ${
                            PLAN_GRADIENT[client.subscription_plan] ||
                            "gradient-blue"
                          } flex items-center justify-center text-white font-bold text-sm`}
                        >
                          {client.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.slug}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={STATUS_BADGE[client.status] || ""}
                      >
                        {client.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                      >
                        {client.subscription_plan}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="w-3.5 h-3.5" />
                        <span className="font-mono">
                          {branchCount} / {client.max_branches}
                        </span>
                        <span>branches</span>
                      </div>
                    </div>

                    {/* Contact info */}
                    {(client.contact_name ||
                      client.contact_email ||
                      client.contact_phone) && (
                      <div className="space-y-1 mb-4 pt-3 border-t border-border/50">
                        {client.contact_name && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            {client.contact_name}
                          </div>
                        )}
                        {client.contact_email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {client.contact_email}
                          </div>
                        )}
                        {client.contact_phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {client.contact_phone}
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        router.push(
                          `/platform/clients/${client.client_id}`
                        )
                      }
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} client(s)
      </p>

      {/* Add Client Dialog */}
      <PremiumDialog
        open={showForm}
        onOpenChange={() => {
          setShowForm(false)
          resetForm()
        }}
        title="Add Client"
        subtitle="Create a new hospital group"
        icon={<Building2 className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Client Name *</Label>
              <Input
                placeholder="Care Hospital Group"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Slug</Label>
              <Input
                placeholder="care-hospital-group"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Auto-generated from name. Used as URL identifier.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Tier / Plan *</Label>
              <Select value={formPlan} onValueChange={setFormPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic — Solo / Small Clinic</SelectItem>
                  <SelectItem value="medium">Medium — Multi-Doctor Hospital</SelectItem>
                  <SelectItem value="enterprise">Enterprise — Multi-Specialty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Branches</Label>
              <Input
                type="number"
                value={formMaxBranches}
                onChange={(e) => setFormMaxBranches(e.target.value)}
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Admin PIN *</Label>
              <Input
                type="password"
                placeholder="4-6 digit PIN"
                value={formAdminPin}
                onChange={(e) => setFormAdminPin(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>

          {/* Contact info section */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Contact Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Contact Name</Label>
                <Input
                  placeholder="John Doe"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  placeholder="admin@hospital.com"
                  value={formContactEmail}
                  onChange={(e) => setFormContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input
                  placeholder="+91..."
                  value={formContactPhone}
                  onChange={(e) => setFormContactPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gradient-blue text-white hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Client
          </Button>
        </div>
      </PremiumDialog>

      <OnboardingWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => fetchData()}
      />
    </div>
  )
}
