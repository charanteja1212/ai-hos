"use client"

import { useState, useCallback, useEffect, useRef, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Crown,
  Building2,
  Shield,
  Stethoscope,
  ClipboardList,
  ArrowLeft,
  Loader2,
  Heart,
  TestTube,
  Pill,
  KeyRound,
  Mail,
  Activity,
  ChevronRight,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoginMode = "super_admin" | "client_admin" | "branch"
type Step = "role" | "client" | "branch" | "credentials"

interface RoleCard {
  id: string
  signInRole?: string
  loginMode: LoginMode
  label: string
  icon: React.ElementType
  gradient: string
  accent: string
  glow: string
  description: string
}

interface Client {
  client_id: string
  name: string
  slug: string
  logo_url: string | null
  status: string
  branch_count?: number
}

interface Branch {
  tenant_id: string
  hospital_name: string
  city: string
  branch_code: string
  status: string
}

// ---------------------------------------------------------------------------
// Role definitions (7 cards)
// ---------------------------------------------------------------------------

const roles: RoleCard[] = [
  {
    id: "SUPER_ADMIN",
    loginMode: "super_admin",
    label: "Platform Admin",
    icon: Crown,
    gradient: "from-rose-500 to-orange-500",
    accent: "#F43F5E",
    glow: "rgba(244,63,94,0.15)",
    description: "Global platform management",
  },
  {
    id: "CLIENT_ADMIN",
    loginMode: "client_admin",
    label: "Client Admin",
    icon: Building2,
    gradient: "from-slate-400 to-slate-600",
    accent: "#94A3B8",
    glow: "rgba(148,163,184,0.12)",
    description: "Hospital group oversight",
  },
  {
    id: "BRANCH_ADMIN",
    signInRole: "ADMIN",
    loginMode: "branch",
    label: "Admin",
    icon: Shield,
    gradient: "from-blue-500 to-indigo-600",
    accent: "#007AFF",
    glow: "rgba(0,122,255,0.15)",
    description: "Hospital settings & config",
  },
  {
    id: "DOCTOR",
    loginMode: "branch",
    label: "Doctor",
    icon: Stethoscope,
    gradient: "from-emerald-500 to-green-600",
    accent: "#34C759",
    glow: "rgba(52,199,89,0.15)",
    description: "Consultations & prescriptions",
  },
  {
    id: "RECEPTION",
    loginMode: "branch",
    label: "Reception",
    icon: ClipboardList,
    gradient: "from-violet-500 to-purple-600",
    accent: "#AF52DE",
    glow: "rgba(175,82,222,0.15)",
    description: "Queue & booking management",
  },
  {
    id: "LAB_TECH",
    loginMode: "branch",
    label: "Lab",
    icon: TestTube,
    gradient: "from-amber-500 to-orange-600",
    accent: "#FF9500",
    glow: "rgba(255,149,0,0.15)",
    description: "Sample tracking & reports",
  },
  {
    id: "PHARMACIST",
    loginMode: "branch",
    label: "Pharmacy",
    icon: Pill,
    gradient: "from-cyan-500 to-teal-600",
    accent: "#5AC8FA",
    glow: "rgba(90,200,250,0.15)",
    description: "Orders & stock management",
  },
]

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: { opacity: 0, y: 16, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
}

const cardStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Direct client URL: /login?client=CL002
  const directClientId = searchParams.get("client")

  // Navigation state
  const [step, setStep] = useState<Step>("role")
  const [selectedRole, setSelectedRole] = useState<RoleCard | null>(null)

  // Picker data
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [fetchingClients, setFetchingClients] = useState(false)
  const [fetchingBranches, setFetchingBranches] = useState(false)

  // Pre-fetched direct client data
  const directClientLoaded = useRef(false)
  const [directClient, setDirectClient] = useState<Client | null>(null)
  const [directBranches, setDirectBranches] = useState<Branch[]>([])
  const [directClientLoading, setDirectClientLoading] = useState(!!directClientId)

  // Credentials
  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Password auth
  const [authMethod, setAuthMethod] = useState<"pin" | "password">("pin")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Pre-fetch client + branches when ?client= param is present
  useEffect(() => {
    if (!directClientId || directClientLoaded.current) return
    directClientLoaded.current = true

    ;(async () => {
      try {
        const [clientsRes, branchesRes] = await Promise.all([
          fetch("/api/auth/tenants").then((r) => r.json()),
          fetch(`/api/auth/tenants?clientId=${directClientId}`).then((r) => r.json()),
        ])
        const matched = (clientsRes as Client[]).find((c) => c.client_id === directClientId)
        if (matched) {
          setDirectClient(matched)
          setDirectBranches(branchesRes || [])
        }
      } finally {
        setDirectClientLoading(false)
      }
    })()
  }, [directClientId])

  // ---------------------------------------------------------------------------
  // Data fetching helpers
  // ---------------------------------------------------------------------------

  const fetchClients = useCallback(async (): Promise<Client[]> => {
    setFetchingClients(true)
    try {
      const res = await fetch("/api/auth/tenants")
      if (!res.ok) return []
      return await res.json()
    } finally {
      setFetchingClients(false)
    }
  }, [])

  const fetchBranches = useCallback(async (clientId: string): Promise<Branch[]> => {
    setFetchingBranches(true)
    try {
      const res = await fetch(`/api/auth/tenants?clientId=${clientId}`)
      if (!res.ok) return []
      return await res.json()
    } finally {
      setFetchingBranches(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Flow logic
  // ---------------------------------------------------------------------------

  const handleRoleSelect = async (role: RoleCard) => {
    setSelectedRole(role)
    setError("")

    if (role.loginMode === "super_admin") {
      setStep("credentials")
      return
    }

    // Direct client URL — skip client selection entirely
    if (directClient) {
      setSelectedClient(directClient)
      setClients([directClient])

      if (role.loginMode === "client_admin") {
        setStep("credentials")
        return
      }

      const branchList = directBranches
      setBranches(branchList)

      if (branchList.length === 0) {
        setError("No active branches found.")
        return
      }
      if (branchList.length === 1) {
        setSelectedBranch(branchList[0])
        setStep("credentials")
      } else {
        setStep("branch")
      }
      return
    }

    // Normal flow — fetch all clients
    const fetchedClients = await fetchClients()
    setClients(fetchedClients)

    if (fetchedClients.length === 0) {
      setError("No active clients found.")
      return
    }

    if (role.loginMode === "client_admin") {
      if (fetchedClients.length === 1) {
        setSelectedClient(fetchedClients[0])
        setStep("credentials")
      } else {
        setStep("client")
      }
      return
    }

    if (fetchedClients.length === 1) {
      const singleClient = fetchedClients[0]
      setSelectedClient(singleClient)
      const fetchedBranches = await fetchBranches(singleClient.client_id)
      setBranches(fetchedBranches)

      if (fetchedBranches.length === 0) {
        setError("No active branches found.")
        return
      }

      if (fetchedBranches.length === 1) {
        setSelectedBranch(fetchedBranches[0])
        setStep("credentials")
      } else {
        setStep("branch")
      }
    } else {
      setStep("client")
    }
  }

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client)
    setError("")

    if (selectedRole?.loginMode === "client_admin") {
      setStep("credentials")
      return
    }

    const fetchedBranches = await fetchBranches(client.client_id)
    setBranches(fetchedBranches)

    if (fetchedBranches.length === 0) {
      setError("No active branches for this client.")
      return
    }

    if (fetchedBranches.length === 1) {
      setSelectedBranch(fetchedBranches[0])
      setSelectedBranch(fetchedBranches[0])
      setStep("credentials")
    } else {
      setStep("branch")
    }
  }

  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch)
    setError("")
    setStep("credentials")
  }

  // ---------------------------------------------------------------------------
  // Login submit
  // ---------------------------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let result

      if (selectedRole?.loginMode === "super_admin") {
        result = await signIn("hospital-login", {
          redirect: false,
          loginMode: "super_admin",
          email,
          pin,
        })
      } else if (selectedRole?.loginMode === "client_admin") {
        result = await signIn("hospital-login", {
          redirect: false,
          loginMode: "client_admin",
          clientId: selectedClient?.client_id,
          pin,
        })
      } else {
        const signInRole = selectedRole?.signInRole || selectedRole?.id
        result = await signIn("hospital-login", {
          redirect: false,
          loginMode: "branch",
          role: signInRole,
          tenantId: selectedBranch?.tenant_id,
          pin,
          identifier: doctorId || undefined,
        })
      }

      if (result?.error) {
        setError("Invalid credentials. Please try again.")
      } else {
        const redirectMap: Record<string, string> = {
          SUPER_ADMIN: "/platform",
          CLIENT_ADMIN: "/admin",
          BRANCH_ADMIN: "/admin",
          ADMIN: "/admin",
          DOCTOR: "/doctor",
          RECEPTION: "/reception",
          LAB_TECH: "/lab",
          PHARMACIST: "/pharmacy",
        }
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
      const result = await signIn("hospital-login", {
        redirect: false,
        loginMode: "password",
        email: loginEmail,
        password: loginPassword,
      })

      if (result?.error) {
        setError("Invalid email or password.")
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Back navigation
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    setError("")

    // [TEMP] Back from doctor picker → go to branch or role
    if (step === "credentials") {
      setPin("")
      setEmail("")
      setDoctorId("")
      setLoginEmail("")
      setLoginPassword("")
      setAuthMethod("pin")

      if (selectedRole?.loginMode === "super_admin") {
        setStep("role")
        setSelectedRole(null)
        return
      }

      if (selectedRole?.loginMode === "client_admin") {
        if (clients.length <= 1) {
          setStep("role")
          setSelectedRole(null)
        } else {
          setStep("client")
        }
        return
      }

      if (branches.length > 1) {
        setSelectedBranch(null)
        setStep("branch")
      } else if (clients.length > 1) {
        setSelectedBranch(null)
        setSelectedClient(null)
        setStep("client")
      } else {
        setStep("role")
        setSelectedRole(null)
        setSelectedClient(null)
        setSelectedBranch(null)
      }
      return
    }

    if (step === "branch") {
      setSelectedBranch(null)
      if (clients.length > 1) {
        setSelectedClient(null)
        setStep("client")
      } else {
        setStep("role")
        setSelectedRole(null)
        setSelectedClient(null)
      }
      return
    }

    if (step === "client") {
      setStep("role")
      setSelectedRole(null)
      setSelectedClient(null)
      setSelectedBranch(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Derive active accent
  // ---------------------------------------------------------------------------

  const activeGradient = selectedRole?.gradient || "from-blue-500 to-indigo-600"
  const activeAccent = selectedRole?.accent || "#007AFF"
  const activeGlow = selectedRole?.glow || "rgba(0,122,255,0.15)"

  // ---------------------------------------------------------------------------
  // Shared back button
  // ---------------------------------------------------------------------------

  const BackButton = () => (
    <button
      onClick={handleBack}
      className="group flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-all duration-200 mb-6"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      <span className="text-xs font-medium tracking-wide">Back</span>
    </button>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[#060609] relative overflow-hidden select-none">
      {/* === Animated background === */}
      <div className="fixed inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,#0C1425,#060609)]" />

        {/* Floating orbs */}
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50vmax] h-[50vmax] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #007AFF, transparent 65%)", filter: "blur(60px)" }}
        />
        <motion.div
          animate={{ x: [0, -30, 20, 0], y: [0, 30, -40, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute -bottom-[20%] -right-[10%] w-[45vmax] h-[45vmax] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #AF52DE, transparent 65%)", filter: "blur(60px)" }}
        />
        <motion.div
          animate={{ x: [0, 20, -10, 0], y: [0, -20, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 10 }}
          className="absolute top-[40%] left-[60%] w-[30vmax] h-[30vmax] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #34C759, transparent 65%)", filter: "blur(60px)" }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* === Content === */}
      <div className="relative z-10 w-full max-w-[520px]">
        <AnimatePresence mode="wait">
          {/* ================================================================ */}
          {/* STEP: Role Selection                                             */}
          {/* ================================================================ */}
          {step === "role" && (
            <motion.div
              key="roles"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Logo */}
              <div className="text-center mb-10">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex relative"
                >
                  <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/25 relative overflow-hidden">
                    <Activity className="w-9 h-9 text-white relative z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40"
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </motion.div>
                </motion.div>

                <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  {directClient ? directClient.name : "AI-HOS"}
                </h1>
                <p className="mt-1.5 text-sm text-white/30 tracking-widest uppercase font-medium">
                  {directClient ? "Staff Login" : "Hospital Operating System"}
                </p>
              </div>

              {/* Role Grid - 4 cols on desktop, 2 on mobile */}
              {directClientLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                  <p className="text-sm text-white/30">Loading...</p>
                </div>
              ) : (
              <motion.div
                variants={cardStagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
              >
                {roles
                .filter((role) => !directClient || (role.loginMode !== "super_admin" && role.loginMode !== "client_admin"))
                .map((role) => {
                  const Icon = role.icon
                  return (
                    <motion.button
                      key={role.id}
                      variants={cardItem}
                      onClick={() => handleRoleSelect(role)}
                      disabled={fetchingClients}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.97 }}
                      className="group relative flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl cursor-pointer bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.14] transition-colors duration-300 disabled:opacity-40 disabled:cursor-wait"
                      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)" }}
                    >
                      {/* Hover glow */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `radial-gradient(circle at 50% 40%, ${role.glow}, transparent 70%)` }}
                      />

                      {/* Icon */}
                      <div
                        className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center`}
                        style={{ boxShadow: `0 4px 16px ${role.glow}` }}
                      >
                        <Icon className="w-6 h-6 text-white" />
                        <div className="absolute inset-0 rounded-xl overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        </div>
                      </div>

                      {/* Label */}
                      <div className="relative text-center">
                        <p className="font-semibold text-white/85 text-[13px] leading-tight">{role.label}</p>
                        <p className="text-[10px] text-white/25 mt-0.5 leading-tight hidden sm:block">{role.description}</p>
                      </div>

                      {/* Bottom accent */}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 group-hover:w-10 w-0"
                        style={{ background: `linear-gradient(90deg, transparent, ${role.accent}, transparent)` }}
                      />
                    </motion.button>
                  )
                })}
              </motion.div>
              )}

              {/* Loading */}
              {fetchingClients && (
                <div className="flex items-center justify-center gap-2 mt-6 text-white/30 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-10 space-y-3">
                <Link
                  href="/patient-login"
                  className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors duration-200 group"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Patient Portal</span>
                  <ChevronRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
                </Link>
                <p className="text-[10px] text-white/15 tracking-[0.2em] font-medium uppercase">
                  Powered by AI-HOS
                </p>
              </div>
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP: Client Picker                                              */}
          {/* ================================================================ */}
          {step === "client" && (
            <motion.div
              key="client-picker"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <BackButton />

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Select Hospital Group</h2>
                <p className="text-sm text-white/35 mt-1">
                  {selectedRole?.loginMode === "client_admin"
                    ? "Choose the organization to manage"
                    : "Choose your hospital group"}
                </p>
              </div>

              <motion.div variants={cardStagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clients.map((client) => (
                  <motion.button
                    key={client.client_id}
                    variants={cardItem}
                    onClick={() => handleClientSelect(client)}
                    disabled={fetchingBranches}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative flex items-center gap-4 p-5 rounded-2xl text-left bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.14] transition-colors duration-300 disabled:opacity-40 disabled:cursor-wait"
                    style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)" }}
                  >
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(circle at 30% 50%, ${activeGlow}, transparent 70%)` }}
                    />
                    <div
                      className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${activeGradient} flex items-center justify-center shrink-0`}
                      style={{ boxShadow: `0 4px 12px ${activeGlow}` }}
                    >
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="w-7 h-7 rounded-md object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <p className="font-semibold text-white/85 text-sm truncate">{client.name}</p>
                      <p className="text-[11px] text-white/25 mt-0.5">
                        {client.branch_count === 1 ? "1 branch" : `${client.branch_count || 0} branches`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
                  </motion.button>
                ))}
              </motion.div>

              {fetchingBranches && (
                <div className="flex items-center justify-center gap-2 mt-6 text-white/30 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading branches...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP: Branch Picker                                              */}
          {/* ================================================================ */}
          {step === "branch" && (
            <motion.div
              key="branch-picker"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <BackButton />

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Select Branch</h2>
                <p className="text-sm text-white/35 mt-1">
                  {selectedClient?.name} &mdash; choose your hospital branch
                </p>
              </div>

              <motion.div variants={cardStagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {branches.map((branch) => (
                  <motion.button
                    key={branch.tenant_id}
                    variants={cardItem}
                    onClick={() => handleBranchSelect(branch)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative flex items-center gap-4 p-5 rounded-2xl text-left bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.14] transition-colors duration-300"
                    style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)" }}
                  >
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(circle at 30% 50%, ${activeGlow}, transparent 70%)` }}
                    />
                    <div
                      className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${activeGradient} flex items-center justify-center shrink-0`}
                      style={{ boxShadow: `0 4px 12px ${activeGlow}` }}
                    >
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <p className="font-semibold text-white/85 text-sm truncate">{branch.hospital_name}</p>
                      <p className="text-[11px] text-white/25 mt-0.5">
                        {branch.city}{branch.branch_code ? ` \u00B7 ${branch.branch_code}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP: Credentials Form                                           */}
          {/* ================================================================ */}
          {step === "credentials" && selectedRole && (
            <motion.div
              key="form"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="max-w-[400px] mx-auto"
            >
              {(() => {
                const Icon = selectedRole.icon
                return (
                  <div
                    className="relative rounded-3xl overflow-hidden border border-white/[0.06]"
                    style={{ boxShadow: `0 24px 80px ${activeGlow}, 0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)` }}
                  >
                    {/* Top gradient header */}
                    <div className={`relative h-40 bg-gradient-to-br ${activeGradient} flex flex-col items-center justify-center overflow-hidden`}>
                      {/* Subtle pattern */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                          backgroundSize: "24px 24px",
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

                      <button
                        onClick={handleBack}
                        className="absolute top-4 left-4 flex items-center gap-1.5 text-white/60 hover:text-white transition-colors z-10 group"
                      >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-xs font-medium">Back</span>
                      </button>

                      <div className="relative w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-lg">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <p className="relative mt-3 text-white font-bold text-lg tracking-wide">
                        {selectedRole.label}
                      </p>
                      <p className="relative text-white/50 text-xs mt-0.5">
                        {selectedRole.loginMode === "super_admin"
                          ? "Platform access"
                          : selectedRole.loginMode === "client_admin"
                            ? selectedClient?.name || "Sign in to continue"
                            : selectedBranch?.hospital_name || "Sign in to continue"}
                      </p>
                    </div>

                    {/* Form body */}
                    <div className="bg-[#0C0C12] p-6 pt-5">
                      <Tabs
                        value={authMethod}
                        onValueChange={(v) => {
                          setAuthMethod(v as "pin" | "password")
                          setError("")
                        }}
                        className="gap-4"
                      >
                        <TabsList className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl h-10">
                          <TabsTrigger
                            value="pin"
                            className="flex-1 text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/35 rounded-lg transition-all"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                            PIN Login
                          </TabsTrigger>
                          <TabsTrigger
                            value="password"
                            className="flex-1 text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/35 rounded-lg transition-all"
                          >
                            <Mail className="w-3.5 h-3.5 mr-1.5" />
                            Email & Password
                          </TabsTrigger>
                        </TabsList>

                        {/* ---- PIN Tab ---- */}
                        <TabsContent value="pin">
                          <form onSubmit={handleLogin} className="space-y-4">
                            {selectedRole.loginMode === "super_admin" && (
                              <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-white/40 text-[11px] font-medium tracking-wider uppercase">
                                  Email
                                </Label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="admin@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  autoFocus
                                  className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus:ring-2 focus:border-transparent text-sm"
                                  style={{ ["--tw-ring-color" as string]: `${activeAccent}30` }}
                                />
                              </div>
                            )}

                            {selectedRole.loginMode === "branch" && selectedRole.id === "DOCTOR" && (
                              <div className="space-y-1.5">
                                <Label htmlFor="doctorId" className="text-white/40 text-[11px] font-medium tracking-wider uppercase">
                                  Doctor ID
                                </Label>
                                <Input
                                  id="doctorId"
                                  placeholder="e.g. DOC004"
                                  value={doctorId}
                                  onChange={(e) => setDoctorId(e.target.value)}
                                  autoFocus
                                  className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus:ring-2 focus:border-transparent text-sm"
                                  style={{ ["--tw-ring-color" as string]: `${activeAccent}30` }}
                                />
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <Label htmlFor="pin" className="text-white/40 text-[11px] font-medium tracking-wider uppercase">
                                PIN
                              </Label>
                              <Input
                                id="pin"
                                type="password"
                                placeholder="Enter your PIN"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                autoFocus={
                                  authMethod === "pin" &&
                                  selectedRole.loginMode !== "super_admin" &&
                                  !(selectedRole.loginMode === "branch" && selectedRole.id === "DOCTOR")
                                }
                                maxLength={10}
                                className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus:ring-2 focus:border-transparent text-sm"
                                style={{ ["--tw-ring-color" as string]: `${activeAccent}30` }}
                              />
                            </div>

                            {error && authMethod === "pin" && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 text-sm text-red-400 bg-red-500/8 rounded-xl px-3 py-2.5 border border-red-500/10"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                {error}
                              </motion.div>
                            )}

                            <Button
                              type="submit"
                              disabled={loading || !pin || (selectedRole.loginMode === "super_admin" && !email)}
                              className={`w-full h-11 rounded-xl font-semibold text-white border-0 bg-gradient-to-r ${activeGradient} hover:opacity-90 transition-all duration-200 disabled:opacity-30 shadow-lg`}
                              style={{ boxShadow: `0 4px 16px ${activeGlow}` }}
                            >
                              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              {loading ? "Signing in..." : "Sign In"}
                            </Button>
                          </form>
                        </TabsContent>

                        {/* ---- Password Tab ---- */}
                        <TabsContent value="password">
                          <form onSubmit={handlePasswordLogin} className="space-y-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="loginEmail" className="text-white/40 text-[11px] font-medium tracking-wider uppercase">
                                Email
                              </Label>
                              <Input
                                id="loginEmail"
                                type="email"
                                placeholder="you@example.com"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                autoFocus={authMethod === "password"}
                                className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus:ring-2 focus:border-transparent text-sm"
                                style={{ ["--tw-ring-color" as string]: `${activeAccent}30` }}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="loginPassword" className="text-white/40 text-[11px] font-medium tracking-wider uppercase">
                                Password
                              </Label>
                              <Input
                                id="loginPassword"
                                type="password"
                                placeholder="Enter your password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/15 rounded-xl focus:ring-2 focus:border-transparent text-sm"
                                style={{ ["--tw-ring-color" as string]: `${activeAccent}30` }}
                              />
                            </div>

                            {error && authMethod === "password" && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 text-sm text-red-400 bg-red-500/8 rounded-xl px-3 py-2.5 border border-red-500/10"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                {error}
                              </motion.div>
                            )}

                            <Button
                              type="submit"
                              disabled={loading || !loginEmail || !loginPassword}
                              className={`w-full h-11 rounded-xl font-semibold text-white border-0 bg-gradient-to-r ${activeGradient} hover:opacity-90 transition-all duration-200 disabled:opacity-30 shadow-lg`}
                              style={{ boxShadow: `0 4px 16px ${activeGlow}` }}
                            >
                              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              {loading ? "Signing in..." : "Sign In"}
                            </Button>

                            <div className="text-center pt-1">
                              <Link
                                href="/forgot-password"
                                className="text-xs text-white/25 hover:text-white/50 transition-colors"
                              >
                                Forgot your password?
                              </Link>
                            </div>
                          </form>
                        </TabsContent>
                      </Tabs>

                      {selectedRole.loginMode === "branch" && selectedBranch && (
                        <p className="text-center text-[10px] text-white/15 mt-5 tracking-wide">
                          {selectedBranch.hospital_name}{selectedBranch.city ? ` \u2022 ${selectedBranch.city}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display for non-credential steps */}
        {error && step !== "credentials" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/8 rounded-xl px-3 py-2.5 border border-red-500/10"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
