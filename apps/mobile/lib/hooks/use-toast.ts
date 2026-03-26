/**
 * Toast context and hook — provides showToast/dismissToast across the app.
 */

import { createContext, useContext, useCallback, useRef, useState } from 'react'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export interface ToastData {
  readonly id: string
  readonly message: string
  readonly variant: ToastVariant
  readonly onUndo?: () => void
  readonly actionLabel?: string
  readonly onAction?: () => void
}

export interface ToastContextValue {
  readonly toast: ToastData | null
  readonly showToast: (opts: { message: string; variant?: ToastVariant; onUndo?: () => void; actionLabel?: string; onAction?: () => void }) => void
  readonly dismissToast: () => void
}

export const ToastContext = createContext<ToastContextValue>({
  toast: null,
  showToast: () => {},
  dismissToast: () => {},
})

export function useToastProvider(): ToastContextValue {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setToast(null)
  }, [])

  const showToast = useCallback(({ message, variant = 'info', onUndo, actionLabel, onAction }: { message: string; variant?: ToastVariant; onUndo?: () => void; actionLabel?: string; onAction?: () => void }) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const id = `${Date.now()}-${Math.random()}`
    setToast({ id, message, variant, onUndo, actionLabel, onAction })

    const timeout = (onUndo || onAction) ? 5000 : 3000
    timerRef.current = setTimeout(() => {
      setToast(null)
      timerRef.current = null
    }, timeout)
  }, [])

  return { toast, showToast, dismissToast }
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
