/**
 * Centralized motion configuration for AI-HOS.
 * All animation constants, variants, and transitions live here.
 *
 * Usage:
 *   import { fadeIn, stagger, springTransition } from "@/lib/motion"
 *   <motion.div variants={fadeIn} initial="hidden" animate="visible" />
 */
import type { Variants, Transition } from "framer-motion"

// ─── TIMING CONSTANTS ───
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  counter: 0.8,
} as const

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,       // cubic-bezier — smooth deceleration
  inOut: [0.4, 0, 0.2, 1] as const,        // material-style
  spring: { type: "spring" as const, stiffness: 400, damping: 30 },
  springBounce: { type: "spring" as const, stiffness: 500, damping: 25 },
  springStiff: { type: "spring" as const, stiffness: 600, damping: 35 },
}

// ─── TRANSITIONS ───
export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE.out } satisfies Transition,
  normal: { duration: DURATION.normal, ease: EASE.out } satisfies Transition,
  slow: { duration: DURATION.slow, ease: EASE.out } satisfies Transition,
  spring: EASE.spring satisfies Transition,
  springBounce: EASE.springBounce satisfies Transition,
  page: { duration: 0.3, ease: EASE.inOut } satisfies Transition,
}

// ─── VARIANT PRESETS ───

/** Fade in from slightly below */
export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transitions.normal },
}

/** Fade in from left */
export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: transitions.normal },
}

/** Fade in from right */
export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: transitions.normal },
}

/** Scale in (for modals, popovers) */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: transitions.fast },
  exit: { opacity: 0, scale: 0.95, transition: transitions.fast },
}

/** Page-level transition */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.page },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

/** Container that staggers its children */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
}

/** Individual stagger item (use with staggerContainer) */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
}

/** Slide in for notification/toast items */
export const slideInItem: Variants = {
  hidden: { opacity: 0, x: -8, height: 0 },
  visible: {
    opacity: 1,
    x: 0,
    height: "auto",
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    x: 8,
    height: 0,
    transition: transitions.fast,
  },
}

// ─── MICRO-INTERACTIONS ───
// Use directly on motion elements: whileHover={hover.lift}

export const hover = {
  /** Subtle lift effect — for cards */
  lift: { y: -2, transition: transitions.fast },
  /** Scale up — for buttons, badges */
  scale: { scale: 1.02, transition: transitions.fast },
  /** Glow border — combine with CSS */
  none: {},
}

export const tap = {
  /** Press-in effect */
  press: { scale: 0.98, transition: { duration: DURATION.instant } },
  /** Subtle press */
  subtle: { scale: 0.995, transition: { duration: DURATION.instant } },
}

// ─── REDUCED MOTION ───
// Respects prefers-reduced-motion automatically when used with CSS.
// For framer-motion, wrap your <MotionConfig reducedMotion="user"> at app root.

/** Returns static variants (no motion) — use as fallback */
export const noMotion: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
}
