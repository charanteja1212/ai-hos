export type UILanguage = "en" | "hi"

export type Translations = Record<string, string>

import en from "./translations/en"
import hi from "./translations/hi"

const translations: Record<UILanguage, Translations> = { en, hi }

export function t(key: string, lang: UILanguage = "en"): string {
  return translations[lang]?.[key] || translations.en[key] || key
}

export const LANGUAGES: { code: UILanguage; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
]
