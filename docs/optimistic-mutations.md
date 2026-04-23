# Optimistic Mutations Pattern

## Overview

All mutations in the codebase use `useOptimisticMutation` — a standardized wrapper around TanStack's `useMutation` that handles the snapshot/rollback/invalidate ceremony automatically.

**File:** `src/lib/hooks/useOptimisticMutation.ts`

## Usage

```tsx
import { useOptimisticMutation } from '@/lib/hooks/useOptimisticMutation'

const mutation = useOptimisticMutation<ResponseType, VariablesType, CacheType>({
  queryKey: queryKeys.tickets.all,           // Cache key to snapshot + invalidate
  mutationFn: (vars) => fetchApi('/api/...'), // The actual API call
  optimisticUpdate: (old, vars) => ...,       // Optional: update cache before server responds
  invalidateKeys: [queryKeys.dashboard.all],  // Optional: side-effect keys to also invalidate
  onSuccess: () => { ... },                   // Optional: runs after server confirms
  onError: (err) => { ... },                  // Optional: runs if server rejects (cache auto-rolls back)
})

// Trigger it
mutation.mutate(variables)
```

## What It Does

1. **onMutate** — Cancels in-flight queries, snapshots the current cache value
2. **optimisticUpdate** — If provided, writes the optimistic next value to cache immediately (UI updates instantly)
3. **onError** — Rolls back to the snapshot automatically
4. **onSettled** — Invalidates `queryKey` + any `invalidateKeys` so the server truth replaces the optimistic value

## Common Patterns

### Create (no optimistic update, just invalidate)

```tsx
const createMutation = useOptimisticMutation<unknown, void, unknown>({
  queryKey: queryKeys.itTickets.all,
  mutationFn: async () => {
    const res = await fetch('/api/it/tickets', { method: 'POST', ... })
    if (!res.ok) throw new Error('Failed')
    return res.json()
  },
  invalidateKeys: [queryKeys.itBoard.all, queryKeys.itDashboard.all],
  onSuccess: () => {
    toast('Created', 'success')
    onClose()
  },
})
```

### Update with optimistic UI

```tsx
const statusMutation = useOptimisticMutation<unknown, { status: string }, Ticket>({
  queryKey: queryKeys.ticketDetail.byId(ticketId),
  mutationFn: (vars) => fetchApi(`/api/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(vars),
  }),
  optimisticUpdate: (old, vars) =>
    old ? { ...old, status: vars.status } : old,
  invalidateKeys: [queryKeys.tickets.all],
})
```

### Delete with optimistic removal

```tsx
const deleteMutation = useOptimisticMutation<unknown, string, Item[]>({
  queryKey: queryKeys.items.all,
  mutationFn: (id) => fetchApi(`/api/items/${id}`, { method: 'DELETE' }),
  optimisticUpdate: (old, id) =>
    old?.filter((item) => item.id !== id),
})
```

## When NOT to Use

- **ITKanbanBoard** — Uses `useMutation` directly because it needs custom DnD-aware optimistic logic with dynamic query keys
- **ITMagicLinksTab** — Uses `useMutation` directly because it generates one-time links with no cache to invalidate

## Type Parameters

```
useOptimisticMutation<TData, TVariables, TSnapshot>
```

- `TData` — What the `mutationFn` returns (often `unknown`)
- `TVariables` — What you pass to `mutation.mutate(vars)` (use `void` for no-arg mutations)
- `TSnapshot` — The shape of the cached data (for `optimisticUpdate`). Use `unknown` if no optimistic update.

For void mutations, call `mutation.mutate(undefined)` instead of `mutation.mutate()`.
