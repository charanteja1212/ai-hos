"use client"

import { Languages } from "lucide-react"
import { useLanguage } from "@/components/providers/language-context"
import { LANGUAGES } from "@/lib/i18n"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()

  const current = LANGUAGES.find((l) => l.code === language)

  return (
    <Select value={language} onValueChange={(val) => setLanguage(val as typeof language)}>
      <SelectTrigger
        size="sm"
        className={compact ? "w-auto gap-1.5 px-2" : "w-[140px]"}
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
