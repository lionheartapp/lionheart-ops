'use client'

import { useState, useCallback } from 'react'

/**
 * useModalState — manages open/close state + optional associated data for modals/drawers.
 *
 * Replaces the common pattern of 2-3 useState hooks per modal:
 *   const [isOpen, setIsOpen] = useState(false)
 *   const [editItem, setEditItem] = useState<T | null>(null)
 *
 * Usage:
 *   const modal = useModalState<User>()
 *   modal.open(user)       // opens with data
 *   modal.data             // User | null
 *   modal.isOpen            // boolean
 *   modal.close()           // resets
 */
export interface ModalState<T> {
  isOpen: boolean
  data: T | null
  open: (data?: T) => void
  close: () => void
}

export function useModalState<T = void>(): ModalState<T> {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<T | null>(null)

  const open = useCallback((item?: T) => {
    setData(item ?? null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setData(null)
  }, [])

  return { isOpen, data, open, close }
}
