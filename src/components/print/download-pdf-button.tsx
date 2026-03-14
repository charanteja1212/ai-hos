"use client"

import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface DownloadPdfButtonProps {
  children: React.ReactNode
  documentTitle?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "icon"
  label?: string
  className?: string
}

export function DownloadPdfButton({
  children,
  documentTitle = "Document",
  variant = "outline",
  size = "sm",
  label = "Save PDF",
  className,
}: DownloadPdfButtonProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [portalReady, setPortalReady] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onAfterPrint: () => setPortalReady(false),
    print: async (printIframe) => {
      const contentDocument = printIframe.contentDocument
      if (contentDocument) {
        // Trigger browser's "Save as PDF" by opening print dialog
        // Users can select "Save as PDF" as the destination
        printIframe.contentWindow?.print()
      }
    },
  })

  const onClickDownload = () => {
    setPortalReady(true)
    setTimeout(() => handlePrint(), 100)
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={onClickDownload} className={className}>
        <Download className="w-4 h-4 mr-1.5" />
        {label}
      </Button>
      {portalReady &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", left: "-9999px", top: 0, width: "210mm" }}>
            <div ref={contentRef}>{children}</div>
          </div>,
          document.body
        )}
    </>
  )
}
