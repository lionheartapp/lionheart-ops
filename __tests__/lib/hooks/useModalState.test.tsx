/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useModalState } from '@/lib/hooks/useModalState'

interface TestUser {
  id: string
  name: string
}

describe('useModalState', () => {
  it('starts closed with null data', () => {
    const { result } = renderHook(() => useModalState<TestUser>())

    expect(result.current.isOpen).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('opens with data', () => {
    const { result } = renderHook(() => useModalState<TestUser>())
    const user: TestUser = { id: '1', name: 'Alice' }

    act(() => result.current.open(user))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.data).toEqual(user)
  })

  it('opens without data', () => {
    const { result } = renderHook(() => useModalState())

    act(() => result.current.open())

    expect(result.current.isOpen).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('close resets both isOpen and data', () => {
    const { result } = renderHook(() => useModalState<TestUser>())
    const user: TestUser = { id: '1', name: 'Alice' }

    act(() => result.current.open(user))
    expect(result.current.isOpen).toBe(true)

    act(() => result.current.close())

    expect(result.current.isOpen).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('can re-open with different data', () => {
    const { result } = renderHook(() => useModalState<TestUser>())
    const alice: TestUser = { id: '1', name: 'Alice' }
    const bob: TestUser = { id: '2', name: 'Bob' }

    act(() => result.current.open(alice))
    expect(result.current.data).toEqual(alice)

    act(() => result.current.close())
    act(() => result.current.open(bob))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.data).toEqual(bob)
  })
})
