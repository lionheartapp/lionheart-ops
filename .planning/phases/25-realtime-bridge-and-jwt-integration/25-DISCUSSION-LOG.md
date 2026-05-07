# Phase 25: Realtime Bridge and JWT Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-05-07
**Phase:** 25-realtime-bridge-and-jwt-integration
**Areas discussed:** Token endpoint and JWT flow, Realtime singleton and subscription model, Broadcast trigger design, Typing indicators and presence

---

## Token Endpoint and JWT Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing JWT, expose via endpoint | GET /api/auth/token reads httpOnly cookie, returns same JWT string | ✓ |
| Mint a separate Realtime-specific JWT | New JWT with only Realtime claims | |

**User's choice:** Reuse existing JWT

---

## Realtime Singleton and Subscription Model

| Option | Description | Selected |
|--------|-------------|----------|
| React context provider with singleton | RealtimeProvider wraps messaging layout, hook API | ✓ |
| Global singleton module | Module-level client in src/lib/realtime.ts | |

**User's choice:** React context provider

---

## Broadcast Trigger Design

| Option | Description | Selected |
|--------|-------------|----------|
| org:channel pattern | Topic 'msg:{orgId}:{channelId}', full payload | ✓ |
| Channel-only pattern | Topic 'channel:{channelId}', relies on RLS only | |

**User's choice:** org:channel pattern

---

## Typing Indicators and Presence

| Option | Description | Selected |
|--------|-------------|----------|
| Channel-scoped presence + typing broadcast | Per-channel presence, broadcast typing events, 3s debounce | ✓ |
| Global presence only | One presence channel for whole app | |

**User's choice:** Channel-scoped presence + typing broadcast

---

## Claude's Discretion

- Token refresh, reconnection backoff, JWT rejection fallback, broadcast payload extras, Supabase client config

## Deferred Ideas

None
