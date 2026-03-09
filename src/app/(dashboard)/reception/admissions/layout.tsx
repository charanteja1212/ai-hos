"use client"

import { FeatureGate } from "@/components/shared/feature-gate"

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="ipd_module" featureName="Inpatient (IPD) Module">
      {children}
    </FeatureGate>
  )
}
