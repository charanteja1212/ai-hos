"use client"

import { useState } from "react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { PremiumDialog } from "@/components/shared/premium-dialog"
import { LogoUpload } from "@/components/shared/logo-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Rocket,
  Building2,
  GitBranch,
  Shield,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
} from "lucide-react"

interface OnboardingWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

const STEPS = [
  { id: "client", label: "Client Info", icon: Building2 },
  { id: "branch", label: "First Branch", icon: GitBranch },
  { id: "config", label: "Configuration", icon: Shield },
]

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

export function OnboardingWizard({ open, onOpenChange, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [createdData, setCreatedData] = useState<{ clientId: string; tenantId: string } | null>(null)

  // Step 1: Client info
  const [clientName, setClientName] = useState("")
  const [clientSlug, setClientSlug] = useState("")
  const [tier, setTier] = useState("basic")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  // Step 2: First branch
  const [hospitalName, setHospitalName] = useState("")
  const [city, setCity] = useState("")
  const [branchCode, setBranchCode] = useState("")
  const [consultationFee, setConsultationFee] = useState("200")
  const [logoUrl, setLogoUrl] = useState("")

  // Step 3: Configuration
  const [adminPin, setAdminPin] = useState("")
  const [receptionPin, setReceptionPin] = useState("")
  const [waPhoneId, setWaPhoneId] = useState("")
  const [waPhoneNumber, setWaPhoneNumber] = useState("")

  const reset = () => {
    setStep(0)
    setDone(false)
    setCreatedData(null)
    setClientName("")
    setClientSlug("")
    setTier("basic")
    setContactName("")
    setContactEmail("")
    setContactPhone("")
    setHospitalName("")
    setCity("")
    setBranchCode("")
    setConsultationFee("200")
    setLogoUrl("")
    setAdminPin("")
    setReceptionPin("")
    setWaPhoneId("")
    setWaPhoneNumber("")
  }

  const validate = (): boolean => {
    if (step === 0) {
      if (!clientName.trim()) { toast.error("Client name is required"); return false }
      return true
    }
    if (step === 1) {
      if (!hospitalName.trim()) { toast.error("Hospital name is required"); return false }
      return true
    }
    if (step === 2) {
      if (!adminPin || adminPin.length < 4) { toast.error("Admin PIN (4-6 digits) is required"); return false }
      return true
    }
    return true
  }

  const handleNext = () => {
    if (!validate()) return
    if (step === 0 && !clientSlug) setClientSlug(slugify(clientName))
    if (step === 0 && !hospitalName) setHospitalName(clientName)
    setStep((s) => Math.min(s + 1, 2))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!validate()) return

    setSaving(true)
    const clientId = `CL${Date.now()}`
    const tenantId = `T${Date.now()}`

    try {
      // 1. Create client
      const clientRes = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createClient",
          client_id: clientId,
          name: clientName.trim(),
          slug: clientSlug || slugify(clientName),
          subscription_plan: tier,
          tier,
          max_branches: tier === "basic" ? 1 : tier === "medium" ? 2 : 999,
          admin_pin: adminPin,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          status: "active",
        }),
      })
      if (!clientRes.ok) throw new Error("Failed to create client")

      // 2. Create first branch
      const branchPayload: Record<string, unknown> = {
        action: "createBranch",
        tenant_id: tenantId,
        client_id: clientId,
        hospital_name: hospitalName.trim(),
        city: city.trim() || null,
        branch_code: branchCode.trim() || null,
        admin_pin: adminPin,
        reception_pin: receptionPin || null,
        consultation_fee: parseInt(consultationFee) || 200,
        status: "active",
        timezone: "Asia/Kolkata",
        currency: "INR",
        logo_url: logoUrl || null,
      }
      if (waPhoneId.trim()) branchPayload.whatsapp_phone_id = waPhoneId.trim()
      if (waPhoneNumber.trim()) branchPayload.whatsapp_phone_number = waPhoneNumber.trim()

      const branchRes = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchPayload),
      })
      if (!branchRes.ok) throw new Error("Failed to create branch")

      setCreatedData({ clientId, tenantId })
      setDone(true)
      toast.success("Client onboarded successfully")
    } catch (err) {
      console.error("[onboarding]", err)
      toast.error("Onboarding failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PremiumDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      title={done ? "Onboarding Complete" : "Onboard New Client"}
      subtitle={done ? "Client is ready to use" : `Step ${step + 1} of 3 — ${STEPS[step].label}`}
      icon={<Rocket className="w-5 h-5" />}
      gradient="gradient-purple"
      maxWidth="sm:max-w-xl"
    >
      {done && createdData ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold mb-2">{clientName}</h3>
          <div className="space-y-1 text-sm text-muted-foreground mb-6">
            <p>Client ID: <span className="font-mono text-foreground">{createdData.clientId}</span></p>
            <p>Branch ID: <span className="font-mono text-foreground">{createdData.tenantId}</span></p>
            <p>Admin PIN: <span className="font-mono text-foreground">{adminPin}</span></p>
            {receptionPin && <p>Reception PIN: <span className="font-mono text-foreground">{receptionPin}</span></p>}
          </div>
          <Button
            onClick={() => {
              reset()
              onOpenChange(false)
              onComplete?.()
            }}
            className="gradient-purple text-white hover:opacity-90"
          >
            Done
          </Button>
        </div>
      ) : (
        <>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i < step ? "bg-green-100 text-green-600" :
                  i === step ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? "font-semibold" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${i < step ? "bg-green-300" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {/* Step 1: Client Info */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Client / Hospital Group Name *</Label>
                    <Input
                      placeholder="e.g. Sunrise Healthcare"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value)
                        setClientSlug(slugify(e.target.value))
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tier / Plan *</Label>
                    <Select value={tier} onValueChange={setTier}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic — Solo / Small Clinic (Rs 1,500-2,500/mo)</SelectItem>
                        <SelectItem value="medium">Medium — Multi-Doctor (Rs 8,000-15,000/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise — Multi-Specialty (Rs 20,000-80,000/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Contact Name</Label>
                      <Input placeholder="Dr. John" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" placeholder="admin@hospital.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input placeholder="+91..." value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: First Branch */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Hospital Logo</Label>
                    <LogoUpload
                      currentUrl={logoUrl || null}
                      pathPrefix={`branches/onboarding-${Date.now()}`}
                      onUpload={(url) => setLogoUrl(url)}
                      onRemove={() => setLogoUrl("")}
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hospital / Branch Name *</Label>
                    <Input
                      placeholder="Sunrise Clinic - Main Branch"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input placeholder="Hyderabad" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Branch Code</Label>
                      <Input placeholder="HYD-01" className="font-mono" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Consultation Fee (Rs)</Label>
                      <Input type="number" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} min="0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Configuration */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Admin PIN * (4-6 digits)</Label>
                      <Input
                        type="password"
                        placeholder="e.g. 1234"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reception PIN (optional)</Label>
                      <Input
                        type="password"
                        placeholder="e.g. 5678"
                        value={receptionPin}
                        onChange={(e) => setReceptionPin(e.target.value)}
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        WhatsApp (Optional — can configure later)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Phone Number ID</Label>
                        <Input
                          placeholder="From Meta Business Suite"
                          value={waPhoneId}
                          onChange={(e) => setWaPhoneId(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone Number</Label>
                        <Input
                          placeholder="+91..."
                          value={waPhoneNumber}
                          onChange={(e) => setWaPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {step < 2 ? (
              <Button onClick={handleNext} className="gap-1.5 gradient-purple text-white hover:opacity-90">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving} className="gap-1.5 gradient-purple text-white hover:opacity-90">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                Create Client
              </Button>
            )}
          </div>
        </>
      )}
    </PremiumDialog>
  )
}
