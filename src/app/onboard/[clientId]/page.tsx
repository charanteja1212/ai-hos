"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Shield,
  Stethoscope,
  ClipboardList,
  TestTube,
  Pill,
  ArrowLeft,
  Loader2,
  Heart,
  Activity,
  ChevronRight,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "role" | "branch" | "credentials"

interface RoleCard {
  id: string
  signInRole?: string
  label: string
  icon: React.ElementType
  color: string
  lightBg: string
  gradient: string
  description: string
}

interface Branch {
  tenant_id: string
  hospital_name: string
  city: string
  branch_code: string
  status: string
}

interface ClientInfo {
  client_id: string
  name: string
  slug: string
  logo_url: string | null
  status: string
}

// ---------------------------------------------------------------------------
// 5 Branch roles only
// ---------------------------------------------------------------------------

const roles: RoleCard[] = [
  {
    id: "BRANCH_ADMIN",
    signInRole: "ADMIN",
    label: "Admin",
    icon: Shield,
    color: "#0891B2",
    lightBg: "#EFF6FF",
    gradient: "from-cyan-600 to-cyan-800",
    description: "Hospital settings & config",
  },
  {
    id: "DOCTOR",
    label: "Doctor",
    icon: Stethoscope,
    color: "#059669",
    lightBg: "#ECFDF5",
    gradient: "from-emerald-500 to-emerald-700",
    description: "Consultations & prescriptions",
  },
  {
    id: "RECEPTION",
    label: "Reception",
    icon: ClipboardList,
    color: "#7C3AED",
    lightBg: "#F5F3FF",
    gradient: "from-violet-500 to-violet-700",
    description: "Queue & booking management",
  },
  {
    id: "LAB_TECH",
    label: "Lab",
    icon: TestTube,
    color: "#D97706",
    lightBg: "#FFFBEB",
    gradient: "from-amber-500 to-amber-700",
    description: "Sample tracking & reports",
  },
  {
    id: "PHARMACIST",
    label: "Pharmacy",
    icon: Pill,
    color: "#0891B2",
    lightBg: "#ECFEFF",
    gradient: "from-cyan-500 to-cyan-700",
    description: "Orders & stock management",
  },
]

// ---------------------------------------------------------------------------
// Redirect map
// ---------------------------------------------------------------------------

const redirectMap: Record<string, string> = {
  BRANCH_ADMIN: "/admin",
  ADMIN: "/admin",
  DOCTOR: "/doctor",
  RECEPTION: "/reception",
  LAB_TECH: "/lab",
  PHARMACIST: "/pharmacy",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.clientId as string

  const [step, setStep] = useState<Step>("role")
  const [selectedRole, setSelectedRole] = useState<RoleCard | null>(null)

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)

  const [loadingClient, setLoadingClient] = useState(true)
  const [clientNotFound, setClientNotFound] = useState(false)
  const loaded = useRef(false)

  const [pin, setPin] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [authMethod, setAuthMethod] = useState<"pin" | "password">("pin")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)

  // Fetch client info and branches on mount
  useEffect(() => {
    if (!clientId || loaded.current) return
    loaded.current = true
    ;(async () => {
      try {
        const [clientsRes, branchesRes] = await Promise.all([
          fetch("/api/auth/tenants").then((r) => r.json()),
          fetch(`/api/auth/tenants?clientId=${clientId}`).then((r) => r.json()),
        ])
        const matched = (clientsRes as ClientInfo[]).find(
          (c) => c.client_id === clientId
        )
        if (matched) {
          setClientInfo(matched)
          setBranches(branchesRes || [])
        } else {
          setClientNotFound(true)
        }
      } catch {
        setClientNotFound(true)
      } finally {
        setLoadingClient(false)
      }
    })()
  }, [clientId])

  // ---------------------------------------------------------------------------
  // Flow logic
  // ---------------------------------------------------------------------------

  const handleRoleSelect = useCallback(
    (role: RoleCard) => {
      setSelectedRole(role)
      setError("")
      setPin("")
      setDoctorId("")
      setLoginEmail("")
      setLoginPassword("")
      setAuthMethod("pin")

      if (branches.length === 0) {
        setError("No active branches found for this client.")
        return
      }
      if (branches.length === 1) {
        setSelectedBranch(branches[0])
        setStep("credentials")
      } else {
        setStep("branch")
      }
    },
    [branches]
  )

  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch)
    setError("")
    setStep("credentials")
  }

  const handleBack = () => {
    setError("")
    if (step === "credentials") {
      if (branches.length > 1) {
        setStep("branch")
      } else {
        setStep("role")
        setSelectedRole(null)
        setSelectedBranch(null)
      }
    } else if (step === "branch") {
      setStep("role")
      setSelectedRole(null)
      setSelectedBranch(null)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const signInRole = selectedRole?.signInRole || selectedRole?.id
      const result = await signIn("hospital-login", {
        redirect: false,
        loginMode: "branch",
        role: signInRole,
        tenantId: selectedBranch?.tenant_id,
        pin,
        identifier: doctorId || undefined,
      })

      if (result?.error) {
        setError("Invalid credentials. Please try again.")
      } else {
        router.push(redirectMap[selectedRole?.id || ""] || "/reception")
        router.refresh()
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const signInRole = selectedRole?.signInRole || selectedRole?.id
      const result = await signIn("hospital-login", {
        redirect: false,
        loginMode: "password",
        role: signInRole,
        tenantId: selectedBranch?.tenant_id,
        email: loginEmail,
        password: loginPassword,
      })

      if (result?.error) {
        setError("Invalid email or password.")
      } else {
        router.push(redirectMap[selectedRole?.id || ""] || "/reception")
        router.refresh()
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loadingClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (clientNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold mb-2">Client Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This onboard link is invalid or the client no longer exists.
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Left branded panel — desktop only */}
      <div className="hidden lg:flex w-[420px] shrink-0 bg-gradient-to-br from-cyan-700 via-cyan-800 to-indigo-800 text-white p-10 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              {clientInfo?.name || "Hospital"}
            </span>
          </div>

          <h1 className="text-3xl font-black leading-tight mb-4">
            Staff Login
          </h1>
          <p className="text-cyan-100/80 leading-relaxed">
            Select your role and sign in to access the hospital management system.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            { icon: Activity, text: "Real-time queue management" },
            { icon: Shield, text: "Secure role-based access" },
            { icon: Heart, text: "Patient-first workflows" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 text-cyan-100/70 text-sm">
              <item.icon className="w-4 h-4" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white">
              <Heart className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold">
              {clientInfo?.name || "Hospital"}
            </span>
          </div>

          {/* Back button */}
          {step !== "role" && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ───── STEP: Role Selection ───── */}
            {step === "role" && (
              <motion.div
                key="role"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold mb-1">Select your role</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose how you want to sign in
                </p>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  {roles.map((role, idx) => {
                    const Icon = role.icon
                    return (
                      <motion.button
                        key={role.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => handleRoleSelect(role)}
                        className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/50 transition-colors ${
                          idx < roles.length - 1 ? "border-b border-border/30" : ""
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: role.lightBg }}
                        >
                          <Icon className="w-5 h-5" style={{ color: role.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{role.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      </motion.button>
                    )
                  })}
                </div>

                {error && (
                  <p className="text-sm text-destructive mt-4 text-center">{error}</p>
                )}
              </motion.div>
            )}

            {/* ───── STEP: Branch Selection ───── */}
            {step === "branch" && (
              <motion.div
                key="branch"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold mb-1">Select branch</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose the hospital branch
                </p>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  {branches.map((branch, idx) => (
                    <motion.button
                      key={branch.tenant_id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => handleBranchSelect(branch)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/50 transition-colors ${
                        idx < branches.length - 1 ? "border-b border-border/30" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {branch.hospital_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{branch.hospital_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {branch.city || branch.branch_code || branch.tenant_id}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </motion.button>
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-destructive mt-4 text-center">{error}</p>
                )}
              </motion.div>
            )}

            {/* ───── STEP: Credentials ───── */}
            {step === "credentials" && selectedRole && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: selectedRole.lightBg }}
                  >
                    <selectedRole.icon
                      className="w-5 h-5"
                      style={{ color: selectedRole.color }}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedRole.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBranch?.hospital_name}
                      {selectedBranch?.city ? ` — ${selectedBranch.city}` : ""}
                    </p>
                  </div>
                </div>

                {/* Auth method toggle */}
                <div className="flex gap-2 mb-5">
                  <Button
                    variant={authMethod === "pin" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setAuthMethod("pin")}
                  >
                    <KeyRound className="w-3.5 h-3.5" /> PIN
                  </Button>
                  <Button
                    variant={authMethod === "password" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setAuthMethod("password")}
                  >
                    <Lock className="w-3.5 h-3.5" /> Password
                  </Button>
                </div>

                {authMethod === "pin" ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    {selectedRole.id === "DOCTOR" && (
                      <div className="space-y-1.5">
                        <Label>Doctor ID (optional)</Label>
                        <Input
                          placeholder="e.g. DOC001"
                          value={doctorId}
                          onChange={(e) => setDoctorId(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>PIN</Label>
                      <div className="relative">
                        <Input
                          type={showPin ? "text" : "password"}
                          placeholder="Enter your PIN"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          maxLength={6}
                          autoFocus
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !pin}
                      className={`w-full bg-gradient-to-r ${selectedRole.gradient} text-white hover:opacity-90`}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <KeyRound className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@hospital.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !loginEmail || !loginPassword}
                      className={`w-full bg-gradient-to-r ${selectedRole.gradient} text-white hover:opacity-90`}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Lock className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
