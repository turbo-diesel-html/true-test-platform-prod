"use client"

import { useState, useCallback } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }

    setToasts((prev) => [...prev, newToast])

    // Автоматично видаляємо toast через 5 секунд
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback(
    (title: string, description?: string) => {
      return addToast({ type: "success", title, description })
    },
    [addToast],
  )

  const error = useCallback(
    (title: string, description?: string) => {
      return addToast({ type: "error", title, description })
    },
    [addToast],
  )

  const info = useCallback(
    (title: string, description?: string) => {
      return addToast({ type: "info", title, description })
    },
    [addToast],
  )

  const warning = useCallback(
    (title: string, description?: string) => {
      return addToast({ type: "warning", title, description })
    },
    [addToast],
  )

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  }
}
