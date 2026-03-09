"use client"

import { useState, useRef, useEffect } from "react"
import { useMedicines } from "@/hooks/use-pharmacy"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pill } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Medicine } from "@/types/database"

interface MedicineComboboxProps {
  tenantId: string
  value: string
  onChange: (medicine: { name: string; dosage: string; salt?: string; form?: string }) => void
  placeholder?: string
  className?: string
}

export function MedicineCombobox({
  tenantId,
  value,
  onChange,
  placeholder = "Search medicine...",
  className,
}: MedicineComboboxProps) {
  const { medicines } = useMedicines(tenantId)
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Filter medicines based on input
  const filtered = inputValue.trim()
    ? medicines.filter((m) => {
        const q = inputValue.toLowerCase()
        return (
          m.medicine_name.toLowerCase().includes(q) ||
          m.salt?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q)
        )
      }).slice(0, 8)
    : []

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (med: Medicine) => {
    setInputValue(med.medicine_name)
    onChange({
      name: med.medicine_name,
      dosage: med.dosage || "",
      salt: med.salt || undefined,
      form: med.form || undefined,
    })
    setOpen(false)
  }

  const handleInputChange = (val: string) => {
    setInputValue(val)
    setOpen(val.trim().length > 0)
    setHighlightIndex(0)
    // Still update parent with the typed name (free-text entry)
    onChange({ name: val, dosage: "" })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      handleSelect(filtered[highlightIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { if (inputValue.trim()) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
        >
          {filtered.map((med, idx) => (
            <div
              key={med.medicine_id}
              onClick={() => handleSelect(med)}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors",
                idx === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50"
              )}
            >
              <Pill className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{med.medicine_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {med.salt && <span>{med.salt}</span>}
                  {med.dosage && <span>&middot; {med.dosage}</span>}
                </div>
              </div>
              {med.category && (
                <Badge variant="outline" className="text-[10px] shrink-0">{med.category}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
