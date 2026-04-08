import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCached,
  invalidateSettingsCache,
  invalidateOrgCache,
  invalidateCacheByType,
  clearSettingsCache,
  settingsCacheKey,
  globalCacheKey,
} from '@/lib/cache/settings-cache'

describe('settingsCacheKey', () => {
  it('builds org:type key', () => {
    expect(settingsCacheKey('org-1', 'roles')).toBe('org-1:roles')
  })
})

describe('globalCacheKey', () => {
  it('builds global:type key', () => {
    expect(globalCacheKey('permissions')).toBe('global:permissions')
  })
})

describe('getCached', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSettingsCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetcher on first access', async () => {
    const fetcher = vi.fn().mockResolvedValue(['role-1', 'role-2'])
    const result = await getCached('org-1:roles', fetcher)
    expect(result).toEqual(['role-1', 'role-2'])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('returns cached value on second access within TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    await getCached('key', fetcher, 60_000)
    const result = await getCached('key', fetcher, 60_000)
    expect(result).toBe('data')
    expect(fetcher).toHaveBeenCalledOnce() // not called again
  })

  it('re-fetches after TTL expires', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new')

    const first = await getCached('key', fetcher, 1000)
    expect(first).toBe('old')

    vi.advanceTimersByTime(1001)

    const second = await getCached('key', fetcher, 1000)
    expect(second).toBe('new')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('uses default TTL of 5 minutes', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    await getCached('key', fetcher)

    // Still cached at 4:59
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000)
    await getCached('key', fetcher)
    expect(fetcher).toHaveBeenCalledOnce()

    // Expired at 5:01
    vi.advanceTimersByTime(2000)
    await getCached('key', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('invalidateSettingsCache', () => {
  beforeEach(() => {
    clearSettingsCache()
  })

  it('removes a specific key so next access re-fetches', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1')
    await getCached('org-1:roles', fetcher)

    invalidateSettingsCache('org-1:roles')

    fetcher.mockResolvedValue('v2')
    const result = await getCached('org-1:roles', fetcher)
    expect(result).toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('invalidateOrgCache', () => {
  beforeEach(() => {
    clearSettingsCache()
  })

  it('removes all keys for a specific org', async () => {
    const f1 = vi.fn().mockResolvedValue('roles')
    const f2 = vi.fn().mockResolvedValue('teams')
    const f3 = vi.fn().mockResolvedValue('other-org-roles')

    await getCached('org-1:roles', f1)
    await getCached('org-1:teams', f2)
    await getCached('org-2:roles', f3)

    invalidateOrgCache('org-1')

    // org-1 keys re-fetch
    f1.mockResolvedValue('roles-v2')
    f2.mockResolvedValue('teams-v2')
    expect(await getCached('org-1:roles', f1)).toBe('roles-v2')
    expect(await getCached('org-1:teams', f2)).toBe('teams-v2')
    expect(f1).toHaveBeenCalledTimes(2)
    expect(f2).toHaveBeenCalledTimes(2)

    // org-2 still cached
    expect(await getCached('org-2:roles', f3)).toBe('other-org-roles')
    expect(f3).toHaveBeenCalledOnce()
  })
})

describe('invalidateCacheByType', () => {
  beforeEach(() => {
    clearSettingsCache()
  })

  it('removes all keys of a specific type across orgs', async () => {
    const f1 = vi.fn().mockResolvedValue('org1-roles')
    const f2 = vi.fn().mockResolvedValue('org2-roles')
    const f3 = vi.fn().mockResolvedValue('org1-teams')

    await getCached('org-1:roles', f1)
    await getCached('org-2:roles', f2)
    await getCached('org-1:teams', f3)

    invalidateCacheByType('roles')

    // Roles re-fetch
    f1.mockResolvedValue('org1-roles-v2')
    f2.mockResolvedValue('org2-roles-v2')
    expect(await getCached('org-1:roles', f1)).toBe('org1-roles-v2')
    expect(await getCached('org-2:roles', f2)).toBe('org2-roles-v2')

    // Teams still cached
    expect(await getCached('org-1:teams', f3)).toBe('org1-teams')
    expect(f3).toHaveBeenCalledOnce()
  })
})

describe('clearSettingsCache', () => {
  it('removes all entries', async () => {
    const f1 = vi.fn().mockResolvedValue('a')
    const f2 = vi.fn().mockResolvedValue('b')
    await getCached('key-1', f1)
    await getCached('key-2', f2)

    clearSettingsCache()

    f1.mockResolvedValue('a2')
    f2.mockResolvedValue('b2')
    expect(await getCached('key-1', f1)).toBe('a2')
    expect(await getCached('key-2', f2)).toBe('b2')
    expect(f1).toHaveBeenCalledTimes(2)
    expect(f2).toHaveBeenCalledTimes(2)
  })
})
