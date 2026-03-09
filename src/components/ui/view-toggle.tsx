"use client"

import { cn } from "@/lib/utils"
import { LayoutGrid, List, Columns3 } from "lucide-react"

export type ViewMode = "board" | "table" | "grid"

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  options?: ViewMode[]
  className?: string
}

const icons: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  board: Columns3,
  table: List,
  grid: LayoutGrid,
}

const labels: Record<ViewMode, string> = {
  board: "Board",
  table: "Table",
  grid: "Grid",
}

export function ViewToggle({ value, onChange, options = ["board", "table"], className }: ViewToggleProps) {
  return (
    <div className={cn("inline-flex items-center rounded-xl bg-muted p-1 gap-0.5", className)}>
      {options.map((mode) => {
        const Icon = icons[mode]
        const isActive = value === mode
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {labels[mode]}
          </button>
        )
      })}
    </div>
  )
}
