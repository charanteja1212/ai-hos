"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Heart,
} from "lucide-react"
import { BranchSwitcher } from "./branch-switcher"
import { getNavForRole } from "./sidebar-nav-config"
import type { NavItem, NavSection } from "./sidebar-nav-config"
import type { UserRole } from "@/types/auth"
import { useFeatures } from "@/components/providers/features-context"
import { LanguageSwitcher } from "@/components/shared/language-switcher"

interface SidebarProps {
  role: UserRole
  hospitalName: string
  userName?: string
  clientId?: string
  logoUrl?: string
}

export function Sidebar({ role, hospitalName, userName, clientId = "", logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const { hasFeature } = useFeatures()
  const rawNavConfig = getNavForRole(role)

  const navConfig = {
    sections: rawNavConfig.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !item.requiredFeature || hasFeature(item.requiredFeature)
        ),
      }))
      .filter((section) => section.items.length > 0),
  }

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const isActivePath = (href: string) => {
    if (pathname === href) return true
    const rootPaths = ["/reception", "/doctor", "/admin", "/pharmacy", "/lab", "/platform", "/patient"]
    if (rootPaths.includes(href)) return false
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 transition-[width] duration-200 ease-in-out",
        "bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* ── Blue Brand Header Card ── */}
      <div className={cn("shrink-0", collapsed ? "px-2 pt-3" : "px-3 pt-3")}>
        <div
          className={cn(
            "rounded-2xl bg-blue-600 overflow-hidden",
            collapsed ? "p-2.5" : "p-4"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <Heart className="w-4 h-4 text-white" />
              )}
            </div>
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap min-w-0">
                <p className="font-bold text-sm text-white tracking-tight">AI-HOS</p>
                <p className="text-[11px] text-white/50 truncate max-w-[140px]">
                  {hospitalName}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Branch Switcher ── */}
      <BranchSwitcher role={role} clientId={clientId} collapsed={collapsed} />

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-3 px-3">
        {navConfig.sections.map((section, sIdx) => (
          <SidebarSectionBlock
            key={section.id}
            section={section}
            collapsed={collapsed}
            sectionCollapsed={!!collapsedSections[section.id]}
            onToggleSection={() => toggleSection(section.id)}
            pathname={pathname}
            isActive={isActivePath}
            isFirst={sIdx === 0}
          />
        ))}
      </div>

      {/* ── User ── */}
      {userName && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2.5",
              collapsed && "justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
                  {userName}
                </p>
                <p className="text-[11px] text-gray-400 capitalize">
                  {role.replace(/_/g, " ").toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Language Switcher ── */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 pt-2 shrink-0">
        <LanguageSwitcher compact={collapsed} />
      </div>

      {/* ── Collapse Toggle ── */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-8 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  )
}

/* ══════════════════════════════════════════
   Section Block
   ══════════════════════════════════════════ */
function SidebarSectionBlock({
  section,
  collapsed,
  sectionCollapsed,
  onToggleSection,
  isActive,
  isFirst,
}: {
  section: NavSection
  collapsed: boolean
  sectionCollapsed: boolean
  onToggleSection: () => void
  pathname: string
  isActive: (href: string) => boolean
  isFirst: boolean
}) {
  return (
    <div className={cn(!isFirst && "mt-5")}>
      {!collapsed ? (
        <button
          onClick={onToggleSection}
          className="w-full flex items-center justify-between px-3 py-1.5 group cursor-pointer"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 select-none">
            {section.label}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-all duration-150",
              sectionCollapsed && "-rotate-90"
            )}
          />
        </button>
      ) : (
        !isFirst && <div className="mx-auto w-6 h-px bg-gray-200 dark:bg-gray-800 my-2" />
      )}

      {!sectionCollapsed && (
        <nav className="space-y-0.5 mt-1">
          {section.items.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isActive(item.href)}
            />
          ))}
        </nav>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   Nav Link
   ══════════════════════════════════════════ */
function SidebarNavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
}) {
  const content = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "px-3",
        active
          ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-600/20"
          : "text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/20"
      )}
    >
      <item.icon
        className={cn(
          "w-[18px] h-[18px] shrink-0",
          active ? "text-white" : "text-gray-400 dark:text-gray-500"
        )}
      />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}
