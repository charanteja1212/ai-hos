"use client"

import { useRef, useState } from "react"
import { useReactToPrint } from "react-to-print"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintButtonProps {
  children: React.ReactNode
  documentTitle?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "icon"
  label?: string
  className?: string
}

export function PrintButton({
  children,
  documentTitle = "Document",
  variant = "outline",
  size = "sm",
  label = "Print",
  className,
}: PrintButtonProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [portalReady, setPortalReady] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onAfterPrint: () => setPortalReady(false),
  })

  const onClickPrint = () => {
    setPortalReady(true)
    // Allow the portal to render before triggering print
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={onClickPrint} className={className}>
        <Printer className="w-4 h-4 mr-1.5" />
        {label}
      </Button>
      {portalReady &&
        typeof document !== "undefined" &&
        createPortal(
          <div id="print-portal" style={{ position: "fixed", left: "-9999px", top: 0, width: "210mm" }}>
            <div ref={contentRef}>{children}</div>
          </div>,
          document.body
        )}
    </>
  )
}
