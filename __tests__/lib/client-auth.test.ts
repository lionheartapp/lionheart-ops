/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAuthResponse } from '@/lib/client-auth'

describe('handleAuthResponse', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset localStorage
    localStorage.clear()
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('returns true for 401 response', () => {
    const response = new Response(null, { status: 401 })
    expect(handleAuthResponse(response)).toBe(true)
  })

  it('returns false for 200 response', () => {
    const response = new Response(null, { status: 200 })
    expect(handleAuthResponse(response)).toBe(false)
  })

  it('returns false for 403 response', () => {
    const response = new Response(null, { status: 403 })
    expect(handleAuthResponse(response)).toBe(false)
  })

  it('returns false for 500 response', () => {
    const response = new Response(null, { status: 500 })
    expect(handleAuthResponse(response)).toBe(false)
  })

  it('clears legacy localStorage keys on 401', () => {
    localStorage.setItem('auth-token', 'jwt')
    localStorage.setItem('org-id', 'org-1')
    localStorage.setItem('user-name', 'Test')

    const response = new Response(null, { status: 401 })
    handleAuthResponse(response)

    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(localStorage.getItem('org-id')).toBeNull()
    expect(localStorage.getItem('user-name')).toBeNull()
  })

  it('redirects to /login on 401', () => {
    const response = new Response(null, { status: 401 })
    handleAuthResponse(response)
    expect(window.location.href).toBe('/login')
  })

  it('does not clear localStorage on non-401', () => {
    localStorage.setItem('auth-token', 'jwt')
    const response = new Response(null, { status: 200 })
    handleAuthResponse(response)
    expect(localStorage.getItem('auth-token')).toBe('jwt')
  })
})
