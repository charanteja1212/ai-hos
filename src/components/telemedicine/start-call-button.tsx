"use client"

import { useState } from "react"
import { Video, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useFeatures } from "@/components/providers/features-context"
import { generateRoomName, getJitsiUrl } from "@/lib/telemedicine"
import { VideoCallDialog } from "./video-call-dialog"

interface StartCallButtonProps {
  tenantId: string
  appointmentId: string
  patientName: string
  doctorName: string
}

export function StartCallButton({
  tenantId,
  appointmentId,
  patientName,
  doctorName,
}: StartCallButtonProps) {
  const { hasFeature } = useFeatures()
  const [isCallOpen, setIsCallOpen] = useState(false)
  const [roomName, setRoomName] = useState("")

  const telemedicineEnabled = hasFeature("telemedicine")

  const handleStartCall = () => {
    const room = generateRoomName(tenantId, appointmentId)
    setRoomName(room)
    setIsCallOpen(true)
  }

  const handleCopyLink = () => {
    if (!roomName) {
      // Generate room if not already created
      const room = generateRoomName(tenantId, appointmentId)
      setRoomName(room)
      const url = getJitsiUrl(room, patientName)
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied to clipboard", {
          description: `Video call link for ${patientName} has been copied.`,
        })
      })
      return
    }
    const url = getJitsiUrl(roomName, patientName)
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard", {
        description: `Video call link for ${patientName} has been copied.`,
      })
    })
  }

  if (!telemedicineEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="outline" size="sm" disabled>
                <Video className="size-4 mr-1" />
                Video Call
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Upgrade to Medium plan for telemedicine
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={handleStartCall}>
          <Video className="size-4 mr-1" />
          Video Call
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleCopyLink}
          title="Copy link for patient"
        >
          <Copy className="size-4" />
        </Button>
      </div>

      {isCallOpen && (
        <VideoCallDialog
          roomName={roomName}
          displayName={`Dr. ${doctorName}`}
          isOpen={isCallOpen}
          onClose={() => setIsCallOpen(false)}
        />
      )}
    </>
  )
}
