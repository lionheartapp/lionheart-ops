/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormState } from '@/lib/hooks/useFormState'

interface TestValues {
  email: string
  firstName: string
}

const defaults: TestValues = { email: '', firstName: '' }

describe('useFormState', () => {
  it('initializes with provided values', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    expect(result.current.values).toEqual(defaults)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setValue updates a single field and marks dirty', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    act(() => result.current.setValue('email', 'alice@test.com'))

    expect(result.current.values.email).toBe('alice@test.com')
    expect(result.current.isDirty).toBe(true)
  })

  it('setValues updates multiple fields', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    act(() => result.current.setValues({ email: 'a@b.com', firstName: 'Alice' }))

    expect(result.current.values.email).toBe('a@b.com')
    expect(result.current.values.firstName).toBe('Alice')
  })

  it('reset reverts to initial values', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    act(() => result.current.setValue('email', 'changed'))
    expect(result.current.isDirty).toBe(true)

    act(() => result.current.reset())

    expect(result.current.values).toEqual(defaults)
    expect(result.current.isDirty).toBe(false)
  })

  it('reset with new initial values updates the baseline', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    const newDefaults: TestValues = { email: 'new@test.com', firstName: 'New' }
    act(() => result.current.reset(newDefaults))

    expect(result.current.values).toEqual(newDefaults)
    expect(result.current.isDirty).toBe(false)
  })

  it('handleSubmit calls onSubmit and manages isSubmitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useFormState({
        initialValues: { email: 'test@x.com', firstName: 'Test' },
        onSubmit,
      })
    )

    await act(() => result.current.handleSubmit())

    expect(onSubmit).toHaveBeenCalledWith({ email: 'test@x.com', firstName: 'Test' })
    expect(result.current.isSubmitting).toBe(false)
  })

  it('handleSubmit sets error on failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit,
      })
    )

    await act(() => result.current.handleSubmit())

    expect(result.current.error).toBe('Network error')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('validate prevents submission and sets error', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit,
        validate: (v) => (v.email ? null : 'Email is required'),
      })
    )

    await act(() => result.current.handleSubmit())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Email is required')
  })

  it('validate passes when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useFormState({
        initialValues: { email: 'ok@test.com', firstName: 'OK' },
        onSubmit,
        validate: (v) => (v.email ? null : 'Email is required'),
      })
    )

    await act(() => result.current.handleSubmit())

    expect(onSubmit).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('setError sets a custom error', () => {
    const { result } = renderHook(() =>
      useFormState({
        initialValues: defaults,
        onSubmit: vi.fn(),
      })
    )

    act(() => result.current.setError('Custom error'))
    expect(result.current.error).toBe('Custom error')

    act(() => result.current.setError(null))
    expect(result.current.error).toBeNull()
  })
})
