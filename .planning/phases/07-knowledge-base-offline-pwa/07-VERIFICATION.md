---
phase: 07-knowledge-base-offline-pwa
verified: 2026-03-06T17:32:29Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "PM checklists and compliance records can link directly to relevant knowledge base articles"
    status: partial
    reason: "PmSchedule.knowledgeArticleId FK exists in schema (KB-05 delivered). ComplianceRecord has NO knowledgeArticleId field in schema — the KB-06 hook was not added, despite the plan success criteria requiring it and REQUIREMENTS.md marking it Complete."
    artifacts:
      - path: "prisma/schema.prisma"
        issue: "ComplianceRecord model missing knowledgeArticleId String? field and KnowledgeArticle? relation"
    missing:
      - "Add knowledgeArticleId String? field to ComplianceRecord model in prisma/schema.prisma"
      - "Add knowledgeArticle KnowledgeArticle? @relation(fields: [knowledgeArticleId], references: [id], onDelete: SetNull) to ComplianceRecord"
      - "Add knowledgeArticles KnowledgeArticle[] back-relation to ComplianceRecord (or leave inverse optional)"
      - "Run db:push to apply schema change"
human_verification:
  - test: "Install PWA on iOS Safari — tap Share, then Add to Home Screen"
    expected: "App installs as standalone with 'Lionheart Maintenance' name and L-monogram icon; opens at /maintenance"
    why_human: "Cannot verify PWA installability criteria (HTTPS + service worker + manifest) in a programmatic check; requires actual device interaction"
  - test: "Go offline (DevTools Network tab > Offline), navigate to /maintenance/tickets"
    expected: "Amber 'Offline' pill visible in header; existing tickets load from IndexedDB; banner shows queue count"
    why_human: "Service worker caching and IndexedDB fallback require a real browser session that has visited the app while online first"
  - test: "Create a ticket while offline, then restore network"
    expected: "Submission shows 'Ticket Queued for Sync' confirmation with OFFLINE- number; on reconnect badge changes to 'Syncing...' then clears; ticket appears in list with real server ID"
    why_human: "Requires simulated offline flow across two network states in a live browser"
  - test: "Open a Calculation Tool knowledge article (set calculatorType to POND_CARE_DOSAGE)"
    expected: "Pond Care Dosage Calculator renders below article content; entering 10000 gallons, 47.5%, 1.0 ppm yields approximately 8 mL / 0.27 fl oz / 0.54 tbsp"
    why_human: "In-browser calculator computation verification requires rendering the component"
---

# Phase 7: Knowledge Base & Offline PWA — Verification Report

**Phase Goal:** Institutional knowledge is captured and searchable in-app, and technicians can work through poor Wi-Fi with full ticket functionality offline
**Verified:** 2026-03-06T17:32:29Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Tech or Head can create a knowledge article (6 types); PM checklists and compliance records can link to articles | PARTIAL | KB list/editor/viewer fully built. PmSchedule.knowledgeArticleId exists. ComplianceRecord has NO knowledgeArticleId field in schema — KB-06 hook missing. |
| 2 | Embedded pond care dosage calculator runs in-browser within a Calculation Tool article | VERIFIED | PondCareDosageCalculator.tsx is a substantive self-contained client component with correct formula; KnowledgeBaseArticleViewer.tsx conditionally renders it when `articleType === 'CALCULATION_TOOL' && calculatorType === 'POND_CARE_DOSAGE'` |
| 3 | AI diagnostic panel surfaces relevant KB articles alongside AI diagnosis | VERIFIED | AIDiagnosticPanel.tsx fires `useQuery` to `/api/maintenance/knowledge-base/search?q={category}&category={category}&limit=3` when `diagnosis` is loaded and panel is expanded; renders "Relevant Knowledge Base Articles" section with type badge + title + View link |
| 4 | Offline: technician can view assigned tickets, create tickets, update status, log labor, complete PM checklists, scan QR codes — all queued for sync | VERIFIED | Full Dexie IndexedDB mutation queue implemented (6 mutation types); SubmitRequestWizard queues offline; MyRequestsGrid falls back to IndexedDB; ConnectivityIndicator in every header; cacheAssignedTickets primes IndexedDB on maintenance page mount |
| 5 | On reconnect: background sync resolves conflicts (last-write-wins for status, merge for comments); connectivity indicator always visible | VERIFIED | DashboardLayout watches `isOnline` transition false→true and calls `syncOfflineData(queryClient, token)`; conflicts.ts has `resolveStatusConflict` (last-write-wins) and `resolveCommentConflict` (merge-append); ConnectivityIndicator in DashboardLayout header with 4 states |

**Score:** 4/5 truths verified (Truth 1 is partial due to KB-06 schema gap)

---

## Required Artifacts

### Plan 07-01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/services/knowledgeBaseService.ts` | VERIFIED | Exports createArticle, getArticles, getArticleById, updateArticle, deleteArticle, searchArticles, findRelevantArticles — all substantive with Zod validation, Prisma queries, and org-scoped client |
| `src/app/api/maintenance/knowledge-base/route.ts` | VERIFIED | Exports GET (list with filters) + POST (create). Standard org-scope route pattern. |
| `src/app/api/maintenance/knowledge-base/[id]/route.ts` | VERIFIED | Exports GET, PATCH, DELETE. Soft-delete via org-scoped client. |
| `src/app/api/maintenance/knowledge-base/search/route.ts` | VERIFIED | Exports GET. Routes to findRelevantArticles (category param) or searchArticles. |
| `src/components/maintenance/KnowledgeBaseArticleViewer.tsx` | VERIFIED | Renders Markdown content, conditionally renders PondCareDosageCalculator for CALCULATION_TOOL type, shows related asset link, tags, edit button |
| `src/components/maintenance/calculators/PondCareDosageCalculator.tsx` | VERIFIED | Fully client-side calculator with 3 inputs, correct formula, mL/oz/tbsp outputs, large-dose warning |

### Plan 07-02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `next.config.ts` | VERIFIED | `withSerwistInit({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js', disable: dev })` wraps config |
| `public/manifest.json` | VERIFIED | "display": "standalone", name, theme_color, 3 SVG icons, shortcuts to /maintenance/submit and /maintenance/tickets |
| `src/app/sw.ts` | VERIFIED | 6 cache strategies: tickets NetworkFirst, assets NetworkFirst, KB StaleWhileRevalidate, API NetworkFirst, static CacheFirst 30d, next-static CacheFirst 365d; offline fallback to /offline |
| `src/app/offline/page.tsx` | VERIFIED | Static server component with glassmorphism card, WifiOff icon, "Go to Maintenance" CTA |

### Plan 07-03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/offline/db.ts` | VERIFIED | Exports db (OfflineDatabase), OfflineTicket, MutationQueueEntry; 3 Dexie tables with indexed fields |
| `src/lib/offline/queue.ts` | VERIFIED | Exports enqueueOfflineMutation, getPendingMutations, markMutationSyncing, markMutationFailed, deleteMutation, getQueueCount, updateTempIdReferences. Note: `drainQueue` specified in PLAN was instead implemented as the sequential loop inside `syncOfflineData` in sync.ts — functionally equivalent. |
| `src/lib/offline/sync.ts` | VERIFIED | Exports syncOfflineData (drains queue sequentially, invalidates TanStack Query), cacheAssignedTickets (upserts tickets+assets to IndexedDB), applyMutation (routes 6 mutation types) |
| `src/lib/offline/conflicts.ts` | VERIFIED | Exports resolveStatusConflict (last-write-wins), resolveCommentConflict (merge-append) |
| `src/hooks/useOfflineQueue.ts` | VERIFIED | Exports useOfflineQueue; uses useLiveQuery for reactive queueCount; routes mutations online vs offline |
| `src/hooks/useConnectivity.ts` | VERIFIED | Exports useConnectivity; uses window online/offline events; SSR-safe |
| `src/components/maintenance/ConnectivityIndicator.tsx` | VERIFIED | 4-state animated badge using Framer Motion AnimatePresence; uses useOfflineQueue internally |

---

## Key Link Verification

### Plan 07-01 Key Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AIDiagnosticPanel.tsx` | `/api/maintenance/knowledge-base/search` | `useQuery` with ticket category + AI keywords | WIRED | Line 153-164: `useQuery({ queryKey: ['kb-articles-for-ticket', ticketId, category], queryFn: () => fetchApi('/api/maintenance/knowledge-base/search?...'), enabled: !!diagnosis && isExpanded })` |
| `KnowledgeBaseArticleViewer.tsx` | `PondCareDosageCalculator.tsx` | conditional render on `articleType === 'CALCULATION_TOOL'` | WIRED | Line 148: `{article.type === 'CALCULATION_TOOL' && article.calculatorType === 'POND_CARE_DOSAGE' && <PondCareDosageCalculator />}` |
| `knowledgeBaseService.ts` | `prisma.knowledgeArticle` | org-scoped Prisma client | WIRED | Uses `prisma` (org-scoped) from @/lib/db for all CRUD; KnowledgeArticle in both orgScopedModels and softDeleteModels in db/index.ts |

### Plan 07-02 Key Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `next.config.ts` | `src/app/sw.ts` | `withSerwist({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js' })` | WIRED | Confirmed in next.config.ts line 4-8 |
| `src/app/layout.tsx` | `public/manifest.json` | manifest metadata export + ServiceWorkerRegistration | WIRED | metadata includes `manifest: '/manifest.json'`; ServiceWorkerRegistration component registered in layout |
| `src/middleware.ts` | public paths | /sw.js, /manifest.json, /offline, /icons/* bypass | WIRED | Lines 59-62 in middleware isPublicPath() function |

### Plan 07-03 Key Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `useOfflineQueue.ts` | `src/lib/offline/queue.ts` | `enqueueOfflineMutation` when `!isOnline` | WIRED | Line 63: `await enqueueOfflineMutation({ type, ticketId, payload, createdAt: new Date() })` |
| `useConnectivity.ts` → `DashboardLayout.tsx` | `src/lib/offline/sync.ts` | `syncOfflineData` on online transition | WIRED | DashboardLayout lines 94-107: `useEffect` watches `isOnline`, calls `syncOfflineData(queryClient, token)` when transitioning offline→online |
| `DashboardLayout.tsx` | `ConnectivityIndicator.tsx` | Rendered in header alongside NotificationBell | WIRED | Line 164: `<ConnectivityIndicator />` immediately before `<NotificationBell />` in header right-side |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| KB-01 | 07-01 | KnowledgeArticle model with 6 types | SATISFIED | schema.prisma has KnowledgeArticleType enum with all 6 values + KnowledgeArticle model |
| KB-02 | 07-01 | Articles creatable by Tech and Head roles | SATISFIED | permissions.ts: maintenance-head gets KB_READ/CREATE/UPDATE/DELETE; maintenance-technician gets KB_READ/CREATE/UPDATE |
| KB-03 | 07-01 | Embedded calculation tools (pond care dosage calculator) | SATISFIED | PondCareDosageCalculator.tsx is fully client-side; wired into ArticleViewer for CALCULATION_TOOL type |
| KB-04 | 07-01 | AI diagnostic panel can surface relevant KB articles | SATISFIED | AIDiagnosticPanel.tsx fires secondary useQuery to search endpoint when diagnosis loaded |
| KB-05 | 07-01 | PM checklists can link to knowledge base articles | SATISFIED | PmSchedule.knowledgeArticleId String? + KnowledgeArticle? relation in schema.prisma line 2214-2225 |
| KB-06 | 07-01 | Compliance records can link to knowledge base SOPs | BLOCKED | ComplianceRecord model (lines 2292-2325 in schema.prisma) has NO knowledgeArticleId field. The field was added to PmSchedule (KB-05) but NOT to ComplianceRecord. REQUIREMENTS.md marks this Complete but schema evidence contradicts that. |
| OFFLINE-01 | 07-02 | Progressive Web App with service workers for offline caching | SATISFIED | @serwist/next wired in next.config.ts; sw.ts with 6 cache strategies; manifest.json with standalone display |
| OFFLINE-02 | 07-02, 07-03 | View assigned tickets offline (cached on device at login) | SATISFIED | cacheAssignedTickets called on maintenance page mount; MyRequestsGrid falls back to useLiveQuery from IndexedDB when offline |
| OFFLINE-03 | 07-03 | Create new tickets offline with photos stored locally | SATISFIED | SubmitRequestWizard queues TICKET_CREATE mutation; stores ticket in db.offlineTickets with isLocalOnly=true; shows "Ticket Queued for Sync" confirmation |
| OFFLINE-04 | 07-03 | Update ticket status offline (queued locally) | SATISFIED | STATUS_UPDATE mutation type handled in applyMutation; enqueueOfflineMutation available via useOfflineQueue |
| OFFLINE-05 | 07-03 | Log labor hours and costs offline | SATISFIED | LABOR_LOG and COST_LOG mutation types handled in applyMutation; routed to /api/maintenance/tickets/[id]/labor and /costs |
| OFFLINE-06 | 07-03 | Complete PM checklists offline | SATISFIED | CHECKLIST_TOGGLE mutation type handled in applyMutation; routes to /api/maintenance/tickets/[id]/checklist |
| OFFLINE-07 | 07-02, 07-03 | Scan QR codes offline (loads cached asset data) | SATISFIED | Assets cached in db.cachedAssets via cacheAssignedTickets; service worker caches /api/maintenance/assets with NetworkFirst |
| OFFLINE-08 | 07-03 | Background sync with conflict resolution | SATISFIED | syncOfflineData drains queue sequentially; resolveStatusConflict (last-write-wins) and resolveCommentConflict (merge-append) in conflicts.ts; 409 from STATUS_UPDATE treated as server-wins success |
| OFFLINE-09 | 07-03 | Connectivity indicator always visible | SATISFIED | ConnectivityIndicator wired in DashboardLayout header, visible on every authenticated page |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/lib/services/knowledgeBaseService.ts` line 74 | Comment: "We pass a placeholder here to satisfy TypeScript; the actual value is set via AsyncLocalStorage" — uses `'ORG_CONTEXT'` as organizationId placeholder | Info | This is a documented intentional workaround consistent with the project pattern; org-scoped Prisma client overwrites at runtime. Not a defect. |
| `src/lib/offline/queue.ts` | `drainQueue` not exported as specified in PLAN must_haves artifacts | Info | Drain functionality exists as `syncOfflineData` in sync.ts; the name discrepancy vs. spec is cosmetic. All behavior is present. |

No blocker or warning anti-patterns found.

---

## Human Verification Required

### 1. PWA Installability

**Test:** On an iOS Safari or Android Chrome browser, visit the app on a live HTTPS URL. On iOS: tap the Share button, then "Add to Home Screen". On Android: browser should show an install prompt.
**Expected:** App installs with name "Lionheart Maintenance", shows the L-monogram icon, and opens at `/maintenance` in standalone (no browser chrome) mode.
**Why human:** PWA install criteria (manifest + service worker + HTTPS) cannot be verified by static analysis. Must confirm with real device interaction.

### 2. Offline Ticket Viewing

**Test:** In Chrome DevTools, go online, visit `/maintenance/tickets`, then switch Network to "Offline". Refresh the page or navigate back.
**Expected:** Amber "Offline" pill visible in header. Ticket list shows previously cached tickets with "Cached" indicator. No error screen.
**Why human:** Service worker caching and IndexedDB fallback require a browser session that has primed the cache; cannot simulate in static analysis.

### 3. Offline Ticket Creation and Sync

**Test:** While in DevTools Offline mode, open `/maintenance/submit` and complete the ticket wizard. Then restore the network.
**Expected:** On submit: "Ticket Queued for Sync" confirmation with OFFLINE-{timestamp} number. On reconnect: ConnectivityIndicator changes to "Syncing..." and then clears to the online state. The ticket appears in the list with a real MT- number.
**Why human:** Requires simulating two network states and confirming the sync result.

### 4. Pond Care Dosage Calculator

**Test:** Create a Calculation Tool article with calculatorType "POND_CARE_DOSAGE". Open the article viewer.
**Expected:** Calculator renders below the article content. Entering Volume=10000 gallons, Concentration=47.5%, Target=1 ppm should yield approximately 8.0 mL / 0.27 fl oz / 0.54 tbsp.
**Why human:** Client-side computation requires rendering the component in a browser.

---

## Gaps Summary

One gap is blocking full goal achievement:

**KB-06: ComplianceRecord missing knowledgeArticleId field**

The requirement "Compliance records can link to knowledge base SOPs" was marked Complete in REQUIREMENTS.md and claimed in the 07-01 SUMMARY as "KB-06-hook" — but the PLAN's success criteria explicitly stated "Compliance record schema has knowledgeArticleId hook for future Phase 6 integration (KB-06)". The actual schema (`prisma/schema.prisma` lines 2292-2325) contains no `knowledgeArticleId` field on `ComplianceRecord`.

The KB-05 counterpart (PmSchedule.knowledgeArticleId) was correctly implemented at lines 2214-2225. KB-06 was either omitted during implementation or considered out-of-scope despite being in the PLAN success criteria.

**Fix required:** Add `knowledgeArticleId String?` and the `KnowledgeArticle?` relation to `ComplianceRecord` in `prisma/schema.prisma`, then run `npm run db:push`. No service-layer changes are needed for the schema hook — the linking UI is deferred to a future plan per the SUMMARY.

The gap is isolated, additive (no breaking changes), and does not affect the four verified truths. All offline PWA functionality, the knowledge base core, and the AI panel integration are fully wired and substantive.

---

_Verified: 2026-03-06T17:32:29Z_
_Verifier: Claude (gsd-verifier)_
