"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { createBrowserClient } from "@/lib/supabase/client"
import { Users } from "lucide-react"
import type { SessionUser } from "@/types/auth"

interface PersonFilterContextType {
  personNames: { name: string; count: number }[]
  selectedPerson: string | null
  setSelectedPerson: (name: string | null) => void
  hasMultiplePeople: boolean
  filterByPerson: <T extends Record<string, unknown>>(items: T[]) => T[]
}

const PersonFilterContext = createContext<PersonFilterContextType>({
  personNames: [],
  selectedPerson: null,
  setSelectedPerson: () => {},
  hasMultiplePeople: false,
  filterByPerson: (items) => items,
})

export function PersonFilterProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined
  const phone = user?.patientPhone

  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)

  // Fetch all appointments to derive person names
  const { data: appointments } = useSWR(
    phone ? `person-filter-${phone}` : null,
    async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("appointments")
        .select("patient_name, date")
        .eq("patient_phone", phone!)
        .order("date", { ascending: false })
      return data || []
    }
  )

  const personNames = useMemo(() => {
    if (!appointments) return []
    const names = new Map<string, { count: number; latestDate: string }>()
    for (const appt of appointments) {
      const name = (appt.patient_name as string)?.trim()
      if (!name) continue
      const existing = names.get(name)
      if (!existing || (appt.date && appt.date > existing.latestDate)) {
        names.set(name, { count: (existing?.count || 0) + 1, latestDate: appt.date || "" })
      }
    }
    return Array.from(names.entries())
      .sort((a, b) => b[1].latestDate.localeCompare(a[1].latestDate))
      .map(([name, info]) => ({ name, count: info.count }))
  }, [appointments])

  useEffect(() => {
    if (personNames.length > 1 && !selectedPerson) {
      setSelectedPerson(personNames[0].name)
    }
  }, [personNames, selectedPerson])

  const hasMultiplePeople = personNames.length > 1

  const filterByPerson = useCallback(<T extends Record<string, unknown>>(items: T[]): T[] => {
    if (!hasMultiplePeople || !selectedPerson) return items
    const filtered = items.filter((item) => item.patient_name === selectedPerson)
    // If no items match by name (old records may not have patient_name), return all
    return filtered.length > 0 || items.some((item) => item.patient_name) ? filtered : items
  }, [hasMultiplePeople, selectedPerson])

  return (
    <PersonFilterContext.Provider value={{ personNames, selectedPerson, setSelectedPerson, hasMultiplePeople, filterByPerson }}>
      {children}
    </PersonFilterContext.Provider>
  )
}

export function usePersonFilter() {
  return useContext(PersonFilterContext)
}

export function PersonSelectorBar() {
  const { personNames, selectedPerson, setSelectedPerson, hasMultiplePeople } = usePersonFilter()

  if (!hasMultiplePeople) return null

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-4">
      <Users className="w-4 h-4 text-blue-500 shrink-0" />
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300 mr-1">Viewing records for:</span>
      {personNames.map((p) => (
        <button
          key={p.name}
          onClick={() => setSelectedPerson(p.name)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selectedPerson === p.name
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-slate-200 dark:border-slate-700"
          }`}
        >
          {p.name} ({p.count})
        </button>
      ))}
    </div>
  )
}
