import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}))

import { validateAddress } from '@/lib/services/addressValidationService'

describe('validateAddress', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns null when no API key is set', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY

    const result = await validateAddress('123 Main St')
    expect(result).toBeNull()
  })

  it('returns valid result for complete address', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: true, validationGranularity: 'PREMISE' },
          address: { formattedAddress: '123 Main St, Springfield, IL 62701' },
          geocode: { location: { latitude: 39.7817, longitude: -89.6501 } },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('123 Main St Springfield IL')
    expect(result).not.toBeNull()
    expect(result!.valid).toBe(true)
    expect(result!.formattedAddress).toBe('123 Main St, Springfield, IL 62701')
    expect(result!.lat).toBe(39.7817)
    expect(result!.lng).toBe(-89.6501)
  })

  it('includes suggestion when formatted address differs from input', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: true },
          address: { formattedAddress: '123 Main Street, Springfield, IL 62701' },
          geocode: { location: { latitude: 39.78, longitude: -89.65 } },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('123 main st springfield')
    expect(result!.suggestion).toBe('123 Main Street, Springfield, IL 62701')
  })

  it('omits suggestion when formatted address matches input (normalized)', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: true },
          address: { formattedAddress: '123 Main St' },
          geocode: { location: { latitude: 39.78, longitude: -89.65 } },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('123 Main St')
    expect(result!.suggestion).toBeUndefined()
  })

  it('marks address as valid for SUB_PREMISE granularity', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { validationGranularity: 'SUB_PREMISE' },
          address: { formattedAddress: '123 Main St Apt 4B' },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('123 Main St Apt 4B')
    expect(result!.valid).toBe(true)
  })

  it('marks address as invalid for ROUTE granularity without addressComplete', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: false, validationGranularity: 'ROUTE' },
          address: { formattedAddress: 'Main St' },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('Main St')
    expect(result!.valid).toBe(false)
  })

  it('returns null when API returns non-OK status', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Error', { status: 403 })
    )

    const result = await validateAddress('123 Main St')
    expect(result).toBeNull()
  })

  it('returns null when API returns empty result', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )

    const result = await validateAddress('123 Main St')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await validateAddress('123 Main St')
    expect(result).toBeNull()
  })

  it('returns null lat/lng when geocode is missing', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: true },
          address: { formattedAddress: '123 Main St' },
        },
      }), { status: 200 })
    )

    const result = await validateAddress('123 Main St')
    expect(result!.lat).toBeNull()
    expect(result!.lng).toBeNull()
  })

  it('falls back to GEMINI_API_KEY when GOOGLE_MAPS_API_KEY is not set', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        result: {
          verdict: { addressComplete: true },
          address: { formattedAddress: '123 Main St' },
        },
      }), { status: 200 })
    )

    await validateAddress('123 Main St')
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain('key=gemini-key')
  })
})
