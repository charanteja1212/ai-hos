"use client"

import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  Search,
  UserPlus,
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  BarChart3,
  Settings,
  Pill,
  TestTube,
  BedDouble,
  KeyRound,
  UsersRound,
  Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranch } from "@/components/providers/branch-context"
import { SetPasswordDialog } from "@/components/auth/set-password-dialog"
import { NotificationCenter } from "./notification-center"
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import type { SessionUser } from "@/types/auth"

interface TopbarProps {
  user: SessionUser
  onToggleMobile?: () => void
}

function ISTClock() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      )
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!time) return null
  return (
    <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">
      {time} IST
    </span>
  )
}

const ADMIN_ROLES = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN"]

const quickActions = [
  { label: "New Walk-in Booking", icon: UserPlus, href: "/reception/book", roles: ["RECEPTION", ...ADMIN_ROLES] },
  { label: "Search Patients", icon: Search, href: "/reception/patients", roles: ["RECEPTION", ...ADMIN_ROLES] },
]

const navCommands = [
  { label: "Queue Board", icon: LayoutDashboard, href: "/reception", roles: ["RECEPTION", ...ADMIN_ROLES] },
  { label: "Appointments", icon: CalendarDays, href: "/reception/appointments", roles: ["RECEPTION", ...ADMIN_ROLES] },
  { label: "Inpatients", icon: BedDouble, href: "/reception/admissions", roles: ["RECEPTION", ...ADMIN_ROLES] },
  { label: "Doctor Dashboard", icon: LayoutDashboard, href: "/doctor", roles: ["DOCTOR"] },
  { label: "My Patients", icon: Users, href: "/doctor/patients", roles: ["DOCTOR"] },
  { label: "Prescriptions", icon: FileText, href: "/doctor/prescriptions", roles: ["DOCTOR"] },
  { label: "Pharmacy", icon: Pill, href: "/pharmacy", roles: ["PHARMACIST", ...ADMIN_ROLES] },
  { label: "Lab Orders", icon: TestTube, href: "/lab", roles: ["LAB_TECH", ...ADMIN_ROLES] },
  { label: "Analytics", icon: BarChart3, href: "/admin", roles: [...ADMIN_ROLES] },
  { label: "Billing", icon: Receipt, href: "/admin/billing", roles: [...ADMIN_ROLES] },
  { label: "Staff", icon: UsersRound, href: "/admin/staff", roles: [...ADMIN_ROLES] },
  { label: "Settings", icon: Settings, href: "/admin/settings", roles: [...ADMIN_ROLES] },
]

export function Topbar({ user, onToggleMobile }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const { activeBranchName } = useBranch()
  const [mounted, setMounted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showSetPassword, setShowSetPassword] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const { availableShortcuts } = useKeyboardShortcuts({
    role: user.role,
    onOpenHelp: () => setShowShortcuts((v) => !v),
  })

  const displayHospitalName = (user.role === "CLIENT_ADMIN" || user.role === "SUPER_ADMIN")
    ? (activeBranchName || user.hospitalName)
    : user.hospitalName

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const roleBadgeColor: Record<string, string> = {
    SUPER_ADMIN: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
    CLIENT_ADMIN: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800",
    BRANCH_ADMIN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
    ADMIN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
    DOCTOR: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
    RECEPTION: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
    LAB_TECH: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
    PHARMACIST: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800",
  }

  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, i, arr) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
      href: "/" + arr.slice(0, i + 1).join("/"),
      isLast: i === arr.length - 1,
    }))

  const filteredQuickActions = quickActions.filter((a) => a.roles.includes(user.role))
  const filteredNavCommands = navCommands.filter((a) => a.roles.includes(user.role))

  return (
    <header className="h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[var(--card)] flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobile && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleMobile}>
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-1.5 min-w-0">
          {/* Mobile: page title */}
          <span className="text-sm font-semibold text-foreground sm:hidden truncate max-w-[160px]">
            {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : displayHospitalName}
          </span>
          {/* Desktop: hospital + breadcrumbs */}
          {user.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.logoUrl} alt="" className="w-6 h-6 rounded object-contain hidden lg:inline-block shrink-0" />
          )}
          <span className="text-sm font-semibold text-foreground hidden lg:inline-block shrink-0 truncate max-w-[200px]">
            {displayHospitalName}
          </span>
          {breadcrumbs.length > 0 && (
            <span className="text-muted-foreground/40 hidden lg:inline-block">/</span>
          )}
          <nav className="flex items-center gap-1 text-sm min-w-0 hidden sm:flex">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/40">/</span>}
                <span
                  className={cn(
                    "truncate max-w-[100px]",
                    crumb.isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
          <Badge
            variant="outline"
            className={cn("text-[10px] hidden md:inline-flex ml-1 border", roleBadgeColor[user.role] || "")}
          >
            {user.role.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search...</span>
          <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-4">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </button>

        <ISTClock />

        <NotificationCenter user={user} />

        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-blue-600 text-white font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">
                {user.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] border", roleBadgeColor[user.role] || "")}
                >
                  {user.role}
                </Badge>
                <p className="text-xs text-muted-foreground truncate">{user.hospitalName}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSetPassword(true)}>
              <KeyRound className="w-4 h-4 mr-2" />
              Set Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const url = user.clientId ? `/login?client=${user.clientId}` : "/login"
                await signOut({ redirect: false })
                window.location.href = url
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Command Palette */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search patients, actions, pages..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {filteredQuickActions.length > 0 && (
            <CommandGroup heading="Quick Actions">
              {filteredQuickActions.map((action) => (
                <CommandItem
                  key={action.href}
                  onSelect={() => {
                    router.push(action.href)
                    setSearchOpen(false)
                  }}
                >
                  <action.icon className="w-4 h-4 mr-2" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredNavCommands.length > 0 && (
            <CommandGroup heading="Navigation">
              {filteredNavCommands.map((nav) => (
                <CommandItem
                  key={nav.href}
                  onSelect={() => {
                    router.push(nav.href)
                    setSearchOpen(false)
                  }}
                >
                  <nav.icon className="w-4 h-4 mr-2" />
                  {nav.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <SetPasswordDialog open={showSetPassword} onOpenChange={setShowSetPassword} />
      <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} shortcuts={availableShortcuts} />
    </header>
  )
}
