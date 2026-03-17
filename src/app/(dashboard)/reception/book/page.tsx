"use client"

import { motion } from "framer-motion"
import { Zap, Clock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BookingForm } from "@/components/reception/booking-form"

export default function BookingPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-blue flex items-center justify-center text-white relative">
            <Zap className="w-6 h-6" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-green flex items-center justify-center"
            >
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </motion.div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Walk-in Booking</h1>
              <Badge className="bg-green-500/90 text-white border-0 text-[10px] px-2 gap-1">
                <Clock className="w-3 h-3" /> Under 5 sec
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Quick appointment booking with instant queue assignment
            </p>
          </div>
        </div>
      </motion.div>
      <BookingForm />
    </div>
  )
}
