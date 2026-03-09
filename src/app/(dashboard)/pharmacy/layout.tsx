"use client"

import { FeatureGate } from "@/components/shared/feature-gate"

export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="pharmacy_module" featureName="Pharmacy Module">
      {children}
    </FeatureGate>
  )
}
