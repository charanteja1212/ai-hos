"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Video, ExternalLink, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getJitsiUrl } from "@/lib/telemedicine"

interface VideoCallDialogProps {
  roomName: string
  displayName?: string
  isOpen: boolean
  onClose: () => void
}

export function VideoCallDialog({
  roomName,
  displayName,
  isOpen,
  onClose,
}: VideoCallDialogProps) {
  const jitsiUrl = getJitsiUrl(roomName, displayName)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[95vw] h-[95vh] flex flex-col p-0 gap-0"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <DialogHeader className="flex-row items-center gap-2">
                  <Video className="size-5 text-primary" />
                  <div>
                    <DialogTitle className="text-base">
                      Video Consultation
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Room: {roomName}
                    </DialogDescription>
                  </div>
                </DialogHeader>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={jitsiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 mr-1" />
                      Open in new tab
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onClose}
                  >
                    <X className="size-4 mr-1" />
                    End Call
                  </Button>
                </div>
              </div>

              {/* Jitsi iframe */}
              <div className="flex-1 min-h-0">
                <iframe
                  src={`https://meet.jit.si/${roomName}`}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  className="w-full h-full border-0"
                  title="Video Consultation"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
