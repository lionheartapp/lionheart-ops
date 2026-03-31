'use client'

import { useState, useCallback, useRef, useMemo } from 'react'

/**
 * useFormState — manages form values, dirty tracking, submission, and errors.
 *
 * Usage:
 *   const form = useFormState({
 *     initialValues: { email: '', firstName: '' },
 *     onSubmit: async (values) => { await api.create(values) },
 *   })
 *
 *   form.values.email           // current value
 *   form.setValue('email', 'x') // update one field
 *   form.isDirty                // true if values differ from initial
 *   form.isSubmitting           // true during async submit
 *   form.error                  // string | null
 *   form.handleSubmit(e)        // form onSubmit handler
 *   form.reset()                // revert to initialValues
 *   form.reset({ email: 'new' }) // reset to new initial values
 */

export interface UseFormStateOptions<T extends Record<string, unknown>> {
  initialValues: T
  onSubmit: (values: T) => Promise<void>
  /** Optional validation — return error string or null */
  validate?: (values: T) => string | null
}

export interface FormState<T extends Record<string, unknown>> {
  values: T
  setValue: <K extends keyof T>(key: K, value: T[K]) => void
  setValues: (partial: Partial<T>) => void
  isDirty: boolean
  isSubmitting: boolean
  error: string | null
  setError: (error: string | null) => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  reset: (newInitial?: T) => void
}

export function useFormState<T extends Record<string, unknown>>(
  options: UseFormStateOptions<T>
): FormState<T> {
  const { onSubmit, validate } = options
  const initialRef = useRef(options.initialValues)
  const [values, setValuesState] = useState<T>(options.initialValues)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialRef.current),
    [values]
  )

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setValues = useCallback((partial: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...partial }))
  }, [])

  const reset = useCallback((newInitial?: T) => {
    const next = newInitial ?? initialRef.current
    initialRef.current = next
    setValuesState(next)
    setError(null)
  }, [])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      if (validate) {
        const validationError = validate(values)
        if (validationError) {
          setError(validationError)
          return
        }
      }

      setIsSubmitting(true)
      setError(null)
      try {
        await onSubmit(values)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, onSubmit, validate]
  )

  return {
    values,
    setValue,
    setValues,
    isDirty,
    isSubmitting,
    error,
    setError,
    handleSubmit,
    reset,
  }
}
