"use client"

import { useRef } from "react"
import { PrintLayout } from "@/components/print/print-layout"
import { PrescriptionPrint } from "@/components/print/prescription-print"
import type { Prescription } from "@/types/database"

interface RxViewProps {
  prescription: Prescription
  tenant: {
    hospital_name: string
    address?: string
    phone?: string
    logo_url?: string
  } | null
}

export function RxView({ prescription, tenant }: RxViewProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action bar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {tenant?.hospital_name || "Hospital"}
            </h1>
            <p className="text-sm text-gray-500">
              Prescription — {prescription.prescription_id}
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Print / Download PDF
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div className="max-w-3xl mx-auto p-4 print:p-0 print:max-w-none">
        <div
          ref={printRef}
          className="bg-white shadow-lg rounded-lg print:shadow-none print:rounded-none"
          style={{ padding: "24px 32px" }}
        >
          <PrintLayout
            tenant={tenant as never}
            title="Prescription"
            subtitle={`Ref: ${prescription.prescription_id}`}
          >
            <PrescriptionPrint prescription={prescription} />
          </PrintLayout>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { margin: 12mm 10mm; size: A4; }
        }
      `}</style>
    </div>
  )
}
