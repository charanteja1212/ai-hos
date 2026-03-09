"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

export type DatePreset = "today" | "week" | "month" | "custom"

interface DateRangeFilterProps {
  from: string
  to: string
  preset: DatePreset
  onChange: (from: string, to: string, preset: DatePreset) => void
}

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split("T")[0]

  if (preset === "today") return { from: to, to }

  if (preset === "week") {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().split("T")[0], to }
  }

  if (preset === "month") {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return { from: d.toISOString().split("T")[0], to }
  }

  return { from: to, to }
}

const presets: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "30 Days" },
  { key: "custom", label: "Custom" },
]

export function DateRangeFilter({ from, to, preset, onChange }: DateRangeFilterProps) {
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  const handlePreset = (p: DatePreset) => {
    if (p === "custom") {
      onChange(customFrom, customTo, "custom")
      return
    }
    const dates = getPresetDates(p)
    onChange(dates.from, dates.to, p)
  }

  const handleCustomApply = () => {
    onChange(customFrom, customTo, "custom")
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.filter((p) => p.key !== "custom").map((p) => (
        <Button
          key={p.key}
          variant={preset === p.key ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs rounded-lg"
          onClick={() => handlePreset(p.key)}
        >
          {p.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs rounded-lg gap-1"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {preset === "custom" ? `${from} — ${to}` : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-3" align="end">
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">From</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={cn("h-8 text-xs rounded-lg w-36")}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">To</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs rounded-lg w-36"
              />
            </div>
          </div>
          <Button size="sm" className="w-full h-8 text-xs rounded-lg" onClick={handleCustomApply}>
            Apply
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { getPresetDates }
