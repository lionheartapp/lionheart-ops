import { AsyncLocalStorage } from 'async_hooks'

const orgContextStorage = new AsyncLocalStorage<string>()

export function getOrgIdFromRequest(req: unknown): string {
  if (req && typeof req === 'object' && 'headers' in req) {
    const headers = (req as { headers: { get?: (name: string) => string | null } }).headers
    const id = headers.get?.('x-org-id')?.trim()
    if (id) return id
  }
  return 'demo-org'
}

/** Returns the current org ID set by runWithOrgContext, or a fallback. */
export function getOrgContextId(): string {
  const id = orgContextStorage.getStore()
  return id ?? 'demo-org'
}

export async function runWithOrgContext<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return orgContextStorage.run(orgId, fn)
}
