# Deferred Items — Phase 04-assets-qr-pm

## Pre-existing Build Issues (Out of Scope)

**Issue: pm-calendar page imports server-only code into client bundle**
- File: `src/app/maintenance/pm-calendar/page.tsx` (untracked, from earlier phase-4 work)
- Import chain: `page.tsx` → `PmScheduleList.tsx` → `pmScheduleService.ts` → `db/index.ts` → `org-context.ts` → `node:async_hooks`
- Error: `UnhandledSchemeError: Reading from "node:async_hooks" is not handled by plugins`
- Impact: `npm run build` fails at webpack compilation
- Scope: Pre-existing from Plan 03/04 work — NOT introduced by Plan 05
- Resolution: Needs `'use client'` boundary fixes and/or service extraction in the pm-calendar page chain
