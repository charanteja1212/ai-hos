"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

interface OptimisticActionOptions<TData, TResult> {
  /** Current data from SWR/state */
  data: TData
  /** SWR mutate function or setState */
  mutate: (data?: TData | Promise<TData>, opts?: { optimisticData?: TData; rollbackOnError?: boolean; revalidate?: boolean }) => void
  /** Transform data optimistically before the server responds */
  optimisticUpdate: (current: TData) => TData
  /** The actual async action (API call, Supabase mutation, etc.) */
  action: () => Promise<TResult>
  /** Success message for toast */
  successMessage?: string
  /** Error message for toast (overrides server error) */
  errorMessage?: string
  /** Called after successful action */
  onSuccess?: (result: TResult) => void
  /** Called after failed action */
  onError?: (error: Error) => void
}

/**
 * Generic optimistic update hook for SWR-backed data.
 *
 * Usage:
 *   const { execute, isPending } = useOptimisticAction()
 *   execute({
 *     data: appointments,
 *     mutate,
 *     optimisticUpdate: (list) => list.filter(a => a.id !== id),
 *     action: () => supabase.from("appointments").delete().eq("id", id),
 *     successMessage: "Appointment cancelled",
 *   })
 */
export function useOptimisticAction() {
  const [isPending, setIsPending] = useState(false)

  const execute = useCallback(async <TData, TResult>(opts: OptimisticActionOptions<TData, TResult>) => {
    const { data, mutate, optimisticUpdate, action, successMessage, errorMessage, onSuccess, onError } = opts
    const previous = data

    setIsPending(true)

    // Apply optimistic update immediately
    try {
      mutate(optimisticUpdate(data), { revalidate: false })
    } catch {
      // If optimistic update fails, continue with action anyway
    }

    try {
      const result = await action()
      // Revalidate to get server truth
      mutate(undefined, { revalidate: true })
      if (successMessage) toast.success(successMessage)
      onSuccess?.(result)
      return result
    } catch (err) {
      // Rollback to previous data
      mutate(previous, { revalidate: false })
      const message = errorMessage || (err instanceof Error ? err.message : "Action failed")
      toast.error(message)
      onError?.(err instanceof Error ? err : new Error(message))
      return null
    } finally {
      setIsPending(false)
    }
  }, [])

  return { execute, isPending }
}

/**
 * Optimistic update helper for queue status changes.
 * Pre-configured for the most common queue operations.
 */
export function useOptimisticQueueUpdate() {
  const { execute, isPending } = useOptimisticAction()

  const updateStatus = useCallback(<T extends { queue_id?: string; status?: string }>(
    entries: T[],
    mutate: (data?: T[], opts?: { revalidate?: boolean }) => void,
    queueId: string,
    newStatus: string,
    action: () => Promise<unknown>,
    message?: string,
  ) => {
    return execute({
      data: entries,
      mutate: mutate as (data?: T[] | Promise<T[]>, opts?: { revalidate?: boolean }) => void,
      optimisticUpdate: (list) =>
        list.map((e) => (e.queue_id === queueId ? { ...e, status: newStatus } : e)),
      action,
      successMessage: message || `Status updated to ${newStatus}`,
    })
  }, [execute])

  return { updateStatus, isPending }
}

/**
 * Optimistic update helper for appointment cancellation.
 */
export function useOptimisticAppointmentCancel() {
  const { execute, isPending } = useOptimisticAction()

  const cancel = useCallback(<T extends { booking_id?: string; status?: string }>(
    appointments: T[],
    mutate: (data?: T[] | Promise<T[]>, opts?: { revalidate?: boolean }) => void,
    bookingId: string,
    action: () => Promise<unknown>,
  ) => {
    return execute({
      data: appointments,
      mutate,
      optimisticUpdate: (list) =>
        list.map((a) => (a.booking_id === bookingId ? { ...a, status: "cancelled" } : a)),
      action,
      successMessage: "Appointment cancelled",
      errorMessage: "Failed to cancel appointment",
    })
  }, [execute])

  return { cancel, isPending }
}
