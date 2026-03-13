"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, CheckCircle2, Link2, AlertCircle } from "lucide-react"
import { formatAbhaNumber } from "@/lib/abdm/config"

interface AbhaCardProps {
  abhaNumber?: string | null
  abhaAddress?: string | null
  abhaStatus?: "not_linked" | "linked" | "verified" | null
  patientName?: string
  compact?: boolean
}

export function AbhaCard({ abhaNumber, abhaAddress, abhaStatus, patientName, compact }: AbhaCardProps) {
  const status = abhaStatus || "not_linked"
  const isLinked = status === "linked" || status === "verified"

  if (compact) {
    if (!isLinked) return null
    return (
      <div className="flex items-center gap-2 text-xs">
        <Shield className="w-3.5 h-3.5 text-emerald-600" />
        <span className="font-mono text-muted-foreground">{formatAbhaNumber(abhaNumber || "")}</span>
        {status === "verified" && (
          <Badge variant="secondary" className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> KYC Verified
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${isLinked ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-gray-300 to-gray-400"}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLinked ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ABHA Health ID</p>
              {isLinked ? (
                <>
                  <p className="font-mono text-sm font-semibold mt-0.5">
                    {formatAbhaNumber(abhaNumber || "")}
                  </p>
                  {abhaAddress && (
                    <p className="text-xs text-muted-foreground mt-0.5">{abhaAddress}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Not linked</p>
              )}
            </div>
          </div>
          <div>
            {status === "verified" ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-0 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </Badge>
            ) : status === "linked" ? (
              <Badge className="bg-blue-100 text-blue-800 border-0 gap-1">
                <Link2 className="w-3 h-3" /> Linked
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Not Linked
              </Badge>
            )}
          </div>
        </div>

        {isLinked && patientName && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{patientName}</span>
            <span className="flex items-center gap-1">
              <img src="/abdm-logo.svg" alt="ABDM" className="w-4 h-4 opacity-50" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              Ayushman Bharat Digital Mission
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
