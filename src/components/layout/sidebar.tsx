"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
        "h-screen flex flex-col shrink-0 bg-[var(--sidebar)] border-r border-border transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
          ) : (
            <Heart className="w-4 h-4 text-primary" />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap min-w-0">
            <p className="font-semibold text-sm text-foreground">AI-HOS</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
              {hospitalName}
            </p>
          </div>
        )}
      </div>

      {/* Branch Switcher */}
      <BranchSwitcher role={role} clientId={clientId} collapsed={collapsed} />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-2 px-2">
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
        <div className="border-t border-border p-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg p-2",
              collapsed && "justify-center"
            )}
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate max-w-[140px]">
                  {userName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {role.replace(/_/g, " ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Language Switcher */}
      <div className="border-t border-border px-2 pt-2 shrink-0">
        <LanguageSwitcher compact={collapsed} />
      </div>

      {/* Collapse Toggle */}
      <div className="px-2 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
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
    <div className={cn(!isFirst && "mt-4")}>
      {!collapsed ? (
        <button
          onClick={onToggleSection}
          className="w-full flex items-center justify-between px-3 py-1.5 group cursor-pointer"
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
            {section.label}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-150",
              sectionCollapsed && "-rotate-90"
            )}
          />
        </button>
      ) : (
        !isFirst && <div className="mx-auto w-6 h-px bg-border my-2" />
      )}

      {!sectionCollapsed && (
        <nav className="space-y-0.5">
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
        "relative flex items-center gap-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-100",
        collapsed ? "justify-center px-2" : "px-3",
        active
          ? "text-primary bg-primary/8 font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
      )}
      <item.icon
        className={cn(
          "w-[18px] h-[18px] shrink-0",
          active ? "text-primary" : "text-muted-foreground"
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
