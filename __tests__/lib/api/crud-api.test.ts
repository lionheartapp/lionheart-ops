import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  fetchApi: vi.fn(),
}))

import { createCrudApi } from '@/lib/api/crud-api'
import { fetchApi } from '@/lib/api-client'

const mockFetchApi = vi.mocked(fetchApi)

type TestEntity = { id: string; name: string }

describe('createCrudApi', () => {
  const api = createCrudApi<TestEntity>('widgets', '/api/widgets')

  // ── keys ─────────────────────────────────────────────────────────────────

  describe('keys', () => {
    it('all returns [keyPrefix]', () => {
      expect(api.keys.all).toEqual(['widgets'])
    })

    it('list without filters returns [keyPrefix, {}]', () => {
      expect(api.keys.list()).toEqual(['widgets', {}])
    })

    it('list with filters includes filters', () => {
      expect(api.keys.list({ status: 'active' })).toEqual(['widgets', { status: 'active' }])
    })

    it('detail returns [keyPrefix-detail, id]', () => {
      expect(api.keys.detail('abc')).toEqual(['widgets-detail', 'abc'])
    })
  })

  // ── queryOptions ─────────────────────────────────────────────────────────

  describe('queryOptions', () => {
    it('list returns queryKey, queryFn, and staleTime', () => {
      const opts = api.queryOptions.list()
      expect(opts.queryKey).toEqual(['widgets', {}])
      expect(typeof opts.queryFn).toBe('function')
      expect(opts.staleTime).toBe(5 * 60 * 1000) // default 5 min
    })

    it('list queryFn calls fetchApi with base URL', async () => {
      mockFetchApi.mockResolvedValueOnce([{ id: '1', name: 'A' }])
      const opts = api.queryOptions.list()
      await opts.queryFn()
      expect(mockFetchApi).toHaveBeenCalledWith('/api/widgets')
    })

    it('list queryFn builds query string from filters', async () => {
      mockFetchApi.mockResolvedValueOnce([])
      const opts = api.queryOptions.list({ status: 'active', page: '2' })
      await opts.queryFn()
      const calledUrl = mockFetchApi.mock.calls[mockFetchApi.mock.calls.length - 1][0]
      expect(calledUrl).toContain('status=active')
      expect(calledUrl).toContain('page=2')
    })

    it('list queryFn skips empty filter values', async () => {
      mockFetchApi.mockResolvedValueOnce([])
      const opts = api.queryOptions.list({ status: '', name: 'test' })
      await opts.queryFn()
      const calledUrl = mockFetchApi.mock.calls[mockFetchApi.mock.calls.length - 1][0]
      expect(calledUrl).not.toContain('status')
      expect(calledUrl).toContain('name=test')
    })

    it('detail returns queryKey, queryFn, and staleTime', () => {
      const opts = api.queryOptions.detail('xyz')
      expect(opts.queryKey).toEqual(['widgets-detail', 'xyz'])
      expect(typeof opts.queryFn).toBe('function')
      expect(opts.staleTime).toBe(2 * 60 * 1000) // default 2 min
    })

    it('detail queryFn calls fetchApi with ID', async () => {
      mockFetchApi.mockResolvedValueOnce({ id: 'xyz', name: 'Widget' })
      const opts = api.queryOptions.detail('xyz')
      await opts.queryFn()
      expect(mockFetchApi).toHaveBeenCalledWith('/api/widgets/xyz')
    })
  })

  // ── custom stale times ───────────────────────────────────────────────────

  describe('custom stale times', () => {
    const customApi = createCrudApi<TestEntity>('items', '/api/items', {
      listStaleTime: 30_000,
      detailStaleTime: 10_000,
    })

    it('uses custom listStaleTime', () => {
      expect(customApi.queryOptions.list().staleTime).toBe(30_000)
    })

    it('uses custom detailStaleTime', () => {
      expect(customApi.queryOptions.detail('x').staleTime).toBe(10_000)
    })
  })

  // ── mutations ────────────────────────────────────────────────────────────

  describe('mutations', () => {
    it('create sends POST to base URL', async () => {
      mockFetchApi.mockResolvedValueOnce({ id: '1', name: 'New' })
      await api.create({ name: 'New' })
      expect(mockFetchApi).toHaveBeenCalledWith('/api/widgets', {
        method: 'POST',
        body: JSON.stringify({ name: 'New' }),
      })
    })

    it('update sends PATCH to base URL + id', async () => {
      mockFetchApi.mockResolvedValueOnce({ id: '1', name: 'Updated' })
      await api.update('1', { name: 'Updated' })
      expect(mockFetchApi).toHaveBeenCalledWith('/api/widgets/1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      })
    })

    it('remove sends DELETE to base URL + id', async () => {
      mockFetchApi.mockResolvedValueOnce({ deleted: true })
      await api.remove('1')
      expect(mockFetchApi).toHaveBeenCalledWith('/api/widgets/1', {
        method: 'DELETE',
      })
    })
  })

  // ── baseUrl ──────────────────────────────────────────────────────────────

  it('exposes baseUrl', () => {
    expect(api.baseUrl).toBe('/api/widgets')
  })
})
