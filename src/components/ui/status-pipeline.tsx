"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface StatusPipelineProps {
  steps: string[]
  currentStep: number
  className?: string
  size?: "sm" | "md"
}

export function StatusPipeline({ steps, currentStep, className, size = "md" }: StatusPipelineProps) {
  const isSmall = size === "sm"

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-initial">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-bold shrink-0 transition-all",
              isSmall ? "w-4 h-4 text-[8px]" : "w-6 h-6 text-[10px]",
              i < currentStep && "bg-primary text-primary-foreground",
              i === currentStep && "bg-primary text-primary-foreground",
              i === currentStep && !isSmall && "ring-4 ring-primary/20",
              i === currentStep && isSmall && "ring-2 ring-primary/20",
              i > currentStep && "bg-muted text-muted-foreground"
            )}
            title={step}
          >
            {i < currentStep ? <Check className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 mx-0.5 transition-all",
                isSmall ? "h-[1.5px]" : "h-0.5 mx-1",
                i < currentStep ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
