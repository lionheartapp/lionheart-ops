/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthHeaders, fetchApi } from '@/lib/api-client'

describe('getAuthHeaders', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Clear cookies
    document.cookie = 'csrf-token=; max-age=0'
  })

  it('includes Content-Type header', () => {
    const headers = getAuthHeaders()
    expect(headers).toHaveProperty('Content-Type', 'application/json')
  })

  it('includes X-CSRF-Token when csrf-token cookie exists', () => {
    document.cookie = 'csrf-token=abc123'
    const headers = getAuthHeaders()
    expect(headers).toHaveProperty('X-CSRF-Token', 'abc123')
  })

  it('omits X-CSRF-Token when no csrf-token cookie', () => {
    const headers = getAuthHeaders()
    expect(headers).not.toHaveProperty('X-CSRF-Token')
  })
})

describe('fetchApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
    // Clear cookies and localStorage
    document.cookie = 'csrf-token=; max-age=0'
    localStorage.clear()
  })

  it('returns data on successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { id: 1, name: 'Test' } }), { status: 200 })
    )

    const result = await fetchApi<{ id: number; name: string }>('/api/test')
    expect(result).toEqual({ id: 1, name: 'Test' })
  })

  it('sends credentials: include', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    )

    await fetchApi('/api/test')

    const [, init] = fetchSpy.mock.calls[0]
    expect(init!.credentials).toBe('include')
  })

  it('includes Content-Type header in requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    )

    await fetchApi('/api/test')

    const [, init] = fetchSpy.mock.calls[0]
    const headers = init!.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('throws and redirects to /login on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    )

    await expect(fetchApi('/api/protected')).rejects.toThrow('Session expired')
    expect(window.location.href).toBe('/login')
  })

  it('clears legacy localStorage keys on 401', async () => {
    localStorage.setItem('auth-token', 'jwt')
    localStorage.setItem('org-id', 'org-1')
    localStorage.setItem('user-name', 'Test')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    )

    await expect(fetchApi('/api/protected')).rejects.toThrow()

    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(localStorage.getItem('org-id')).toBeNull()
    expect(localStorage.getItem('user-name')).toBeNull()
  })

  it('throws with error message from API error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: ['field required'] },
      }), { status: 400 })
    )

    try {
      await fetchApi('/api/test')
      expect.unreachable('should have thrown')
    } catch (err) {
      const error = err as Error & { code?: string; details?: unknown }
      expect(error.message).toBe('Invalid input')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.details).toEqual(['field required'])
    }
  })

  it('throws generic message when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: {} }), { status: 500 })
    )

    await expect(fetchApi('/api/test')).rejects.toThrow('API Error')
  })

  it('merges custom headers with auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    )

    await fetchApi('/api/test', { headers: { 'X-Custom': 'value' } })

    const [, init] = fetchSpy.mock.calls[0]
    const headers = init!.headers as Record<string, string>
    expect(headers['X-Custom']).toBe('value')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
