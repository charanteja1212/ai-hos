"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface PremiumDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  gradient?: string
  maxWidth?: string
  children: React.ReactNode
}

export function PremiumDialog({
  open, onOpenChange, title, subtitle, icon, gradient, maxWidth = "sm:max-w-lg", children
}: PremiumDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(maxWidth, "max-h-[85vh] overflow-y-auto p-0 gap-0")}>
        <div className={cn(
          "px-6 pt-6 pb-4 rounded-t-lg",
          gradient ? gradient : "bg-muted/30"
        )}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {icon && (
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  gradient ? "bg-white/20 backdrop-blur text-white" : "bg-primary/10 text-primary"
                )}>
                  {icon}
                </div>
              )}
              <div>
                <DialogTitle className={gradient ? "text-white" : ""}>{title}</DialogTitle>
                {subtitle && (
                  <p className={cn("text-sm mt-0.5", gradient ? "text-white/70" : "text-muted-foreground")}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
