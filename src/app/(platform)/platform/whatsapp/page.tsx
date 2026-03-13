"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Building2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/types/auth"

interface WaRoute {
  phone_number_id: string
  client_id: string
  branch_id: string | null
  wa_access_token: string
  wa_display_name: string | null
  status: string
  created_at: string
}

interface BranchOption {
  tenant_id: string
  hospital_name: string
  client_id: string
  wa_token?: string
}

interface ClientOption {
  client_id: string
  name: string
}

export default function WhatsAppRoutingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as SessionUser | undefined

  const [routes, setRoutes] = useState<WaRoute[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<WaRoute | null>(null)

  // Form state
  const [formPhoneId, setFormPhoneId] = useState("")
  const [formClientId, setFormClientId] = useState("")
  const [formBranchId, setFormBranchId] = useState("")
  const [formToken, setFormToken] = useState("")
  const [formDisplayName, setFormDisplayName] = useState("")

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/unauthorized")
    }
  }, [user, router])

  const loadData = async () => {
    try {
      const res = await fetch("/api/platform?scope=whatsapp-routing")
      const data = await res.json()
      setRoutes(data.routes || [])
      setBranches(data.branches || [])
      setClients(data.clients || [])
    } catch (e) {
      console.error("Failed to load WhatsApp routing data:", e)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openAdd = () => {
    setEditTarget(null)
    setFormPhoneId("")
    setFormClientId("")
    setFormBranchId("")
    // Auto-fill token from existing route or tenant (same WABA = same token)
    const existingToken = routes.find(r => r.wa_access_token)?.wa_access_token
      || branches.find(b => b.wa_token)?.wa_token || ""
    setFormToken(existingToken)
    setFormDisplayName("")
    setDialogOpen(true)
  }

  const openEdit = (route: WaRoute) => {
    setEditTarget(route)
    setFormPhoneId(route.phone_number_id)
    setFormClientId(route.client_id)
    setFormBranchId(route.branch_id || "")
    setFormToken(route.wa_access_token)
    setFormDisplayName(route.wa_display_name || "")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formPhoneId || !formClientId || !formToken) {
      toast.error("Phone Number ID, Client, and Access Token are required")
      return
    }
    setSaving(true)

    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveWhatsAppRoute",
          phone_number_id: formPhoneId,
          client_id: formClientId,
          branch_id: formBranchId || null,
          wa_access_token: formToken,
          wa_display_name: formDisplayName || null,
          edit: !!editTarget,
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error("Failed to save", { description: result.error || "Unknown error" })
      } else {
        toast.success(editTarget ? "Route updated" : "Route created — tenant config updated automatically")
        setDialogOpen(false)
        loadData()
      }
    } catch (e) {
      toast.error("Failed to save", { description: String(e) })
    }

    setSaving(false)
  }

  const handleDelete = async (phoneId: string) => {
    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteWhatsAppRoute", phone_number_id: phoneId }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error("Failed to delete", { description: result.error || "Unknown error" })
      } else {
        toast.success("Route removed")
        loadData()
      }
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
  }

  const getClientName = (clientId: string) => clients.find(c => c.client_id === clientId)?.name || clientId
  const getBranchName = (branchId: string | null) => branches.find(b => b.tenant_id === branchId)?.hospital_name || branchId || "—"

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const activeRoutes = routes.filter(r => r.status === "active").length
  const clientBranches = formClientId ? branches.filter(b => b.client_id === formClientId) : []

  return (
    <div className="space-y-6">
      <SectionHeader
        variant="glass"
        icon={<MessageSquare className="w-6 h-6" />}
        gradient="gradient-green"
        title="WhatsApp Routing"
        subtitle="Map WhatsApp phone numbers to hospital branches"
        action={
          <Button onClick={openAdd} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" />
            Add Route
          </Button>
        }
      />

      {/* Stats */}
      <div className="flex gap-3">
        <Card className="border-0 shadow-sm flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{routes.length}</p>
              <p className="text-xs text-muted-foreground">Total Routes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeRoutes}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routing Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number ID</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No WhatsApp routes configured</p>
                      <p className="text-xs mt-1">Add a route to connect a WhatsApp number to a hospital branch</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route, i) => (
                    <motion.tr
                      key={route.phone_number_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b hover:bg-accent/30 transition-colors"
                    >
                      <TableCell className="font-mono text-sm">{route.phone_number_id}</TableCell>
                      <TableCell className="text-sm">{route.wa_display_name || "—"}</TableCell>
                      <TableCell>
                        <span className="text-sm flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {getClientName(route.client_id)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{getBranchName(route.branch_id)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px]",
                          route.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-700"
                        )}>
                          {route.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(route)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(route.phone_number_id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* How It Works */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-2">How WhatsApp Routing Works</h3>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Register a WhatsApp Business number in Meta Business Suite</li>
            <li>Get the <code className="bg-muted px-1 rounded">phone_number_id</code> from WhatsApp Business API settings</li>
            <li>Add a route here mapping that number to a client and branch</li>
            <li>Set the webhook URL in Meta to: <code className="bg-muted px-1 rounded">https://app.ainewworld.in/api/whatsapp/webhook</code></li>
            <li>Incoming messages will be routed to the correct hospital automatically</li>
            <li>New numbers under the same WABA work instantly — no webhook setup needed</li>
          </ol>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <PremiumDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editTarget ? "Edit Route" : "Add WhatsApp Route"}
        subtitle="Map a WhatsApp phone number to a hospital branch"
      >
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">Phone Number ID *</Label>
            <Input
              value={formPhoneId}
              onChange={(e) => setFormPhoneId(e.target.value)}
              placeholder="e.g. 991831654013001"
              className="mt-1"
              disabled={!!editTarget}
            />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="e.g. Care Hospital Bot"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Client *</Label>
            <Select value={formClientId} onValueChange={(v) => { setFormClientId(v); setFormBranchId("") }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.client_id} value={c.client_id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formClientId && (
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={formBranchId} onValueChange={setFormBranchId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  {clientBranches.map(b => (
                    <SelectItem key={b.tenant_id} value={b.tenant_id}>{b.hospital_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Access Token *</Label>
            <Input
              value={formToken}
              onChange={(e) => setFormToken(e.target.value)}
              placeholder="WhatsApp Cloud API access token"
              className="mt-1"
              type="password"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editTarget ? "Update Route" : "Create Route"}
          </Button>
        </div>
      </PremiumDialog>
    </div>
  )
}
