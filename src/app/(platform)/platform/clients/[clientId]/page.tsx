"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Building2,
  ArrowLeft,
  Plus,
  Loader2,
  GitBranch,
  MapPin,
  Mail,
  Phone,
  User,
  CalendarDays,
  Shield,
  XCircle,
  Hash,
  IndianRupee,
  MessageCircle,
  Pencil,
} from "lucide-react"
import type { SessionUser } from "@/types/auth"
import type { Client, Tenant } from "@/types/database"
import { LogoUpload } from "@/components/shared/logo-upload"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  trial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  professional: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  trial: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
}

export default function ClientDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.clientId as string
  const user = session?.user as SessionUser | undefined

  const [client, setClient] = useState<Client | null>(null)
  const [branches, setBranches] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Branch form fields
  const [formHospitalName, setFormHospitalName] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formBranchCode, setFormBranchCode] = useState("")
  const [formAdminPin, setFormAdminPin] = useState("")
  const [formReceptionPin, setFormReceptionPin] = useState("")
  const [formConsultationFee, setFormConsultationFee] = useState("200")
  const [formWhatsAppPhoneId, setFormWhatsAppPhoneId] = useState("")
  const [formWhatsAppNumber, setFormWhatsAppNumber] = useState("")
  const [formWhatsAppDisplayName, setFormWhatsAppDisplayName] = useState("")
  const [formBotName, setFormBotName] = useState("")
  const [formLogoUrl, setFormLogoUrl] = useState("")

  // Edit branch state
  const [editBranch, setEditBranch] = useState<Tenant | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Auth guard
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  const fetchData = useCallback(async () => {
    if (!clientId) return

    try {
      const res = await fetch(`/api/platform?scope=client&clientId=${clientId}`)
      const data = await res.json()

      if (data.client) {
        setClient(data.client as Client)
      }
      setBranches((data.branches || []) as Tenant[])
      setLoading(false)
    } catch {
      setError(true)
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetBranchForm = () => {
    setFormHospitalName("")
    setFormCity("")
    setFormBranchCode("")
    setFormAdminPin("")
    setFormReceptionPin("")
    setFormConsultationFee("200")
    setFormWhatsAppPhoneId("")
    setFormWhatsAppNumber("")
    setFormWhatsAppDisplayName("")
    setFormBotName("")
    setFormLogoUrl("")
  }

  const handleAddBranch = useCallback(async () => {
    if (!formHospitalName.trim()) {
      toast.error("Hospital name is required")
      return
    }
    if (!formAdminPin) {
      toast.error("Admin PIN is required")
      return
    }

    setSaving(true)

    const tenantId = `T${Date.now()}`
    const payload: Record<string, unknown> = {
      action: "createBranch",
      tenant_id: tenantId,
      client_id: clientId,
      hospital_name: formHospitalName.trim(),
      city: formCity.trim() || null,
      branch_code: formBranchCode.trim() || null,
      admin_pin: formAdminPin,
      reception_pin: formReceptionPin || null,
      consultation_fee: parseInt(formConsultationFee) || 200,
      status: "active",
      timezone: "Asia/Kolkata",
      currency: "INR",
    }
    if (formWhatsAppPhoneId.trim()) payload.whatsapp_phone_id = formWhatsAppPhoneId.trim()
    if (formWhatsAppNumber.trim()) payload.whatsapp_phone_number = formWhatsAppNumber.trim()
    if (formWhatsAppDisplayName.trim()) payload.whatsapp_display_name = formWhatsAppDisplayName.trim()
    if (formBotName.trim()) payload.bot_name = formBotName.trim()
    if (formLogoUrl) payload.logo_url = formLogoUrl

    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create branch")

      toast.success(`Branch "${formHospitalName}" created (${tenantId})`)
      resetBranchForm()
      setShowBranchForm(false)
      fetchData()
    } catch {
      toast.error("Failed to create branch")
    } finally {
      setSaving(false)
    }
  }, [
    formHospitalName,
    formCity,
    formBranchCode,
    formAdminPin,
    formReceptionPin,
    formConsultationFee,
    formWhatsAppPhoneId,
    formWhatsAppNumber,
    formWhatsAppDisplayName,
    formBotName,
    clientId,
    fetchData,
  ])

  const openEditBranch = (branch: Tenant) => {
    setEditBranch(branch)
    setFormHospitalName(branch.hospital_name)
    setFormCity(branch.city || "")
    setFormBranchCode(branch.branch_code || "")
    setFormAdminPin("")
    setFormReceptionPin("")
    setFormConsultationFee(String(branch.consultation_fee || 200))
    setFormWhatsAppPhoneId(branch.whatsapp_phone_id || "")
    setFormWhatsAppNumber(branch.whatsapp_phone_number || "")
    setFormWhatsAppDisplayName(branch.whatsapp_display_name || "")
    setFormBotName(branch.bot_name || "")
    setFormLogoUrl(branch.logo_url || "")
    setShowEditForm(true)
  }

  const handleEditBranch = useCallback(async () => {
    if (!editBranch) return
    if (!formHospitalName.trim()) {
      toast.error("Hospital name is required")
      return
    }

    setEditSaving(true)
    const updates: Record<string, unknown> = {
      action: "updateBranch",
      tenant_id: editBranch.tenant_id,
      hospital_name: formHospitalName.trim(),
      city: formCity.trim() || null,
      branch_code: formBranchCode.trim() || null,
      consultation_fee: parseInt(formConsultationFee) || 200,
      whatsapp_phone_id: formWhatsAppPhoneId.trim() || null,
      whatsapp_phone_number: formWhatsAppNumber.trim() || null,
      whatsapp_display_name: formWhatsAppDisplayName.trim() || null,
      bot_name: formBotName.trim() || null,
      logo_url: formLogoUrl || null,
    }
    if (formAdminPin) updates.admin_pin = formAdminPin
    if (formReceptionPin) updates.reception_pin = formReceptionPin

    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update branch")

      toast.success(`Branch "${formHospitalName}" updated`)
      resetBranchForm()
      setShowEditForm(false)
      setEditBranch(null)
      fetchData()
    } catch {
      toast.error("Failed to update branch")
    } finally {
      setEditSaving(false)
    }
  }, [
    editBranch,
    formHospitalName,
    formCity,
    formBranchCode,
    formAdminPin,
    formReceptionPin,
    formConsultationFee,
    formWhatsAppPhoneId,
    formWhatsAppNumber,
    formWhatsAppDisplayName,
    formBotName,
    fetchData,
  ])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">
          {error ? "Failed to load client" : "Client not found"}
        </h2>
        <p className="text-muted-foreground mb-4">
          {error
            ? "Please check your connection and refresh the page."
            : "The requested client could not be found."}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/platform/clients")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/platform/clients")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
        </Button>
      </motion.div>

      {/* Client Header */}
      <SectionHeader
        variant="glass"
        icon={<Building2 className="w-6 h-6" />}
        gradient="gradient-blue"
        title={client.name}
        subtitle={`Client ID: ${client.client_id}`}
        badge={
          <Badge
            variant="secondary"
            className={PLAN_BADGE[client.subscription_plan] || ""}
          >
            {client.subscription_plan}
          </Badge>
        }
        action={
          <Badge
            variant="secondary"
            className={STATUS_BADGE[client.status] || ""}
          >
            {client.status}
          </Badge>
        }
      />

      {/* Client Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* General Info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="card-hover h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Slug</span>
                <span className="text-sm font-mono">{client.slug}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Plan</span>
                <Badge
                  variant="outline"
                  className="capitalize"
                >
                  {client.subscription_plan}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Max Branches
                </span>
                <span className="text-sm font-mono">
                  {client.max_branches}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge
                  variant="secondary"
                  className={STATUS_BADGE[client.status] || ""}
                >
                  {client.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {client.created_at
                    ? new Date(client.created_at).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "-"}
                </span>
              </div>
              {client.trial_ends_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Trial Ends
                  </span>
                  <span className="text-xs text-amber-600 font-medium">
                    {new Date(client.trial_ends_at).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="card-hover h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gradient-green flex items-center justify-center text-white">
                  <User className="w-3.5 h-3.5" />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.contact_name ? (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{client.contact_name}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No contact name set
                </p>
              )}
              {client.contact_email ? (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{client.contact_email}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No email set
                </p>
              )}
              {client.contact_phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{client.contact_phone}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No phone set
                </p>
              )}
              {client.admin_pin && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Admin PIN configured
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Branches Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Branches</h2>
              <Badge variant="secondary" className="text-xs">
                {branches.length} / {client.max_branches}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => {
                resetBranchForm()
                setShowBranchForm(true)
              }}
              disabled={branches.length >= client.max_branches}
              className="gradient-green text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Branch
            </Button>
          </div>

          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Branch Code</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      </motion.div>
                      No branches yet. Add the first branch for this client.
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch, idx) => (
                    <motion.tr
                      key={branch.tenant_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-accent/30 border-b transition-colors duration-150"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl gradient-green flex items-center justify-center text-white font-bold text-sm">
                            {branch.hospital_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <p className="font-medium text-sm">
                            {branch.hospital_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          {branch.city || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {branch.branch_code ? (
                          <div className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-mono">
                              {branch.branch_code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {branch.tenant_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-mono">
                          <IndianRupee className="w-3 h-3 text-muted-foreground" />
                          {branch.consultation_fee || 200}
                        </div>
                      </TableCell>
                      <TableCell>
                        {branch.whatsapp_phone_id ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">
                              Connected
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not set
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_BADGE[branch.status] || ""}
                        >
                          {branch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditBranch(branch)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* Add Branch Dialog */}
      <PremiumDialog
        open={showBranchForm}
        onOpenChange={() => {
          setShowBranchForm(false)
          resetBranchForm()
        }}
        title="Add Branch"
        subtitle={`New branch for ${client.name}`}
        icon={<GitBranch className="w-5 h-5" />}
        gradient="gradient-green"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-1.5">
            <Label>Hospital Logo</Label>
            <LogoUpload
              currentUrl={formLogoUrl || null}
              pathPrefix={`branches/${clientId}`}
              onUpload={(url) => setFormLogoUrl(url)}
              onRemove={() => setFormLogoUrl("")}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Hospital Name *</Label>
              <Input
                placeholder="Care Hospital - Hyderabad"
                value={formHospitalName}
                onChange={(e) => setFormHospitalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                placeholder="Hyderabad"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch Code</Label>
              <Input
                placeholder="HYD-01"
                value={formBranchCode}
                onChange={(e) => setFormBranchCode(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Consultation Fee (Rs)</Label>
              <Input
                type="number"
                value={formConsultationFee}
                onChange={(e) => setFormConsultationFee(e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Admin PIN *</Label>
              <Input
                type="password"
                placeholder="4-6 digit PIN"
                value={formAdminPin}
                onChange={(e) => setFormAdminPin(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Reception PIN</Label>
              <Input
                type="password"
                placeholder="4-6 digit PIN (optional)"
                value={formReceptionPin}
                onChange={(e) => setFormReceptionPin(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>

          {/* WhatsApp Configuration */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                WhatsApp Configuration (Optional)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="991831654013001"
                  value={formWhatsAppPhoneId}
                  onChange={(e) => setFormWhatsAppPhoneId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  placeholder="+918125442376"
                  value={formWhatsAppNumber}
                  onChange={(e) => setFormWhatsAppNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  placeholder="Care Hospital"
                  value={formWhatsAppDisplayName}
                  onChange={(e) => setFormWhatsAppDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bot Name</Label>
                <Input
                  placeholder="Advera"
                  value={formBotName}
                  onChange={(e) => setFormBotName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            A unique Tenant ID will be generated automatically (e.g. T1709123456789).
            WhatsApp API URL is auto-computed from Phone Number ID.
          </p>

          <Button
            onClick={handleAddBranch}
            disabled={saving}
            className="w-full gradient-green text-white hover:opacity-90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Branch
          </Button>
        </div>
      </PremiumDialog>

      {/* Edit Branch Dialog */}
      <PremiumDialog
        open={showEditForm}
        onOpenChange={() => {
          setShowEditForm(false)
          setEditBranch(null)
          resetBranchForm()
        }}
        title="Edit Branch"
        subtitle={editBranch ? `${editBranch.hospital_name} (${editBranch.tenant_id})` : ""}
        icon={<Pencil className="w-5 h-5" />}
        gradient="gradient-blue"
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-1.5">
            <Label>Hospital Logo</Label>
            <LogoUpload
              currentUrl={formLogoUrl || null}
              pathPrefix={`branches/${editBranch?.tenant_id || "new"}`}
              onUpload={(url) => setFormLogoUrl(url)}
              onRemove={() => setFormLogoUrl("")}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Hospital Name *</Label>
              <Input
                placeholder="Care Hospital - Hyderabad"
                value={formHospitalName}
                onChange={(e) => setFormHospitalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                placeholder="Hyderabad"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch Code</Label>
              <Input
                placeholder="HYD-01"
                value={formBranchCode}
                onChange={(e) => setFormBranchCode(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Consultation Fee (Rs)</Label>
              <Input
                type="number"
                value={formConsultationFee}
                onChange={(e) => setFormConsultationFee(e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Admin PIN</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep current"
                value={formAdminPin}
                onChange={(e) => setFormAdminPin(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Reception PIN</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep current"
                value={formReceptionPin}
                onChange={(e) => setFormReceptionPin(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>

          {/* WhatsApp Configuration */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                WhatsApp Configuration
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="991831654013001"
                  value={formWhatsAppPhoneId}
                  onChange={(e) => setFormWhatsAppPhoneId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  placeholder="+918125442376"
                  value={formWhatsAppNumber}
                  onChange={(e) => setFormWhatsAppNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  placeholder="Care Hospital"
                  value={formWhatsAppDisplayName}
                  onChange={(e) => setFormWhatsAppDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bot Name</Label>
                <Input
                  placeholder="Advera"
                  value={formBotName}
                  onChange={(e) => setFormBotName(e.target.value)}
                />
              </div>
            </div>
            {editBranch?.wa_api_url && (
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                API URL: {editBranch.wa_api_url}
              </p>
            )}
          </div>

          <Button
            onClick={handleEditBranch}
            disabled={editSaving}
            className="w-full gradient-blue text-white hover:opacity-90"
          >
            {editSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Pencil className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </PremiumDialog>
    </div>
  )
}
