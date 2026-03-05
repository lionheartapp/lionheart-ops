# Project Research Summary

**Project:** Lionheart — Maintenance & Facilities Module (K-12 CMMS)
**Domain:** Computerized Maintenance Management System (CMMS) for K-12 educational institutions
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

This module adds a full K-12 CMMS to the existing Lionheart multi-tenant SaaS platform. The competitive landscape (SchoolDude/Brightly, FMX, Incident IQ) confirms that the table-stakes bar is high — buyers expect ticket submission, PM scheduling, asset registers, role-based access, and mobile access before evaluating anything else. However, all three dominant competitors have meaningful gaps: none has a Kanban board, none has AI photo diagnosis, and no platform has fully automated compliance tracking across all 10 federal regulatory domains. These three gaps define Lionheart's differentiation strategy and should drive the phase structure.

The recommended approach is additive: all new code is namespaced under `src/app/api/maintenance/`, `src/lib/services/maintenance/`, and `src/components/maintenance/`. Every new Prisma model registers in the existing org-scoped extension in `src/lib/db/index.ts`. The existing notification system, email service, campus hierarchy (Building → Area → Room), module gating infrastructure, and Supabase Storage are reused without modification. The only genuinely new infrastructure is the Anthropic SDK for AI diagnostics and the PM auto-generation cron job via Vercel Cron. The 8-status state machine (BACKLOG → TODO → IN_PROGRESS → ON_HOLD → QA → DONE, plus SCHEDULED and CANCELLED) is the architectural spine of the entire module — it must be server-enforced from day one.

The two most critical risks are data isolation and state machine integrity. Missing a new Prisma model from the org-scope whitelist is a silent data breach — Org A can read Org B's data. Failing to validate status transitions server-side lets users skip the QA gate and close tickets without completion photos, corrupting the compliance audit trail. Both risks have well-defined prevention strategies and must be addressed in the Phase 1 build sequence before any API route ships. Phase 3's offline PWA is the only place where the existing Next.js architecture needs meaningful extension; Phases 1 and 2 follow established platform patterns exactly.

## Key Findings

### Recommended Stack

The module requires 10 new npm packages installed across three phases, plus two new environment variables (`ANTHROPIC_API_KEY`, `CRON_SECRET`). All other requirements are satisfied by already-installed libraries: `rrule` handles PM recurrence, `date-fns` handles SLA age calculation, `framer-motion` handles board animations, `@supabase/supabase-js` handles photo storage, and `nodemailer`/Resend handle email notifications.

**Core technologies — Phase 1:**
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` v6.3.1: Kanban drag-and-drop — only accessible React DnD library with active community patterns; `react-beautiful-dnd` is abandoned and incompatible with React 18 Strict Mode
- `react-dropzone` v15.0.0: File upload UI — headless hook matches the glassmorphism design system without imposing its own UI
- `browser-image-compression` v2.0.x: Client-side photo compression — school mobile photos are 5–12MB; compress to 1.5MB before upload to avoid Supabase costs and school Wi-Fi timeouts
- `@anthropic-ai/sdk` v0.78.0 with `claude-sonnet-4-5`: AI photo diagnosis — direct SDK chosen over Vercel AI SDK for model-pinning control; consistent with existing Gemini direct SDK pattern
- `react-hook-form` v7.71.2 + `@hookform/resolvers`: Complex ticket form handling — uncontrolled inputs for mobile performance; native Zod integration

**Core technologies — Phase 2:**
- `qrcode.react` v4.x: QR code generation — SVG output scales for print-quality asset labels
- `html5-qrcode` v2.3.8: QR scanning — handles camera permission, front/back switch, file fallback; requires `{ ssr: false }` dynamic import
- `recharts` v2.x: Analytics charts — composable SVG components; integrates with Framer Motion; superior to Chart.js for print-to-PDF requirements

**Core technologies — Phase 3:**
- `@react-pdf/renderer` v4.3.2: Board-ready FCI reports — JSX-based PDF authoring in API routes; no Puppeteer binary
- `@serwist/next` + `serwist` ~v9.x: PWA service worker — Next.js 15 App Router official recommendation; successor to unmaintained `next-pwa`
- `dexie` v4.x: IndexedDB offline queue — clean Promise API over IndexedDB for offline mutation queuing and sync

### Expected Features

Research confirmed the competitive gap analysis from the PROJECT.md. No K-12 CMMS as of 2026 has Kanban boards, AI photo diagnosis, or a fully automated 10-domain compliance calendar. These are genuine differentiators, not incremental improvements.

**Must have (table stakes — without these, no evaluation passes):**
- Work order / ticket submission — mobile-first, sub-60 seconds from camera to submitted
- 8-status lifecycle with visual state — the spec's model exceeds baseline requirements (good)
- Email notifications on all status changes — submitters and assigned techs
- Priority levels (Low / Medium / High / Urgent) — 4-tier is industry standard
- Role-based access (submitter vs. technician vs. Head of Maintenance vs. admin)
- Photo upload on submission — mobile camera expected; signed URL pattern required to bypass Next.js 1MB limit
- Campus location picker (Building → Area → Room hierarchy already exists)
- Assignment to specific technician + self-claim by specialty
- Activity feed with internal comments and audit trail
- Basic reporting / Head of Maintenance dashboard
- Mobile-responsive interface — SchoolDude's poor mobile is the primary stated reason Linfield wants to switch
- Preventive maintenance scheduling — required for HVAC, fire, boiler compliance; all three major competitors have this
- Asset register (basic: name, location, make/model, replacement cost)

**Should have (differentiators — these are why Linfield buys Lionheart over the alternatives):**
- Kanban board with drag-and-drop — no K-12 competitor has this; direct visual attack on SchoolDude's list-view paradigm
- AI photo diagnosis (Claude Sonnet, lazy-loaded, cached) — no production K-12 CMMS has this as of 2026
- SCHEDULED status with auto-promotion to BACKLOG — solves Linfield's inflated backlog pain directly
- QA status as a first-class board column — Head of Maintenance inspects before DONE
- Specialty-based self-claim routing — reduces assignment bottleneck without requiring Head to manually route every ticket
- Repeat repair detection with AI replace-vs-repair recommendation — FMX can show history but has no automatic flagging
- QR code asset tagging with ticket pre-population — Incident IQ and FMX have QR lookup but neither pre-populates a submission form
- School calendar PM avoidance (`avoidSchoolYear` flag) — no K-12 CMMS found with explicit academic calendar integration
- Full compliance calendar across 10 regulatory domains (AHERA, NFPA, ADA, Lead in Water, Boiler, Elevator, Kitchen, Playground, Radon, IPM) — market first; current standalone AHERA software (Ecesis) validates this as a real need
- FCI score with board-ready PDF report and AI narrative — FMX has a static FCI page; no live calculated score exists in any K-12 CMMS

**Defer (v2+ / anti-features — do not build these):**
- Vendor / contractor portal (separate auth model; affects <5% of tickets)
- Parts inventory / ordering system (completely different domain; FMX treats it as a full sub-module)
- SIS / student information system integration (dozens of OAuth integrations; maintenance burden)
- Budget system integration (Munis/Tyler APIs are proprietary and fragile; CSV export satisfies 90% of the need)
- State-specific compliance beyond federal domains (requires a separate regulatory content team per state)
- Complex multi-step approval chains (2-4 person facilities teams; over-engineering reverts users to email)
- IoT predictive maintenance (hardware procurement; completely different product category)
- Facility scheduling / event booking (Lionheart already has a separate events module; merging creates UX confusion)
- Fleet management (not a significant K-12 facilities concern)
- Technician gamification / leaderboards (creates resentment with union workers; distorts incentives)

### Architecture Approach

The module follows the established Athletics module pattern exactly: dedicated namespace under `src/app/api/maintenance/` and `src/components/maintenance/`, a thin service layer in `src/lib/services/maintenance/`, and all models registered in the org-scoped Prisma extension. The existing `Ticket` model (OperationsEngine, 3-status) is untouched; the new `MaintenanceTicket` model (8-status) is entirely separate. Every API route follows the existing boilerplate: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext` → `prisma.*`. Notifications and emails are always fire-and-forget, wrapped in try/catch, never blocking a status transition. The Kanban board is read-only projection only; state mutations go through the dedicated `/status` endpoint with its state machine validation. AI analysis is always lazy (triggered on first technician view, not on submission) and cached in `MaintenanceTicket.aiAnalysis` JSON field to avoid repeat Anthropic API costs.

**Major components:**
1. **State machine (`ticketService.ts`)** — Enforces `ALLOWED_TRANSITIONS` map and role gates; atomic status update + activity log via `rawPrisma.$transaction`; the single source of truth for all ticket lifecycle logic
2. **Kanban board (`boardService.ts` + `KanbanBoard.tsx`)** — Multi-filter read query grouped by status; dnd-kit handles drag with TanStack Query optimistic updates and rollback on server rejection; 30s polling with `?since=<timestamp>` delta-only refetch from Phase 1
3. **AI diagnostic service (`aiDiagnosticService.ts`)** — Anthropic SDK direct integration; fetches Supabase Storage images as base64; requests structured JSON output; stores result in ticket `aiAnalysis` field; invalidation trigger on new photo upload
4. **PM engine (`pmEngine.ts`)** — Pull-based query for schedules with `nextDueDate` within advance notice window; idempotent via `@@unique([pmScheduleId, scheduledDueDate])` constraint; runs inside `runWithOrgContext` per org; triggered via Vercel Cron
5. **Offline PWA (Phase 3 only)** — `@serwist/next` service worker + `dexie` IndexedDB mutation queue + optimistic locking (`version` field) + conflict resolution UI; only place existing architecture needs meaningful extension

### Critical Pitfalls

1. **Missing org-scope registration for new Prisma models** — Every new model (`MaintenanceTicket`, `Asset`, `PmSchedule`, `TicketLaborEntry`, `TicketCostEntry`, `TicketActivity`, `TechnicianProfile`, `ComplianceRecord`, `KnowledgeArticle`) must be explicitly added to both the `orgScopedModels` and `softDeleteModels` Sets in `src/lib/db/index.ts`. A model omitted from the list silently uses unscoped `rawPrisma` behavior — Org A reads Org B's data. Prevention: add a dev-only startup assertion that every schema model with an `organizationId` column is present in the extension whitelist.

2. **Status transitions not enforced server-side** — The Kanban board UI enforces column adjacency visually, but `PATCH /api/maintenance/tickets/[id]/status` is callable directly via curl. If the API does not validate the full `ALLOWED_TRANSITIONS` map, any user can skip QA and close tickets without completion photos. Prevention: `validateTransition(fromStatus, toStatus, actorRole, metadata)` called in every PATCH handler; return `400 INVALID_TRANSITION` on failure; unit test every valid and invalid pair.

3. **Next.js 1MB body limit breaks photo uploads** — Mobile camera photos are 3–8MB. Posting them through a Next.js Server Action or API route body throws a 413. Prevention: signed URL pattern — server generates a Supabase signed upload URL; client uploads directly to Supabase Storage; image bytes never pass through Next.js. Also compress client-side with `browser-image-compression` to 1.5MB before upload.

4. **Soft-delete leaking through Prisma `include` clauses** — The org-scoped Prisma extension intercepts top-level queries but NOT nested `include` sub-selects. A soft-deleted `Asset` or `TechnicianProfile` included in a ticket query leaks into the response. Prevention: always add explicit `deletedAt: null` guards inside every `include` clause; never rely on the extension alone for nested relations; write a smoke test exercising this case.

5. **PM ticket duplicate generation from concurrent cron runs** — The check-then-insert PM generation logic is a read-then-write and is not atomic. Two concurrent Vercel edge instances generate two identical PM tickets for the same schedule. Prevention: `@@unique([pmScheduleId, scheduledDueDate])` database constraint; catch `P2002` Prisma unique violation silently as the "already created" code path.

## Implications for Roadmap

The feature dependency graph from FEATURES.md and the build order from ARCHITECTURE.md converge on the same three-phase structure. Each phase has a clear theme, a deliverable that justifies shipping, and prerequisite data that the next phase depends on. The asset register in Phase 2 is the hardest prerequisite constraint: Phase 3's FCI score, compliance calendar, and repeat repair detection all require real `replacementCostUSD` data on assets. If asset register adoption is low during Phase 2, Phase 3 reports will be empty.

### Phase 1: MVP Core — Tickets, Kanban, and AI

**Rationale:** This is the minimum viable product to justify Linfield leaving SchoolDude. The Kanban board and AI diagnosis are the two features that no competitor has — they must ship in Phase 1 to be the "wow" moments in the initial trial period. Without them, Lionheart is a commodity ticket system and there is no compelling reason to switch.

**Delivers:** Mobile-first ticket submission (sub-60 seconds), 8-status Kanban with drag-and-drop, AI photo diagnosis (lazy-loaded and cached), specialty-based self-claim, QA status gate, SCHEDULED status (fixes Linfield's backlog inflation), activity feed with internal comments, email and in-app notifications for full ticket lifecycle, Head of Maintenance dashboard

**Addresses:** All 13 table-stakes features; Kanban, AI diagnosis, SCHEDULED status, QA gate, and self-claim differentiators

**Avoids (pitfalls requiring attention in this phase):** Org-scope whitelist registration (Pitfall 5), server-side state machine validation (Pitfall 2), signed URL photo upload (Pitfall 6), soft-delete in `include` clauses (Pitfall 1), self-claim race condition (Pitfall 14), optimistic drag-drop rollback (Pitfall 3), `?since=` delta polling from day one (Pitfall 13), AI cache invalidation on new photos (Pitfall 9)

**New libraries:** `@dnd-kit/*`, `react-dropzone`, `browser-image-compression`, `@anthropic-ai/sdk`, `react-hook-form` + `@hookform/resolvers`

**New env vars:** `ANTHROPIC_API_KEY`

**Build sequence:** Schema + org-scope registration → permissions → core services (ticketService, notification, email) → API routes → board service + route → AI service + route → frontend (TicketSubmissionForm → KanbanBoard → TicketDetailDrawer → AiDiagnosticPanel) → module gate in AddOnsTab

### Phase 2: Operations Layer — Assets, PM Scheduling, and Analytics

**Rationale:** Asset register must exist before Phase 3 can deliver anything meaningful. FCI calculation requires `replacementCostUSD` data. Compliance tickets link to assets. QR tagging drives asset adoption by making it frictionless for staff. PM scheduling is required for HVAC/fire/boiler compliance and is on every enterprise evaluation checklist. Labor and cost tracking enables the analytics dashboard that justifies the platform to district administrators.

**Delivers:** Asset register with QR code generation and scan-to-submit workflow, preventive maintenance scheduling with Vercel Cron auto-generation, school calendar PM avoidance flag, repeat repair detection with AI replace-vs-repair recommendation, labor hours and cost entry per ticket, loaded hourly rate labor costing, operational analytics dashboard with Recharts charts

**Uses:** `qrcode.react`, `html5-qrcode`, `recharts`, Vercel Cron Jobs (no new package), `rrule` (already installed) for PM recurrence

**Implements:** `assetService.ts`, `pmEngine.ts`, `laborService.ts`, `analyticsService.ts`; extends `MaintenanceTicket` schema with `assetId` FK; new `Asset`, `PmSchedule`, `TicketLaborEntry`, `TicketCostEntry` models

**Avoids (pitfalls requiring attention in this phase):** PM duplicate generation unique constraint (Pitfall 4), iOS PWA camera permission fallback for QR scanning (Pitfall 7), `replacementCostUpdatedAt` field on Asset for FCI staleness warning (Pitfall 11), `schedulingMode: FROM_ORIGINAL_DUE` vs `FROM_COMPLETION` for regulatory PMs (Pitfall 12), `avoidSchoolYear` flag deferred until `SchoolCalendar` model exists (Pitfall 20), QR endpoint authentication guard (Pitfall 18)

**New env vars:** `CRON_SECRET`

### Phase 3: Intelligence Layer — Compliance, FCI, Offline, and Knowledge Base

**Rationale:** Phase 3 is the long-term competitive moat. The 10-domain compliance calendar is a market first — no K-12 CMMS has automated compliance tracking across all federal regulatory domains in one product. The FCI board report justifies capital budget requests to school boards, which is a direct path to becoming the platform the superintendent cares about (not just the Head of Maintenance). The offline PWA is the single largest UX differentiator for campuses with poor Wi-Fi. Building Phase 3 requires Phase 2's asset data to be populated — this is the hardest dependency in the entire roadmap.

**Delivers:** 10-domain compliance calendar (AHERA, NFPA 72, ADA, Lead in Water, Boiler, Elevator, Kitchen, Playground, Radon, IPM) with auto-generated remediation tickets on failed inspections, FCI score with live calculation from real ticket and asset data, board-ready PDF report with AI executive narrative (Claude Sonnet), true offline PWA with IndexedDB mutation queue and background sync, knowledge base with embedded calculators linked from PM checklists and AI diagnosis

**Uses:** `@react-pdf/renderer`, `@serwist/next`, `dexie`

**Implements:** `complianceService.ts`, `reportingService.ts`, `knowledgeService.ts`; service worker + IndexedDB sync; `version` field on `MaintenanceTicket` for optimistic locking; `idempotencyKey` field for offline queue deduplication

**Avoids (pitfalls requiring attention in this phase):** Timezone-naive compliance date arithmetic — must use `date-fns-tz` with `Organization.timezone` field (Pitfall 10); offline sync conflicts via `version` optimistic locking and conflict UI (Pitfall 15); FCI denominator excluding decommissioned assets (phase-specific warning in PITFALLS.md); stale replacement cost warning on FCI report (Pitfall 11)

**Note on `Organization.timezone`:** This field is needed by Phase 3 for compliance date calculations, but should be added to the `Organization` model in Phase 1 settings to allow orgs to configure it before Phase 3 ships.

### Phase Ordering Rationale

- **Tickets before assets before compliance:** The feature dependency graph in FEATURES.md is unambiguous. FCI needs `replacementCostUSD` data from the asset register. Compliance records auto-generate `MaintenanceTicket` rows on failure — those tickets need Phase 1's state machine to exist.
- **AI in Phase 1, not Phase 2:** The AI photo diagnosis is a differentiator that drives trial conversion, not a power-user feature discovered after adoption. It must be present in the initial experience. Deferring it to Phase 2 reduces the "wow" moment in the critical trial period.
- **PM scheduling in Phase 2, not Phase 1:** PM scheduling is table-stakes for enterprise bids but does not drive initial adoption from a pain-first perspective. Linfield's Feb 2026 meeting identified Kanban and mobile UX as the primary pain points. PM scheduling can follow once the core experience is proven.
- **Offline PWA in Phase 3 only:** The PWA requires meaningful changes to the existing architecture (service worker, IndexedDB, conflict resolution). Building it before the core data model is stable would require rework. Phase 3 is the correct placement.
- **`version` field added in Phase 1:** Even though offline sync is Phase 3, the `version` column on `MaintenanceTicket` should be added in Phase 1 to avoid a schema migration on live data later. Zero cost to add it early.

### Research Flags

Phases likely needing deeper planning-phase research:
- **Phase 3 (Offline PWA):** The `@serwist/next` + `dexie` + Background Sync stack has medium confidence. The conflict resolution UX (when server and device diverge) needs detailed design work before implementation. Recommend a focused research spike on the sync architecture before Phase 3 planning.
- **Phase 3 (Compliance Calendar):** The 10 regulatory domains have different inspection cycles, document requirements, and notification cadences. AHERA alone has 5 distinct requirements (re-inspection, periodic surveillance, annual notification, O&M plan, inspector credentials). Each domain needs a detailed requirements pass before the `ComplianceDomainConfig` schema is finalized.
- **Phase 2 (iOS PWA Camera for QR Scanning):** iOS camera permission behavior in PWA context is confirmed as problematic (Pitfall 7). The QR scanning UX needs design work to ensure the manual fallback is equally prominent and functional before the QR feature ships.

Phases with well-documented patterns (standard implementation, skip research-phase):
- **Phase 1 (Kanban + State Machine):** dnd-kit patterns, TanStack Query optimistic updates, and server-side state machine validation are all extensively documented. Follow the ARCHITECTURE.md build sequence directly.
- **Phase 1 (AI Diagnosis):** Anthropic SDK integration and caching pattern are straightforward. The `analyzeTicketPhotos` function in ARCHITECTURE.md is production-ready pseudocode.
- **Phase 2 (PM Scheduling):** Vercel Cron setup and the PM engine pull-pattern are well-documented. The `checkAndGenerateDueTickets` function in ARCHITECTURE.md is production-ready.
- **Phase 2 (Asset Register + QR Generation):** Standard CRUD + `qrcode.react` SVG output. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via npm registry with confirmed versions. Rationale for rejections (react-beautiful-dnd, Puppeteer, next-pwa) is confirmed via official sources and community reports. |
| Features | HIGH | Competitive gaps verified against competitor marketing pages and third-party review sites. FMX FCI page confirmed as static (not live). AHERA-specific standalone software (Ecesis) confirms compliance calendar as a real market gap. Primary source: Linfield meeting notes Feb 2026. |
| Architecture | HIGH | Based on direct codebase inspection of existing platform code. All patterns (org-scoped Prisma extension, runWithOrgContext, fire-and-forget notifications, rawPrisma for transactions) are confirmed working patterns from the existing Athletics module. |
| Pitfalls | HIGH | Most pitfalls verified against official documentation (Prisma GitHub issues, Supabase docs, Apple Developer Forums, US EPA AHERA guidance). Not inferred — each has a confirmed source. |

**Overall confidence:** HIGH

### Gaps to Address

- **`avoidSchoolYear` flag (Phase 2):** The `PmSchedule.avoidSchoolYear` boolean cannot function without a `SchoolCalendar` model storing break periods. Research did not find an existing calendar model in the schema. Either add `SchoolCalendar` with break date ranges as a Phase 2 prerequisite, or ship `avoidSchoolYear` as a display-only flag (scheduling note to the Head) without automated shift logic until the calendar model exists. Decide before Phase 2 planning.
- **`Organization.timezone` field:** Required for Phase 3 compliance date arithmetic. The current `Organization` model may not have a `timezone` field. Verify in schema and add in Phase 1 settings if absent — this is a one-line schema addition with zero risk.
- **`estimatedRepairCostUSD` on `MaintenanceTicket`:** The FEATURES.md FCI research notes this field is needed for FCI "deferred maintenance cost" calculation but is not in the current spec. FCI without estimated repair costs on open tickets is only tracking historical spend, not deferred maintenance. Clarify whether Phase 3 FCI uses (a) only closed ticket costs or (b) estimated costs on open tickets. The latter produces a more useful FCI score but requires this additional field.
- **QR scan library finalization (Phase 2):** `html5-qrcode` v2.3.8 has medium confidence due to its last major release being ~2023. If maintenance concerns materialize by Phase 2 planning, evaluate `@zxing/browser` directly (lower-level, actively maintained by the ZXing org) as a drop-in replacement. Decision needed at Phase 2 kickoff.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/lib/db/index.ts`, `src/lib/org-context.ts`, `src/lib/services/ticketService.ts`, `src/lib/permissions.ts`, `prisma/schema.prisma`, `src/components/settings/AddOnsTab.tsx` — platform conventions and existing module patterns
- `.planning/PROJECT.md` + `.planning/maintenance-spec-v1.1.md` — requirements and key decisions
- `CLAUDE.md` — platform conventions (rawPrisma for transactions, fire-and-forget notifications, org-scope extension behavior)
- Linfield facilities team meeting notes (Feb 12, 2026) — primary source for pain points and SchoolDude criticism
- npm registry (verified versions): `@dnd-kit/core` 6.3.1, `react-dropzone` 15.0.0, `@anthropic-ai/sdk` 0.78.0, `@react-pdf/renderer` 4.3.2, `react-hook-form` 7.71.2
- [Serwist Next.js official docs](https://serwist.pages.dev/docs/next/getting-started) — Next.js 15 App Router PWA
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — Serwist listed as recommended
- [Gordian: Understanding FCI](https://www.gordian.com/resources/understanding-facility-condition-index/) — FCI rating bands confirmed (0-5% Good, 5-10% Fair, 10-30% Poor, 30%+ Critical)
- [US EPA AHERA compliance for schools](https://www.epa.gov/asbestos/asbestos-and-school-buildings) — AHERA inspection requirements
- [Supabase Storage docs](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — signed URL upload pattern, 1MB limit confirmed
- [STRICH Knowledge Base: Camera Access in iOS PWA](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) — iOS camera permission behavior confirmed
- [Apple Developer Forums: iOS PWA camera](https://developer.apple.com/forums/thread/118527) — iOS permission non-persistence confirmed
- [Prisma soft-delete extension issue #14](https://github.com/olivierwilkinson/prisma-extension-soft-delete/issues/14) — nested include bypass confirmed

### Secondary (MEDIUM confidence)
- [FMX School Facilities Management](https://www.gofmx.com/school-facilities-management-software/) — FMX feature set (marketing page)
- [FMX Facility Condition Index page](https://www.gofmx.com/facility-condition-index/) — confirmed as static documentation, not live score
- [Incident IQ K-12 Facilities](https://www.incidentiq.com/products/school-facilities-management-software) — Incident IQ feature set (marketing page)
- [QR Code Asset Tagging CMMS Guide — Fabrico 2025](https://www.fabrico.io/blog/qr-codes-for-maintenance-guide/) — production QR workflow patterns
- [Dexie.js official site](https://dexie.org/) — IndexedDB wrapper, v4.x patterns
- [LogRocket: Best React chart libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) — Recharts vs Visx recommendation
- [Ecesis AHERA Compliance Software](https://www.ecesis.net/Compliance-Calendar-Software/AHERA-compliance-calendar-software.aspx) — confirms standalone AHERA software market
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — cron setup and security pattern
- [LogRocket: Kanban board with dnd-kit](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) — dnd-kit Kanban patterns
- [Supabase GitHub Discussion #37611](https://github.com/orgs/supabase/discussions/37611) — service_role RLS bug in Storage confirmed

### Tertiary (LOW confidence)
- [MaintainX AI-Powered Operations](https://www.getmaintainx.com/use-cases/ai-powered-maintenance-operations) — AI claims on marketing page; not independently verified; treated as "generic AI features" not photo diagnosis
- [ARC Facilities: K-12 facility management challenges](https://www.arcfacilities.com/blog/crucial-facility-management-challenges-in-k12-schools-and-how-to-solve-them) — practitioner blog

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
