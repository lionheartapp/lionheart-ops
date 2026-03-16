# Milestones

## v3.0 Events Are the Product (Shipped: 2026-03-16)

**Phases:** 4 (19-22) | **Plans:** 34 | **Tasks:** 104
**Timeline:** 2 days (2026-03-14 - 2026-03-16) | **Commits:** 75
**Files changed:** 280 | **Lines added:** 63,077 | **Total LOC:** 205,642 TypeScript
**Git range:** feat(19-01) - feat(22-11)
**Requirements:** 56/56 satisfied | **Audit:** tech_debt (no critical blockers)

**Delivered:** Reoriented the platform around events as the organizing principle. Every approved event becomes a full planning workspace with registration, forms, documents, logistics, budgets, communication, and day-of tools. Added first public-facing pages for parent/participant interaction without accounts.

**Key accomplishments:**
1. EventProject workspace - Full 8-tab project hub with three entry paths and AI-prioritized action dashboard
2. Public registration & payments - White-label event pages with multi-step form builder, Stripe payments, e-signatures, QR codes, and magic-link parent portal
3. Documents, groups & logistics - Document completion tracking, drag-and-drop group assignments, printable PDFs, and elective activity signups
4. Day-of operations - QR check-in with real-time counters, incident logging, offline PWA with Dexie sync, and participant self-service
5. AI-powered event planning - Natural language event creation, form/schedule/group generation, budget estimation, conflict detection, status summaries, feedback analysis, and templates with AI enhancement
6. External integrations - Planning Center sync, Google Calendar, Twilio SMS, notification orchestration with automated timelines

### Known Tech Debt
- NOTIFICATION_RULES_RECALCULATED enum value missing from Prisma schema (activity log write fails on notification recalculation)
- POST /api/events/ai/generate-schedule endpoint has no UI consumer (orphaned)
- EventPeopleTab is a non-functional placeholder (all data in Registration tab)
- 10+ environment variables undocumented in CLAUDE.md
- Smoke tests for Phases 21-22 are stubs
- Nyquist validation incomplete across all 4 phases

**Archives:**
- `.planning/milestones/v3.0-ROADMAP.md`
- `.planning/milestones/v3.0-REQUIREMENTS.md`
- `.planning/milestones/v3.0-MILESTONE-AUDIT.md`

---

## v2.0 Launch Readiness (Completed: 2026-03-14)

**Phases:** 11 (8-18) | **Plans:** 57
**Delivered:** Production-grade infrastructure including auth hardening (httpOnly cookies), legal compliance pages, inventory management, Stripe billing, audit logging, Vitest unit tests, CI/CD pipeline, structured logging, cursor pagination, IT Help Desk module, and Athletics module.

**Archives:**
- See `.planning/milestones/` (archived with v3.0 ROADMAP)

---

## v1.0 Maintenance & Facilities (Shipped: 2026-03-06)

**Phases:** 7 (1-7) | **Plans:** 21
**Delivered:** Foundation platform with multi-tenant architecture, maintenance ticket lifecycle, Kanban board, AI photo diagnosis, asset management, compliance calendar, board reporting, knowledge base, and offline PWA.

**Archives:**
- See `.planning/milestones/` (archived with v3.0 ROADMAP)

---

*Last updated: 2026-03-16 after v3.0 milestone*
