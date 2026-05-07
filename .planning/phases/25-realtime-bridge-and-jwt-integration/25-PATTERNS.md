# Phase 25: Realtime Bridge and JWT Integration - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/auth/token/route.ts` | controller | request-response | `src/app/api/auth/me/route.ts` | exact |
| `src/components/messaging/RealtimeProvider.tsx` | provider | event-driven | `src/components/mobile/MobileHeaderContext.tsx` + `src/lib/supabase-browser.ts` | role-match |
| `src/lib/hooks/useRealtimeChannel.ts` | hook | event-driven | `src/lib/hooks/useEventChat.ts` | exact |
| `prisma/migrations/messaging_broadcast_trigger.sql` | migration | event-driven | `prisma/migrations/messaging_rls_and_triggers.sql` | exact |

## Pattern Assignments

### `src/app/api/auth/token/route.ts` (controller, request-response)

**Analog:** `src/app/api/auth/me/route.ts`

This endpoint is simpler than /me -- it only reads the cookie, verifies the JWT, and returns the token string. No DB queries needed (per D-01 and CONTEXT specifics). The /me route is the closest analog because it demonstrates cookie-first + bearer-fallback token extraction and uses `verifyAuthToken` directly (no org-scoping needed).

**Imports pattern** (lines 1-4):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { ok, fail } from '@/lib/api-response'
```

**Cookie + bearer extraction pattern** (me/route.ts lines 20-23, middleware.ts line 343):
```typescript
// Try cookie first, fall back to Authorization header
const cookieToken = req.cookies.get('auth-token')?.value
const authHeader = req.headers.get('authorization')
const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
const token = cookieToken ?? bearerToken
```

**Verification + early return pattern** (me/route.ts lines 25-31):
```typescript
if (!token) {
  return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
}

const claims = await verifyAuthToken(token)
if (!claims) {
  return NextResponse.json(fail('UNAUTHORIZED', 'Invalid or expired token'), { status: 401 })
}
```

**Response envelope pattern** (api-response.ts lines 18-19):
```typescript
return NextResponse.json(ok(data))
// Envelope: { ok: true, data: { ... } }
```

**Error handling pattern** (me/route.ts lines 150-154):
```typescript
} catch (error) {
  return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
}
```

**Key difference from /me:** The token endpoint returns the raw JWT string (not user data) and makes zero DB calls. It exists solely to let the browser Supabase client get the JWT for the `accessToken` realtime param.

---

### `src/components/messaging/RealtimeProvider.tsx` (provider, event-driven)

**Analog:** `src/components/mobile/MobileHeaderContext.tsx` (context pattern) + `src/lib/supabase-browser.ts` (Supabase client creation)

**Context provider pattern** (MobileHeaderContext.tsx lines 1-10, 48-54, 56-80):
```typescript
'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

// 1. Define the context value interface
interface RealtimeContextValue {
  supabaseClient: SupabaseClient | null
  isConnected: boolean
  error: string | null
}

// 2. Create context with safe defaults
const RealtimeContext = createContext<RealtimeContextValue>({
  supabaseClient: null,
  isConnected: false,
  error: null,
})

// 3. Provider component
export function RealtimeProvider({ children }: { children: ReactNode }) {
  // ... state + effects ...
  return (
    <RealtimeContext.Provider value={{ supabaseClient, isConnected, error }}>
      {children}
    </RealtimeContext.Provider>
  )
}

// 4. Consumer hook
export function useRealtime() {
  return useContext(RealtimeContext)
}
```

**Existing Supabase client singleton** (supabase-browser.ts lines 13-37):
```typescript
// Current pattern uses anon key. RealtimeProvider will need a DIFFERENT client
// that uses the custom JWT via accessToken param instead of anon key.
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  if (_client) return _client

  const { createClient } = require('@supabase/supabase-js')
  _client = createClient(url, anonKey, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })
  return _client
}
```

**Key adaptation:** The RealtimeProvider creates a Supabase client with the `accessToken` callback (fetching from /api/auth/token) instead of relying on the anon key. The existing `getSupabaseBrowserClient` uses anon key and is a module-level singleton; the new provider should manage its own client in React state, scoped to the authenticated session lifecycle.

---

### `src/lib/hooks/useRealtimeChannel.ts` (hook, event-driven)

**Analog:** `src/lib/hooks/useEventChat.ts`

This is the strongest analog. useEventChat already does broadcast subscribe, optimistic message handling, cleanup on unmount, and polling fallback. The new hook will follow the same structure but use the RealtimeProvider's client instead of `getSupabaseBrowserClient()`, and add presence + typing.

**Imports and interface pattern** (useEventChat.ts lines 1-31):
```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/api-client'
// New hook will import from RealtimeProvider context instead:
// import { useRealtime } from '@/components/messaging/RealtimeProvider'

export interface ChatMessage {
  id: string
  // ... fields ...
}

export interface UseRealtimeChannelResult {
  messages: ChatMessage[]
  typingUsers: { userId: string; displayName: string }[]
  presenceState: Map<string, 'online' | 'away' | 'offline'>
  isConnected: boolean
  error: string | null
}
```

**Broadcast subscription pattern** (useEventChat.ts lines 106-137):
```typescript
useEffect(() => {
  if (!eventProjectId) return

  let cleanedUp = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // Supabase Realtime broadcast channel
  const supabase = getSupabaseBrowserClient()
  if (supabase) {
    try {
      const channel = supabase.channel(`event-chat-${eventProjectId}`)
      channel
        .on('broadcast', { event: 'new-message' }, (payload: { payload: ChatMessage }) => {
          if (cleanedUp) return
          const msg = payload.payload
          // Dedup logic
          if (msg.userId === currentUserId) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        })
        .subscribe()

      channelRef.current = channel
    } catch {
      // Fall through to polling
    }
  }
```

**Cleanup pattern** (useEventChat.ts lines 144-152):
```typescript
  return () => {
    cleanedUp = true
    if (pollTimer) clearInterval(pollTimer)
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }
}, [eventProjectId, currentUserId, fetchMessages])
```

**Presence subscription pattern** (usePresence.ts lines 111-138):
```typescript
// Supabase Realtime presence for tracking active users
const channel = supabase.channel(`event-presence-${eventProjectId}`)
channel
  .on('presence', { event: 'sync' }, () => {
    if (!cleanedUp) fetchActiveUsers()
  })
  .on('presence', { event: 'join' }, () => {
    if (!cleanedUp) fetchActiveUsers()
  })
  .on('presence', { event: 'leave' }, () => {
    if (!cleanedUp) fetchActiveUsers()
  })
  .subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      channel.track({ userId, activeTab: activeTabRef.current }).catch(() => {})
    }
  })
```

**Key adaptations for useRealtimeChannel:**
1. Topic naming: `msg:{orgId}:{channelId}` (per D-05) instead of `event-chat-{id}`
2. Combine broadcast (new_message + typing events) AND presence on the same channel
3. Get Supabase client from `useRealtime()` context instead of `getSupabaseBrowserClient()`
4. Typing debounce: 3-second send interval on sender side (D-10)
5. Typing clear: 3-second timeout on receiver side (D-09)

---

### `prisma/migrations/messaging_broadcast_trigger.sql` (migration, event-driven)

**Analog:** `prisma/migrations/messaging_rls_and_triggers.sql`

**File header pattern** (lines 1-3):
```sql
-- Phase 25-XX: Messaging broadcast trigger for Supabase Realtime
-- Applied manually via Supabase SQL Editor or psql (not via Prisma migrate)
-- Depends on: Phase 23 messaging schema + Phase 23 RLS policies
```

**Trigger function pattern** (lines 237-254 -- increment_unread_count example):
```sql
CREATE OR REPLACE FUNCTION broadcast_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- realtime.send() broadcasts to Supabase Realtime subscribers
  -- Topic: msg:{orgId}:{channelId} (D-05)
  -- Event: new_message (D-06)
  PERFORM realtime.send(
    'msg:' || NEW."organizationId" || ':' || NEW."channelId",
    'new_message',
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_broadcast_on_insert
  AFTER INSERT ON "Message"
  FOR EACH ROW
  WHEN (NEW."deletedAt" IS NULL)
  EXECUTE FUNCTION broadcast_new_message();
```

**Key conventions from existing migration:**
- Section headers with `-- =============================================================================`
- `CREATE OR REPLACE FUNCTION` for idempotency
- `AFTER INSERT` triggers with `WHEN (NEW."deletedAt" IS NULL)` guard for soft-delete compatibility
- `FOR EACH ROW` on all triggers
- Column names in double quotes to match Prisma's PascalCase convention (`"channelId"`, `"organizationId"`)

---

## Shared Patterns

### Authentication (cookie reading)
**Source:** `src/app/api/auth/me/route.ts` lines 20-23, `src/middleware.ts` line 343
**Apply to:** `src/app/api/auth/token/route.ts`
```typescript
const cookieToken = req.cookies.get('auth-token')?.value
const authHeader = req.headers.get('authorization')
const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
const token = cookieToken ?? bearerToken
```

### API Response Envelope
**Source:** `src/lib/api-response.ts`
**Apply to:** `src/app/api/auth/token/route.ts`
```typescript
import { ok, fail } from '@/lib/api-response'
// Success: NextResponse.json(ok(data))
// Failure: NextResponse.json(fail('CODE', 'message'), { status: N })
```

### Supabase Channel Cleanup
**Source:** `src/lib/hooks/useEventChat.ts` lines 144-152, `src/lib/hooks/usePresence.ts` lines 145-151
**Apply to:** `src/lib/hooks/useRealtimeChannel.ts`, `src/components/messaging/RealtimeProvider.tsx`
```typescript
// Boolean guard pattern to prevent state updates after unmount
let cleanedUp = false
// ... subscribe ...
return () => {
  cleanedUp = true
  if (pollTimer) clearInterval(pollTimer)
  if (channelRef.current) {
    channelRef.current.unsubscribe()
    channelRef.current = null
  }
}
```

### Soft-Delete Guard on Triggers
**Source:** `prisma/migrations/messaging_rls_and_triggers.sql` line 253
**Apply to:** `prisma/migrations/messaging_broadcast_trigger.sql`
```sql
WHEN (NEW."deletedAt" IS NULL)
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All 4 files have strong analogs in the codebase |

## Metadata

**Analog search scope:** `src/app/api/auth/`, `src/lib/hooks/`, `src/components/`, `prisma/migrations/`, `src/lib/`
**Files scanned:** 11 auth routes, 60+ hooks, 3 context providers, 1 SQL migration
**Pattern extraction date:** 2026-05-07
