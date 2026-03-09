import { SessionProvider } from "@/components/layout/session-provider"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  )
}
