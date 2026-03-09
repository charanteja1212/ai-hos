"use client"

import { useEffect, useRef } from "react"
import { useMotionValue, useSpring } from "framer-motion"

interface AnimatedCounterProps {
  value: number
  className?: string
  prefix?: string
  suffix?: string
  duration?: number
}

export function AnimatedCounter({ value, className, prefix = "", suffix = "", duration = 0.8 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 })

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(latest).toLocaleString()}${suffix}`
      }
    })
    return unsubscribe
  }, [springValue, prefix, suffix])

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}
