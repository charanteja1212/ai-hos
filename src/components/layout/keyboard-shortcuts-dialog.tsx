"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Shortcut } from "@/hooks/use-keyboard-shortcuts"

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: Shortcut[]
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-muted text-[11px] font-mono font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  navigation: "Navigation",
  actions: "Actions",
}

const CATEGORY_ORDER = ["general", "navigation", "actions"]

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: shortcuts.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {grouped.map((group) => (
            <div key={group.category}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className={cn(
                      "flex items-center justify-between py-1.5 px-2 rounded-lg",
                      "hover:bg-accent/40 transition-colors"
                    )}
                  >
                    <span className="text-sm text-foreground">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && shortcut.keys.length === 2 && shortcut.keys[0] !== "Ctrl" && (
                            <span className="text-[10px] text-muted-foreground/50 mx-0.5">then</span>
                          )}
                          {i > 0 && shortcut.keys[0] === "Ctrl" && (
                            <span className="text-[10px] text-muted-foreground/50 mx-0.5">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 text-center mt-1">
          Press <Kbd>?</Kbd> to toggle this dialog
        </p>
      </DialogContent>
    </Dialog>
  )
}
