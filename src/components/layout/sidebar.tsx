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
        "bg-blue-600",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/15 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white shadow-sm shrink-0 overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
          ) : (
            <Heart className="w-4 h-4 text-blue-600" />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap min-w-0">
            <p className="font-bold text-sm text-white tracking-tight">AI-HOS</p>
            <p className="text-[11px] text-white/50 truncate max-w-[160px]">
              {hospitalName}
            </p>
          </div>
        )}
      </div>

      {/* Branch Switcher */}
      <BranchSwitcher role={role} clientId={clientId} collapsed={collapsed} />

      {/* Navigation */}
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

      {/* User */}
      {userName && (
        <div className="border-t border-white/15 p-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2.5",
              collapsed && "justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0 shadow-sm">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="text-[13px] font-semibold text-white truncate max-w-[140px]">
                  {userName}
                </p>
                <p className="text-[11px] text-white/40 capitalize">
                  {role.replace(/_/g, " ").toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Language Switcher */}
      <div className="border-t border-white/15 px-3 pt-2 shrink-0">
        <LanguageSwitcher compact={collapsed} />
      </div>

      {/* Collapse Toggle */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-8 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
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

/* Section Block */
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 select-none">
            {section.label}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-white/25 opacity-0 group-hover:opacity-100 transition-all duration-150",
              sectionCollapsed && "-rotate-90"
            )}
          />
        </button>
      ) : (
        !isFirst && <div className="mx-auto w-6 h-px bg-white/15 my-2" />
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

/* Nav Link */
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
        "relative flex items-center gap-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "px-3",
        active
          ? "bg-white text-blue-700 font-semibold shadow-sm"
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      <item.icon
        className={cn(
          "w-[18px] h-[18px] shrink-0",
          active ? "text-blue-600" : "text-white/50"
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
