"use client"

import { motion } from "framer-motion"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface StaggerListProps {
  children: React.ReactNode
  className?: string
  /** Delay between children in seconds. Default: 0.05 */
  staggerDelay?: number
}

/**
 * Wraps children in a staggered fade-in animation.
 * Each child animates in sequence with a configurable delay.
 *
 * Usage:
 *   <StaggerList className="grid grid-cols-4 gap-4">
 *     {cards.map(card => (
 *       <StaggerList.Item key={card.id}>
 *         <Card ... />
 *       </StaggerList.Item>
 *     ))}
 *   </StaggerList>
 */
export function StaggerList({ children, className, staggerDelay }: StaggerListProps) {
  const variants = staggerDelay
    ? {
        ...staggerContainer,
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay, delayChildren: 0.05 },
        },
      }
    : staggerContainer

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

StaggerList.Item = StaggerItem
