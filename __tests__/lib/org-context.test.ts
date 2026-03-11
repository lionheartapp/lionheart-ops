import { describe, it, expect } from 'vitest'
import { runWithOrgContext, getOrgContextId, getOrgIdFromRequest } from '@/lib/org-context'
import { NextRequest } from 'next/server'

describe('runWithOrgContext / getOrgContextId', () => {
  it('makes getOrgContextId return the orgId inside the callback', async () => {
    let capturedId: string | undefined

    await runWithOrgContext('org-1', async () => {
      capturedId = getOrgContextId()
    })

    expect(capturedId).toBe('org-1')
  })

  it('throws "Organization context is missing" when called outside runWithOrgContext', () => {
    expect(() => getOrgContextId()).toThrow('Organization context is missing')
  })
})

describe('getOrgIdFromRequest', () => {
  it('returns the x-org-id header value when present', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-org-id': 'org-abc' },
    })

    const result = getOrgIdFromRequest(req)
    expect(result).toBe('org-abc')
  })

  it('throws "Missing x-org-id header" when header is absent', () => {
    const req = new NextRequest('http://localhost/api/test')

    expect(() => getOrgIdFromRequest(req)).toThrow('Missing x-org-id header')
  })
})
