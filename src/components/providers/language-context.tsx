"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { t as translate, type UILanguage } from "@/lib/i18n"

interface LanguageContextValue {
  language: UILanguage
  setLanguage: (lang: UILanguage) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UILanguage>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ai-hos-lang") as UILanguage) || "en"
    }
    return "en"
  })

  const setLanguage = useCallback((lang: UILanguage) => {
    setLanguageState(lang)
    localStorage.setItem("ai-hos-lang", lang)
  }, [])

  const t = useCallback((key: string) => translate(key, language), [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
