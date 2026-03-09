"use client"

import { BookingForm } from "@/components/reception/booking-form"

export default function BookingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Walk-in Booking</h1>
        <p className="text-muted-foreground">Book appointments in under 5 seconds</p>
      </div>
      <BookingForm />
    </div>
  )
}
