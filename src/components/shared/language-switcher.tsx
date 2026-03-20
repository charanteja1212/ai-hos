"use client"

import { Languages, Lock } from "lucide-react"
import { useLanguage } from "@/components/providers/language-context"
import { useFeatures } from "@/components/providers/features-context"
import { LANGUAGES } from "@/lib/i18n"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  const { hasFeature } = useFeatures()
  const multiLangEnabled = hasFeature("multi_language")

  const current = LANGUAGES.find((l) => l.code === language)

  // Basic tier: show only English, with lock icon hint
  if (!multiLangEnabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${compact ? "px-2" : "w-[140px]"} inline-flex items-center gap-1.5 h-8 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm px-3 opacity-60 cursor-not-allowed`}>
            <Languages className="size-4 shrink-0" />
            <span className="text-xs">{compact ? "EN" : "English"}</span>
            <Lock className="size-3 shrink-0 ml-auto" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Multi-language requires Medium plan or above</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Select value={language} onValueChange={(val) => setLanguage(val as typeof language)}>
      <SelectTrigger
        size="sm"
        className={`${compact ? "w-auto gap-1.5 px-2" : "w-[140px]"} bg-muted/50 border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors rounded-xl`}
        aria-label="Select language"
      >
        <Languages className="size-4 shrink-0" />
        <SelectValue>
          {compact ? current?.code.toUpperCase() : current?.nativeLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.nativeLabel} ({lang.label})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
