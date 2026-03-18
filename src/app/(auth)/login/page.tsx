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
  color: string
  bgColor: string
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
// Role definitions — clean colors, no gradients
// ---------------------------------------------------------------------------

const roles: RoleCard[] = [
  {
    id: "SUPER_ADMIN",
    loginMode: "super_admin",
    label: "Platform Admin",
    icon: Crown,
    color: "#DC2626",
    bgColor: "#FEF2F2",
    description: "Global platform management",
  },
  {
    id: "CLIENT_ADMIN",
    loginMode: "client_admin",
    label: "Client Admin",
    icon: Building2,
    color: "#64748B",
    bgColor: "#F8FAFC",
    description: "Hospital group oversight",
  },
  {
    id: "BRANCH_ADMIN",
    signInRole: "ADMIN",
    loginMode: "branch",
    label: "Admin",
    icon: Shield,
    color: "#2563EB",
    bgColor: "#EFF6FF",
    description: "Hospital settings & config",
  },
  {
    id: "DOCTOR",
    loginMode: "branch",
    label: "Doctor",
    icon: Stethoscope,
    color: "#059669",
    bgColor: "#ECFDF5",
    description: "Consultations & prescriptions",
  },
  {
    id: "RECEPTION",
    loginMode: "branch",
    label: "Reception",
    icon: ClipboardList,
    color: "#7C3AED",
    bgColor: "#F5F3FF",
    description: "Queue & booking management",
  },
  {
    id: "LAB_TECH",
    loginMode: "branch",
    label: "Lab",
    icon: TestTube,
    color: "#D97706",
    bgColor: "#FFFBEB",
    description: "Sample tracking & reports",
  },
  {
    id: "PHARMACIST",
    loginMode: "branch",
    label: "Pharmacy",
    icon: Pill,
    color: "#0891B2",
    bgColor: "#ECFEFF",
    description: "Orders & stock management",
  },
]

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const cardStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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
        setDirectClientResolved(true)
      }
    })()
  }, [directClientId])

  // ---------------------------------------------------------------------------
  // Data fetching
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
  // Login
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
  // Back
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Active color
  // ---------------------------------------------------------------------------

  const activeColor = selectedRole?.color || "#2563EB"

  // ---------------------------------------------------------------------------
  // Back button
  // ---------------------------------------------------------------------------

  const BackButton = () => (
    <button
      onClick={handleBack}
      className="group flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-6"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      <span className="text-sm font-medium">Back</span>
    </button>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] relative">
      {/* Subtle top accent line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

      {/* Content */}
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
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {directClientLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-primary" />
                  </div>
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mt-4" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
              <>
              {/* Logo */}
              <div className="text-center mb-10">
                <div className="inline-flex">
                  <div className="w-16 h-16 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden">
                    {directClient?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={directClient.logo_url} alt={directClient.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <Activity className="w-8 h-8 text-primary" />
                    )}
                  </div>
                </div>

                <h1 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {directClient ? directClient.name : "AI-HOS"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {directClient ? "Staff Login" : "Hospital Operating System"}
                </p>
              </div>

              {/* Role Grid */}
              <motion.div
                variants={cardStagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
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
                      className="group flex flex-col items-center gap-3 p-4 sm:p-5 rounded-xl bg-white border border-border hover:border-[color:var(--accent-color)] hover:shadow-md transition-all duration-150 disabled:opacity-40 disabled:cursor-wait cursor-pointer"
                      style={{ "--accent-color": `${role.color}40` } as React.CSSProperties}
                    >
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
                        style={{ backgroundColor: role.bgColor, color: role.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="text-center">
                        <p className="font-semibold text-foreground text-[13px] leading-tight">{role.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">{role.description}</p>
                      </div>
                    </motion.button>
                  )
                })}
              </motion.div>

              {fetchingClients && (
                <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-10 space-y-3">
                <Link
                  href="/patient-login"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Patient Portal</span>
                  <ChevronRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-150" />
                </Link>
                <p className="text-[10px] text-muted-foreground/50 tracking-widest font-medium uppercase">
                  Powered by AI-HOS
                </p>
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
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <BackButton />

              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Select Hospital Group</h2>
                <p className="text-sm text-muted-foreground mt-1">
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
                    className="group flex items-center gap-4 p-4 rounded-xl text-left bg-white border border-border hover:border-primary/30 hover:shadow-md transition-all duration-150 disabled:opacity-40 disabled:cursor-wait cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: selectedRole?.bgColor || "#EFF6FF", color: selectedRole?.color || "#2563EB" }}
                    >
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="w-6 h-6 rounded object-contain" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {client.branch_count === 1 ? "1 branch" : `${client.branch_count || 0} branches`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </motion.button>
                ))}
              </motion.div>

              {fetchingBranches && (
                <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground text-sm">
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
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <BackButton />

              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Select Branch</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedClient?.name} &mdash; choose your hospital branch
                </p>
              </div>

              <motion.div variants={cardStagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {branches.map((branch) => (
                  <motion.button
                    key={branch.tenant_id}
                    variants={cardItem}
                    onClick={() => handleBranchSelect(branch)}
                    className="group flex items-center gap-4 p-4 rounded-xl text-left bg-white border border-border hover:border-primary/30 hover:shadow-md transition-all duration-150 cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: selectedRole?.bgColor || "#EFF6FF", color: selectedRole?.color || "#2563EB" }}
                    >
                      <Heart className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm truncate">{branch.hospital_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {branch.city}{branch.branch_code ? ` \u00B7 ${branch.branch_code}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
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
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="max-w-[400px] mx-auto"
            >
              {(() => {
                const Icon = selectedRole.icon
                return (
                  <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-6 border-b border-border flex items-center gap-4">
                      <button
                        onClick={handleBack}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selectedRole.bgColor, color: selectedRole.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{selectedRole.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedRole.loginMode === "super_admin"
                            ? "Platform access"
                            : selectedRole.loginMode === "client_admin"
                              ? selectedClient?.name || "Sign in to continue"
                              : selectedBranch?.hospital_name || "Sign in to continue"}
                        </p>
                      </div>
                    </div>

                    {/* Form */}
                    <div className="p-6">
                      <Tabs
                        value={authMethod}
                        onValueChange={(v) => {
                          setAuthMethod(v as "pin" | "password")
                          setError("")
                        }}
                        className="gap-4"
                      >
                        <TabsList className="w-full bg-muted rounded-lg h-10">
                          <TabsTrigger
                            value="pin"
                            className="flex-1 text-xs rounded-md"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                            PIN Login
                          </TabsTrigger>
                          <TabsTrigger
                            value="password"
                            className="flex-1 text-xs rounded-md"
                          >
                            <Mail className="w-3.5 h-3.5 mr-1.5" />
                            Email & Password
                          </TabsTrigger>
                        </TabsList>

                        {/* PIN Tab */}
                        <TabsContent value="pin">
                          <form onSubmit={handleLogin} className="space-y-4">
                            {selectedRole.loginMode === "super_admin" && (
                              <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                                  Email
                                </Label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="admin@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  autoFocus
                                  className="h-10"
                                />
                              </div>
                            )}

                            {selectedRole.loginMode === "branch" && selectedRole.id === "DOCTOR" && (
                              <div className="space-y-1.5">
                                <Label htmlFor="doctorId" className="text-xs font-medium text-muted-foreground">
                                  Doctor ID
                                </Label>
                                <Input
                                  id="doctorId"
                                  placeholder="e.g. DOC004"
                                  value={doctorId}
                                  onChange={(e) => setDoctorId(e.target.value)}
                                  autoFocus
                                  className="h-10"
                                />
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <Label htmlFor="pin" className="text-xs font-medium text-muted-foreground">
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
                                className="h-10"
                              />
                            </div>

                            {error && authMethod === "pin" && (
                              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2.5 border border-destructive/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                                {error}
                              </div>
                            )}

                            <Button
                              type="submit"
                              disabled={loading || !pin || (selectedRole.loginMode === "super_admin" && !email)}
                              className="w-full h-10 font-semibold"
                              style={{ backgroundColor: activeColor }}
                            >
                              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              {loading ? "Signing in..." : "Sign In"}
                            </Button>
                          </form>
                        </TabsContent>

                        {/* Password Tab */}
                        <TabsContent value="password">
                          <form onSubmit={handlePasswordLogin} className="space-y-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="loginEmail" className="text-xs font-medium text-muted-foreground">
                                Email
                              </Label>
                              <Input
                                id="loginEmail"
                                type="email"
                                placeholder="you@example.com"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                autoFocus={authMethod === "password"}
                                className="h-10"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="loginPassword" className="text-xs font-medium text-muted-foreground">
                                Password
                              </Label>
                              <Input
                                id="loginPassword"
                                type="password"
                                placeholder="Enter your password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="h-10"
                              />
                            </div>

                            {error && authMethod === "password" && (
                              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2.5 border border-destructive/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                                {error}
                              </div>
                            )}

                            <Button
                              type="submit"
                              disabled={loading || !loginEmail || !loginPassword}
                              className="w-full h-10 font-semibold"
                              style={{ backgroundColor: activeColor }}
                            >
                              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              {loading ? "Signing in..." : "Sign In"}
                            </Button>

                            <div className="text-center pt-1">
                              <Link
                                href="/forgot-password"
                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                Forgot your password?
                              </Link>
                            </div>
                          </form>
                        </TabsContent>
                      </Tabs>

                      {selectedRole.loginMode === "branch" && selectedBranch && (
                        <p className="text-center text-[10px] text-muted-foreground/60 mt-5 tracking-wide">
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
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2.5 border border-destructive/10">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function LoginSuspenseFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary" />
        </div>
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mt-2" />
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
