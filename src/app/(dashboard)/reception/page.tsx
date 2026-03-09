"use client"

import { QueueBoard } from "@/components/reception/queue-board"
import { SectionHeader } from "@/components/shared/section-header"

export default function ReceptionPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Queue Board"
        subtitle="Live patient queue management"
      />
      <QueueBoard />
    </div>
  )
}
