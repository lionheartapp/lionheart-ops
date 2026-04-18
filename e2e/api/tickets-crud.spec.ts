import { test, expect } from '@playwright/test'
import { ApiClient, assertOk } from '../helpers/api'
import { env } from '../helpers/env'
import { ticketTitle } from '../helpers/data'

test.describe('API · /api/tickets CRUD', () => {
  test('admin can create → read → update → soft-delete a ticket', async () => {
    const client = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    const title = ticketTitle()

    // CREATE
    const created = await client.post<{ id: string }>('/api/tickets', {
      title,
      description: 'Created by E2E test',
      priority: 'NORMAL',
      category: 'IT',
      locationText: 'Room 101',
    })
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300)
    assertOk(created.body)
    const id = (created.body.data as { id: string }).id
    expect(id).toBeTruthy()

    // READ (list contains it)
    const list = await client.get<{ items?: Array<{ id: string; title: string }> } | Array<{ id: string; title: string }>>(
      '/api/tickets',
    )
    assertOk(list.body)
    const items = Array.isArray(list.body.data)
      ? list.body.data
      : ((list.body.data as { items?: unknown[] }).items ?? [])
    const found = (items as Array<{ id: string; title?: string }>).some((t) => t.id === id)
    expect(found, `ticket ${id} not in list`).toBe(true)

    // READ (by id)
    const read = await client.get(`/api/tickets/${id}`)
    assertOk(read.body)

    // UPDATE (tickets use PUT, not PATCH)
    const updated = await client.put(`/api/tickets/${id}`, {
      title: `${title} (updated)`,
    })
    assertOk(updated.body)

    // DELETE (soft-delete — should 2xx)
    const del = await client.delete(`/api/tickets/${id}`)
    expect(del.status).toBeLessThan(300)

    // After delete, list should not include it (soft-delete filter applies).
    const postDelete = await client.get<unknown>('/api/tickets')
    assertOk(postDelete.body)
    const postItems = Array.isArray(postDelete.body.data)
      ? (postDelete.body.data as Array<{ id: string }>)
      : ((postDelete.body.data as { items?: Array<{ id: string }> }).items ?? [])
    expect(postItems.some((t) => t.id === id)).toBe(false)

    await client.dispose()
  })
})
