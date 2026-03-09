"use client"

import { motion } from "framer-motion"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  filters?: React.ReactNode
  actions?: React.ReactNode
  onSubmit?: () => void
}

export function SearchBar({ value, onChange, placeholder = "Search...", className, filters, actions, onSubmit }: SearchBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-subtle rounded-xl p-3 flex flex-wrap items-center gap-3",
        className
      )}
    >
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 input-focus-glow"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => onChange("")}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {filters}
      {actions}
    </motion.div>
  )
}
