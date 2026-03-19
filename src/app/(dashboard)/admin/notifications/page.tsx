"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { createBrowserClient } from "@/lib/supabase/client"
import { logAuditClient } from "@/lib/audit-client"
import { isPushSupported, requestPermission, subscribeToPush } from "@/lib/push-notifications"
import { SectionHeader } from "@/components/shared/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Bell, BellRing, MessageSquare, Mail, Smartphone, Save, Loader2, CheckCircle, XCircle, Shield } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface NotificationConfig {
  push: {
    appointment_1hr: boolean
    appointment_24hr: boolean
    queue_updates: boolean
    payment_reminders: boolean
    lab_results_ready: boolean
    prescription_ready: boolean
    doctor_schedule_changes: boolean
  }
  whatsapp: {
    appointment_confirmation: boolean
    appointment_reminders: boolean
    prescription_ready: boolean
    lab_results: boolean
  }
  email: {
    daily_summary: boolean
    weekly_analytics: boolean
    low_inventory_alerts: boolean
  }
}

const DEFAULT_CONFIG: NotificationConfig = {
  push: {
    appointment_1hr: true,
    appointment_24hr: true,
    queue_updates: true,
    payment_reminders: true,
    lab_results_ready: true,
    prescription_ready: true,
    doctor_schedule_changes: true,
  },
  whatsapp: {
    appointment_confirmation: true,
    appointment_reminders: true,
    prescription_ready: false,
    lab_results: false,
  },
  email: {
    daily_summary: false,
    weekly_analytics: true,
    low_inventory_alerts: true,
  },
}

const PUSH_LABELS: Record<keyof NotificationConfig["push"], { label: string; desc: string }> = {
  appointment_1hr: { label: "1 Hour Before Appointment", desc: "Remind patients 1 hour before" },
  appointment_24hr: { label: "24 Hours Before Appointment", desc: "Remind patients 24 hours before" },
  queue_updates: { label: "Queue Updates", desc: "Notify when patient turn is approaching" },
  payment_reminders: { label: "Payment Reminders", desc: "Unpaid invoices older than 7 days" },
  lab_results_ready: { label: "Lab Results Ready", desc: "Notify when lab results are available" },
  prescription_ready: { label: "Prescription Ready", desc: "Notify when prescription is ready for pickup" },
  doctor_schedule_changes: { label: "Doctor Schedule Changes", desc: "Alert when doctor schedule is modified" },
}

const WA_LABELS: Record<keyof NotificationConfig["whatsapp"], { label: string; desc: string }> = {
  appointment_confirmation: { label: "Appointment Confirmation", desc: "Send confirmation via WhatsApp" },
  appointment_reminders: { label: "Appointment Reminders", desc: "Reminder messages before visit" },
  prescription_ready: { label: "Prescription Ready", desc: "Notify when prescription is ready" },
  lab_results: { label: "Lab Results", desc: "Share lab results via WhatsApp" },
}

const EMAIL_LABELS: Record<keyof NotificationConfig["email"], { label: string; desc: string }> = {
  daily_summary: { label: "Daily Summary Report", desc: "Receive daily hospital activity summary" },
  weekly_analytics: { label: "Weekly Analytics Report", desc: "Weekly performance and analytics digest" },
  low_inventory_alerts: { label: "Low Inventory Alerts", desc: "Pharmacy stock below threshold" },
}

export default function NotificationsPage() {
  const { data: session } = useSession()
  const user = session?.user as { email?: string; role?: string; id?: string } | undefined
  const { activeTenantId: tenantId } = useBranch()

  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default")
  const [pushSupported, setPushSupported] = useState(false)

  // Check push support and permission on mount
  useEffect(() => {
    const supported = isPushSupported()
    setPushSupported(supported)
    if (supported) setPushPermission(Notification.permission)
  }, [])

  // Load notification config from tenants table
  useEffect(() => {
    if (!tenantId) return
    const supabase = createBrowserClient()
    supabase
      .from("tenants")
      .select("notification_config")
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        if (data?.notification_config) {
          setConfig({ ...DEFAULT_CONFIG, ...data.notification_config })
        }
        setLoading(false)
      })
  }, [tenantId])

  const handleRequestPermission = useCallback(async () => {
    const permission = await requestPermission()
    setPushPermission(permission)
    if (permission === "granted" && user?.id) {
      await subscribeToPush(user.id, tenantId)
      toast.success("Push notifications enabled")
    } else if (permission === "denied") {
      toast.error("Notification permission denied. Please enable in browser settings.")
    }
  }, [user?.id, tenantId])

  const updateConfig = useCallback(
    <S extends keyof NotificationConfig>(section: S, key: keyof NotificationConfig[S], value: boolean) => {
      setConfig((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
    },
    []
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    const supabase = createBrowserClient()
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ notification_config: config })
        .eq("tenant_id", tenantId)
      if (error) throw error
      logAuditClient({
        action: "update",
        entityType: "notification_config",
        entityId: tenantId,
        actorEmail: user?.email || "admin",
        actorRole: user?.role || "ADMIN",
        tenantId,
        details: { config },
      })
      toast.success("Notification preferences saved")
    } catch (err) {
      console.error("[notifications] Failed to save:", err)
      toast.error("Failed to save notification preferences")
    } finally {
      setSaving(false)
    }
  }, [config, tenantId, user?.email, user?.role])

  const permissionBadge = pushPermission === "granted"
    ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" />Granted</Badge>
    : pushPermission === "denied"
    ? <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>
    : <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" />Not Requested</Badge>

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        variant="glass"
        icon={<Bell className="w-6 h-6" />}
        gradient="gradient-blue"
        title="Notification Preferences"
        subtitle="Configure how your hospital sends notifications to patients and staff"
      />

      {/* Push Notification Status */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              Push Notification Status
              {permissionBadge}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!pushSupported ? (
              <p className="text-sm text-muted-foreground">Push notifications are not supported in this browser.</p>
            ) : pushPermission === "granted" ? (
              <p className="text-sm text-muted-foreground">Push notifications are active on this device.</p>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Enable push notifications to receive real-time alerts.</p>
                <Button size="sm" onClick={handleRequestPermission}>
                  <BellRing className="w-4 h-4 mr-1" /> Enable Push
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Push Notification Channels */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white">
                <BellRing className="w-3.5 h-3.5" />
              </div>
              Notification Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(PUSH_LABELS) as (keyof NotificationConfig["push"])[]).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{PUSH_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{PUSH_LABELS[key].desc}</p>
                </div>
                <Switch checked={config.push[key]} onCheckedChange={(v) => updateConfig("push", key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* WhatsApp Notifications */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              WhatsApp Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">These settings control messages sent via the WhatsApp bot integration.</p>
            {(Object.keys(WA_LABELS) as (keyof NotificationConfig["whatsapp"])[]).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{WA_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{WA_LABELS[key].desc}</p>
                </div>
                <Switch checked={config.whatsapp[key]} onCheckedChange={(v) => updateConfig("whatsapp", key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Email Notifications */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                <Mail className="w-3.5 h-3.5" />
              </div>
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(EMAIL_LABELS) as (keyof NotificationConfig["email"])[]).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{EMAIL_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{EMAIL_LABELS[key].desc}</p>
                </div>
                <Switch checked={config.email[key]} onCheckedChange={(v) => updateConfig("email", key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Button */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full gradient-blue text-white hover:opacity-90">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Notification Preferences
        </Button>
      </motion.div>
    </div>
  )
}
