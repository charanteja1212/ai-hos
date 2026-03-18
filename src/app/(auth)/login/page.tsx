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
  Lock,
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
  color: string
  lightBg: string
  gradient: string
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
// Role definitions
// ---------------------------------------------------------------------------

const roles: RoleCard[] = [
  {
    id: "SUPER_ADMIN",
    loginMode: "super_admin",
    label: "Platform Admin",
    icon: Crown,
    color: "#E11D48",
    lightBg: "#FFF1F2",
    gradient: "from-rose-500 to-pink-600",
    description: "Global platform management",
  },
  {
    id: "CLIENT_ADMIN",
    loginMode: "client_admin",
    label: "Client Admin",
    icon: Building2,
    color: "#475569",
    lightBg: "#F1F5F9",
    gradient: "from-slate-500 to-slate-700",
    description: "Hospital group oversight",
  },
  {
    id: "BRANCH_ADMIN",
    signInRole: "ADMIN",
    loginMode: "branch",
    label: "Admin",
    icon: Shield,
    color: "#2563EB",
    lightBg: "#EFF6FF",
    gradient: "from-blue-500 to-blue-700",
    description: "Hospital settings & config",
  },
  {
    id: "DOCTOR",
    loginMode: "branch",
    label: "Doctor",
    icon: Stethoscope,
    color: "#059669",
    lightBg: "#ECFDF5",
    gradient: "from-emerald-500 to-emerald-700",
    description: "Consultations & prescriptions",
  },
  {
    id: "RECEPTION",
    loginMode: "branch",
    label: "Reception",
    icon: ClipboardList,
    color: "#7C3AED",
    lightBg: "#F5F3FF",
    gradient: "from-violet-500 to-violet-700",
    description: "Queue & booking management",
  },
  {
    id: "LAB_TECH",
    loginMode: "branch",
    label: "Lab",
    icon: TestTube,
    color: "#D97706",
    lightBg: "#FFFBEB",
    gradient: "from-amber-500 to-amber-700",
    description: "Sample tracking & reports",
  },
  {
    id: "PHARMACIST",
    loginMode: "branch",
    label: "Pharmacy",
    icon: Pill,
    color: "#0891B2",
    lightBg: "#ECFEFF",
    gradient: "from-cyan-500 to-cyan-700",
    description: "Orders & stock management",
  },
]

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const directClientId = searchParams.get("client")

  const [step, setStep] = useState<Step>("role")
  const [selectedRole, setSelectedRole] = useState<RoleCard | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [fetchingClients, setFetchingClients] = useState(false)
  const [fetchingBranches, setFetchingBranches] = useState(false)

  const directClientLoaded = useRef(false)
  const [directClient, setDirectClient] = useState<Client | null>(null)
  const [directBranches, setDirectBranches] = useState<Branch[]>([])
  const [directClientResolved, setDirectClientResolved] = useState(false)

  const directClientLoading = !!directClientId && !directClientResolved

  const [pin, setPin] = useState("")
  const [email, setEmail] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [authMethod, setAuthMethod] = useState<"pin" | "password">("pin")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

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
        setDirectClientResolved(true)
      }
    })()
  }, [directClientId])

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
  // Flow logic (unchanged)
  // ---------------------------------------------------------------------------

  const handleRoleSelect = async (role: RoleCard) => {
    setSelectedRole(role)
    setError("")

    if (role.loginMode === "super_admin") {
      setStep("credentials")
      return
    }

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

  const handleBack = () => {
    setError("")

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

  const activeColor = selectedRole?.color || "#2563EB"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row select-none">
      {/* === Left Brand Panel (desktop only) === */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col justify-between p-12 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              {directClient?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={directClient.logo_url} alt="" className="w-7 h-7 object-contain" />
              ) : (
                <Activity className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg tracking-tight">
                {directClient ? directClient.name : "AI-HOS"}
              </h2>
              <p className="text-blue-200 text-xs">Hospital Operating System</p>
            </div>
          </div>
        </div>

        {/* Center: Tagline */}
        <div className="relative z-10 -mt-8">
          <h1 className="text-white text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight">
            Smarter<br />Healthcare<br />Management
          </h1>
          <p className="text-blue-200 text-base mt-4 max-w-sm leading-relaxed">
            Streamline your hospital operations with AI-powered tools for every department.
          </p>

          {/* Stats */}
          <div className="flex items-center gap-8 mt-10">
            <div>
              <p className="text-white text-2xl font-bold">50+</p>
              <p className="text-blue-300 text-xs mt-0.5">Hospitals</p>
            </div>
            <div className="w-px h-10 bg-white/15" />
            <div>
              <p className="text-white text-2xl font-bold">200+</p>
              <p className="text-blue-300 text-xs mt-0.5">Doctors</p>
            </div>
            <div className="w-px h-10 bg-white/15" />
            <div>
              <p className="text-white text-2xl font-bold">1M+</p>
              <p className="text-blue-300 text-xs mt-0.5">Patients</p>
            </div>
          </div>
        </div>

        {/* Bottom: Trust */}
        <div className="relative z-10 flex items-center gap-2 text-blue-300 text-xs">
          <Lock className="w-3.5 h-3.5" />
          <span>HIPAA Compliant &middot; End-to-end Encrypted</span>
        </div>
      </div>

      {/* === Right Content Panel === */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] p-6 sm:p-10 relative">
        {/* Mobile brand header */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

        <div className="w-full max-w-[480px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                {directClient?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={directClient.logo_url} alt="" className="w-6 h-6 object-contain" />
                ) : (
                  <Activity className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="text-lg font-bold text-gray-900">
                {directClient ? directClient.name : "AI-HOS"}
              </span>
            </div>
          </div>

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
                {directClientLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-500">Loading...</p>
                  </div>
                ) : (
                <>
                <div className="mb-8">
                  <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 tracking-tight">
                    Welcome back
                  </h1>
                  <p className="text-[15px] text-gray-500 mt-1.5">
                    Select your role to sign in
                  </p>
                </div>

                <motion.div
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-2 gap-3"
                >
                  {roles
                  .filter((role) => !directClient || (role.loginMode !== "super_admin" && role.loginMode !== "client_admin"))
                  .map((role) => {
                    const Icon = role.icon
                    return (
                      <motion.button
                        key={role.id}
                        variants={fadeUp}
                        onClick={() => handleRoleSelect(role)}
                        disabled={fetchingClients}
                        className="group relative flex flex-col items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-wait cursor-pointer text-left"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}
                        whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: role.lightBg, color: role.color }}
                        >
                          <Icon className="w-5 h-5" strokeWidth={2} />
                        </div>

                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{role.label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{role.description}</p>
                        </div>
                      </motion.button>
                    )
                  })}
                </motion.div>

                {fetchingClients && (
                  <div className="flex items-center justify-center gap-2 mt-6 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                )}

                <div className="mt-10 flex flex-col items-center gap-3">
                  <Link
                    href="/patient-login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 transition-colors group"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>Patient Portal</span>
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                  </Link>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                    <Lock className="w-3 h-3" />
                    <span>Secure &middot; Encrypted</span>
                  </div>
                </div>
                </>
                )}
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
                <button
                  onClick={handleBack}
                  className="group flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-sm font-medium">Back</span>
                </button>

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Select Hospital Group</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedRole?.loginMode === "client_admin"
                      ? "Choose the organization to manage"
                      : "Choose your hospital group"}
                  </p>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
                  {clients.map((client) => (
                    <motion.button
                      key={client.client_id}
                      variants={fadeUp}
                      onClick={() => handleClientSelect(client)}
                      disabled={fetchingBranches}
                      className="group w-full flex items-center gap-4 p-4 rounded-xl text-left bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-wait cursor-pointer"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                      whileHover={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selectedRole?.lightBg || "#EFF6FF", color: selectedRole?.color || "#2563EB" }}
                      >
                        {client.logo_url ? (
                          <img src={client.logo_url} alt={client.name} className="w-6 h-6 rounded object-contain" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{client.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {client.branch_count === 1 ? "1 branch" : `${client.branch_count || 0} branches`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </motion.button>
                  ))}
                </motion.div>

                {fetchingBranches && (
                  <div className="flex items-center justify-center gap-2 mt-6 text-gray-400 text-sm">
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
                <button
                  onClick={handleBack}
                  className="group flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-sm font-medium">Back</span>
                </button>

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Select Branch</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedClient?.name} &mdash; choose your hospital branch
                  </p>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
                  {branches.map((branch) => (
                    <motion.button
                      key={branch.tenant_id}
                      variants={fadeUp}
                      onClick={() => handleBranchSelect(branch)}
                      className="group w-full flex items-center gap-4 p-4 rounded-xl text-left bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                      whileHover={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selectedRole?.lightBg || "#EFF6FF", color: selectedRole?.color || "#2563EB" }}
                      >
                        <Heart className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{branch.hospital_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {branch.city}{branch.branch_code ? ` \u00B7 ${branch.branch_code}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* ================================================================ */}
            {/* STEP: Credentials                                                */}
            {/* ================================================================ */}
            {step === "credentials" && selectedRole && (
              <motion.div
                key="form"
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="max-w-[420px] mx-auto"
              >
                {(() => {
                  const Icon = selectedRole.icon
                  return (
                    <div
                      className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
                      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
                    >
                      {/* Color accent top bar */}
                      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${activeColor}, ${activeColor}CC)` }} />

                      {/* Header */}
                      <div className="px-7 pt-6 pb-5">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={handleBack}
                            className="text-gray-400 hover:text-gray-700 transition-colors -ml-1"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: selectedRole.lightBg, color: selectedRole.color }}
                          >
                            <Icon className="w-6 h-6" strokeWidth={2} />
                          </div>
                          <div>
                            <h2 className="font-bold text-gray-900 text-lg">{selectedRole.label}</h2>
                            <p className="text-sm text-gray-400">
                              {selectedRole.loginMode === "super_admin"
                                ? "Platform access"
                                : selectedRole.loginMode === "client_admin"
                                  ? selectedClient?.name || "Sign in"
                                  : selectedBranch?.hospital_name || "Sign in"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-gray-100" />

                      {/* Form */}
                      <div className="px-7 py-6">
                        <Tabs
                          value={authMethod}
                          onValueChange={(v) => {
                            setAuthMethod(v as "pin" | "password")
                            setError("")
                          }}
                          className="gap-5"
                        >
                          <TabsList className="w-full bg-gray-50 border border-gray-200 rounded-lg h-11 p-1">
                            <TabsTrigger
                              value="pin"
                              className="flex-1 text-xs font-semibold rounded-md h-full text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:border-gray-200"
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                              PIN Login
                            </TabsTrigger>
                            <TabsTrigger
                              value="password"
                              className="flex-1 text-xs font-semibold rounded-md h-full text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=active]:border-gray-200"
                            >
                              <Mail className="w-3.5 h-3.5 mr-1.5" />
                              Email & Password
                            </TabsTrigger>
                          </TabsList>

                          {/* PIN Tab */}
                          <TabsContent value="pin">
                            <form onSubmit={handleLogin} className="space-y-4">
                              {selectedRole.loginMode === "super_admin" && (
                                <div className="space-y-2">
                                  <Label htmlFor="email" className="text-[13px] font-medium text-gray-700">
                                    Email
                                  </Label>
                                  <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                    className="h-11 rounded-lg bg-white border-gray-300 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                  />
                                </div>
                              )}

                              {selectedRole.loginMode === "branch" && selectedRole.id === "DOCTOR" && (
                                <div className="space-y-2">
                                  <Label htmlFor="doctorId" className="text-[13px] font-medium text-gray-700">
                                    Doctor ID
                                  </Label>
                                  <Input
                                    id="doctorId"
                                    placeholder="e.g. DOC004"
                                    value={doctorId}
                                    onChange={(e) => setDoctorId(e.target.value)}
                                    autoFocus
                                    className="h-11 rounded-lg bg-white border-gray-300 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                  />
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label htmlFor="pin" className="text-[13px] font-medium text-gray-700">
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
                                  className="h-11 rounded-lg bg-white border-gray-300 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              {error && authMethod === "pin" && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                  {error}
                                </motion.div>
                              )}

                              <Button
                                type="submit"
                                disabled={loading || !pin || (selectedRole.loginMode === "super_admin" && !email)}
                                className="w-full h-12 rounded-lg font-bold text-white text-sm border-0 transition-all duration-200 disabled:opacity-30 hover:opacity-90 hover:translate-y-[-1px] active:translate-y-0"
                                style={{
                                  backgroundColor: activeColor,
                                  boxShadow: `0 4px 14px ${activeColor}50`,
                                }}
                              >
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                {loading ? "Signing in..." : "Sign In"}
                              </Button>
                            </form>
                          </TabsContent>

                          {/* Password Tab */}
                          <TabsContent value="password">
                            <form onSubmit={handlePasswordLogin} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="loginEmail" className="text-[13px] font-medium text-gray-700">
                                  Email
                                </Label>
                                <Input
                                  id="loginEmail"
                                  type="email"
                                  placeholder="you@example.com"
                                  value={loginEmail}
                                  onChange={(e) => setLoginEmail(e.target.value)}
                                  autoFocus={authMethod === "password"}
                                  className="h-11 rounded-lg bg-white border-gray-300 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="loginPassword" className="text-[13px] font-medium text-gray-700">
                                  Password
                                </Label>
                                <Input
                                  id="loginPassword"
                                  type="password"
                                  placeholder="Enter your password"
                                  value={loginPassword}
                                  onChange={(e) => setLoginPassword(e.target.value)}
                                  className="h-11 rounded-lg bg-white border-gray-300 text-gray-900 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              {error && authMethod === "password" && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                  {error}
                                </motion.div>
                              )}

                              <Button
                                type="submit"
                                disabled={loading || !loginEmail || !loginPassword}
                                className="w-full h-12 rounded-lg font-bold text-white text-sm border-0 transition-all duration-200 disabled:opacity-30 hover:opacity-90 hover:translate-y-[-1px] active:translate-y-0"
                                style={{
                                  backgroundColor: activeColor,
                                  boxShadow: `0 4px 14px ${activeColor}50`,
                                }}
                              >
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                {loading ? "Signing in..." : "Sign In"}
                              </Button>

                              <div className="text-center pt-1">
                                <Link
                                  href="/forgot-password"
                                  className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                  Forgot your password?
                                </Link>
                              </div>
                            </form>
                          </TabsContent>
                        </Tabs>

                        {selectedRole.loginMode === "branch" && selectedBranch && (
                          <p className="text-center text-[11px] text-gray-300 mt-5">
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

          {/* Error for non-credential steps */}
          {error && step !== "credentials" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {error}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoginSuspenseFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}
