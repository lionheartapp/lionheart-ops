import { AsyncLocalStorage } from 'node:async_hooks'
import { NextRequest } from 'next/server'

type OrgStore = { organizationId: string }

const orgStorage = new AsyncLocalStorage<OrgStore>()

export function runWithOrgContext<T>(organizationId: string, callback: () => Promise<T>): Promise<T> {
  return orgStorage.run({ organizationId }, callback)
}

export function getOrgContextId(): string {
  const store = orgStorage.getStore()
  if (!store?.organizationId) {
    throw new Error('Organization context is missing')
  }
  return store.organizationId
}

export function getOrgIdFromRequest(req: NextRequest): string {
  const id = req.headers.get('x-org-id')?.trim()
  if (!id) throw new Error('Missing x-org-id header')
  return id
}