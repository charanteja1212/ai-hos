import { SessionProvider } from "@/components/layout/session-provider"
import { PatientShell } from "@/components/patient/patient-shell"

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PatientShell>{children}</PatientShell>
    </SessionProvider>
  )
}
