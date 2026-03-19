"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import { logAuditClient } from "@/lib/audit-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Palette, Type, Image, Eye, Save, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { SectionHeader } from "@/components/shared/section-header"
import { FeatureGate } from "@/components/shared/feature-gate"
import { LogoUpload } from "@/components/shared/logo-upload"
import { cn } from "@/lib/utils"
import type { BrandingConfig } from "@/types/database"

const DEFAULT_CONFIG: BrandingConfig = {
  logo_url: "", primary_color: "#6366f1", secondary_color: "#8b5cf6",
  app_display_name: "", footer_text: "", login_welcome_message: "", show_powered_by: true,
}

export default function BrandingPage() {
  return (
    <FeatureGate feature="white_label" featureName="White Label Branding">
      <BrandingContent />
    </FeatureGate>
  )
}

function ColorField({ label, value, fallback, onChange }: {
  label: string; value?: string; fallback: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5" />
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)}
          placeholder={fallback} className="font-mono text-sm" maxLength={7} />
      </div>
    </div>
  )
}

function BrandingContent() {
  const { data: session } = useSession()
  const user = session?.user as { email?: string; role?: string } | undefined
  const { activeTenantId: tenantId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [original, setOriginal] = useState<BrandingConfig>(DEFAULT_CONFIG)
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createBrowserClient()
    supabase.from("tenants").select("branding_config, hospital_name")
      .eq("tenant_id", tenantId).single()
      .then(({ data }) => {
        const base = data?.branding_config
          ? { ...DEFAULT_CONFIG, ...data.branding_config }
          : { ...DEFAULT_CONFIG }
        if (!base.app_display_name) base.app_display_name = data?.hospital_name || ""
        setConfig(base)
        setOriginal(base)
        setLoading(false)
      })
  }, [tenantId])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(original)
  const update = useCallback((patch: Partial<BrandingConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!tenantId) return
    const hexRe = /^#[0-9a-fA-F]{6}$/
    if (!hexRe.test(config.primary_color || "")) { toast.error("Primary color must be a valid hex (e.g. #6366f1)"); return }
    if (!hexRe.test(config.secondary_color || "")) { toast.error("Secondary color must be a valid hex (e.g. #8b5cf6)"); return }
    setSaving(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("tenants").update({ branding_config: config }).eq("tenant_id", tenantId)
      if (error) throw error
      logAuditClient({
        action: "update", entityType: "branding_config", entityId: tenantId,
        actorEmail: user?.email || "admin", actorRole: user?.role || "ADMIN", tenantId,
        details: { app_display_name: config.app_display_name, show_powered_by: config.show_powered_by },
      })
      setOriginal({ ...config })
      toast.success("Branding settings saved")
    } catch (err) {
      console.error("[branding] Failed to save:", err)
      toast.error("Failed to save branding settings")
    } finally { setSaving(false) }
  }, [config, tenantId, user])

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        variant="glass" icon={<Palette className="w-6 h-6" />} gradient="gradient-purple"
        title="White Label Branding" subtitle="Customize your hospital's look and feel across the platform"
        action={hasChanges ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
            Unsaved changes
          </Badge>
        ) : undefined}
      />

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center text-white"><Image className="w-3.5 h-3.5" /></div>
              Hospital Logo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogoUpload currentUrl={config.logo_url || null} pathPrefix={`tenants/${tenantId}`}
              onUpload={(url) => update({ logo_url: url })} onRemove={() => update({ logo_url: "" })} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Brand Colors */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white"><Palette className="w-3.5 h-3.5" /></div>
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Primary Color" value={config.primary_color} fallback="#6366f1"
                onChange={(v) => update({ primary_color: v })} />
              <ColorField label="Secondary Color" value={config.secondary_color} fallback="#8b5cf6"
                onChange={(v) => update({ secondary_color: v })} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Text & Messaging */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-green flex items-center justify-center text-white"><Type className="w-3.5 h-3.5" /></div>
              Text & Messaging
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>App Display Name</Label>
              <Input value={config.app_display_name || ""} onChange={(e) => update({ app_display_name: e.target.value })} placeholder="My Hospital HMS" />
              <p className="text-xs text-muted-foreground">Shown in browser tab and PWA home screen</p>
            </div>
            <div className="space-y-1.5">
              <Label>Custom Footer Text</Label>
              <Input value={config.footer_text || ""} onChange={(e) => update({ footer_text: e.target.value })} placeholder="© 2026 My Hospital. All rights reserved." />
            </div>
            <div className="space-y-1.5">
              <Label>Login Page Welcome Message</Label>
              <Input value={config.login_welcome_message || ""} onChange={(e) => update({ login_welcome_message: e.target.value })} placeholder="Welcome to My Hospital Management System" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visibility Toggle */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-orange flex items-center justify-center text-white"><Eye className="w-3.5 h-3.5" /></div>
              Visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show &quot;Powered by AI-HOS&quot; badge</Label>
                <p className="text-xs text-muted-foreground mt-0.5">When disabled, all AI-HOS branding is hidden from your users</p>
              </div>
              <Switch checked={config.show_powered_by ?? true} onCheckedChange={(v) => update({ show_powered_by: v })} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Preview */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="card-hover rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white"><Eye className="w-3.5 h-3.5" /></div>
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: config.primary_color || "#6366f1" }}>
                {config.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={config.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/20 p-0.5" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                    {(config.app_display_name || "H")[0]}
                  </div>
                )}
                <span className="text-white font-semibold text-sm truncate">{config.app_display_name || "Hospital HMS"}</span>
                <div className="ml-auto flex gap-1.5">
                  {[1, 2, 3].map((i) => <div key={i} className="w-6 h-2 rounded-full bg-white/20" />)}
                </div>
              </div>
              <div className="bg-muted/30 dark:bg-muted/10 p-4 space-y-2">
                <div className="flex gap-2"><div className="h-3 rounded-full bg-muted w-1/3" /><div className="h-3 rounded-full bg-muted w-1/4" /></div>
                <div className="h-16 rounded-lg bg-muted/60" />
                <div className="h-2 w-20 rounded-full mx-auto" style={{ background: config.secondary_color || "#8b5cf6" }} />
              </div>
              <div className={cn("px-4 py-2 text-[10px] text-center border-t border-border", "bg-white dark:bg-card text-muted-foreground")}>
                {config.footer_text || "\u00a9 2026 Hospital. All rights reserved."}
                {(config.show_powered_by ?? true) && <span className="ml-2 opacity-60">Powered by AI-HOS</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="lg"
          className={cn("w-full", hasChanges && "gradient-blue text-white hover:opacity-90")}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {hasChanges ? "Save Branding Settings" : "No Changes"}
        </Button>
      </motion.div>
    </div>
  )
}
