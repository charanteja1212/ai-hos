"use client"

import { FeatureGate } from "@/components/shared/feature-gate"

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="lab_module" featureName="Laboratory Module">
      {children}
    </FeatureGate>
  )
}
