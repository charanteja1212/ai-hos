import { SessionProvider } from "@/components/layout/session-provider"
import { PatientShell } from "@/components/patient/patient-shell"
import { PersonFilterProvider } from "@/components/patient/person-filter"

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PatientShell>
        <PersonFilterProvider>{children}</PersonFilterProvider>
      </PatientShell>
    </SessionProvider>
  )
}
