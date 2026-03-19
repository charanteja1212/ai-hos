"use client"

import { useEffect, useRef, useCallback } from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "[contenteditable]",
].join(", ")

interface UseFocusTrapOptions {
  /** Whether the trap is currently active. */
  enabled?: boolean
  /** Element to return focus to when the trap is deactivated. Defaults to the element that was focused when the trap was enabled. */
  returnFocusTo?: HTMLElement | null
}

/**
 * Traps keyboard focus within a container element.
 * Useful for modals, dialogs, and drawers.
 *
 * Usage:
 *   const trapRef = useFocusTrap({ enabled: isOpen })
 *   <div ref={trapRef}>...modal content...</div>
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, returnFocusTo } = options
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    return Array.from(elements).filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
    )
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Store the currently focused element so we can return focus on cleanup
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Move focus into the container on mount
    const timer = setTimeout(() => {
      const focusable = getFocusableElements()
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        // If no focusable children, make the container itself focusable
        containerRef.current?.setAttribute("tabindex", "-1")
        containerRef.current?.focus()
      }
    }, 0)

    return () => {
      clearTimeout(timer)
      // Return focus to the trigger element
      const target = returnFocusTo ?? previousFocusRef.current
      if (target && typeof target.focus === "function") {
        target.focus()
      }
    }
  }, [enabled, returnFocusTo, getFocusableElements])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        // Shift+Tab: if focus is on the first element, wrap to last
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if focus is on the last element, wrap to first
        if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [enabled, getFocusableElements])

  return containerRef
}
