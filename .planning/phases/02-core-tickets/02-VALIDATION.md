---
phase: 2
slug: core-tickets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests (Node.js scripts hitting live API — established project pattern) |
| **Config file** | none — Wave 0 creates smoke scripts |
| **Quick run command** | `node scripts/smoke-maintenance-submit.mjs` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build --no-lint` (build must pass)
- **After every plan wave:** Run `node scripts/smoke-maintenance-submit.mjs` + `node scripts/smoke-maintenance-lifecycle.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SUBMIT-01 thru SUBMIT-07 | smoke | `node scripts/smoke-maintenance-submit.mjs` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | LIFE-01 thru LIFE-08 | smoke | `node scripts/smoke-maintenance-lifecycle.mjs` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | ROUTE-01 thru ROUTE-05 | smoke | `node scripts/smoke-maintenance-routing.mjs` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | NOTIF-01 thru NOTIF-11 | smoke | included in lifecycle + routing scripts | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SUBMIT-08, SUBMIT-09 | manual | N/A — AI features require API key + visual verification | N/A | ⬜ pending |
| 02-04-02 | 04 | 2 | DETAIL-01 thru DETAIL-05 | manual | N/A — visual inspection required | N/A | ⬜ pending |
| 02-04-03 | 04 | 2 | LIFE-07, NOTIF-09 | manual | N/A — cron requires time passage or manual trigger | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-maintenance-submit.mjs` — stubs for SUBMIT-01 thru SUBMIT-11 (minus AI features)
- [ ] `scripts/smoke-maintenance-lifecycle.mjs` — stubs for LIFE-01 thru LIFE-08
- [ ] `scripts/smoke-maintenance-routing.mjs` — stubs for ROUTE-01 thru ROUTE-05
- [ ] `prisma/schema.prisma` — add `staleAlertSent Boolean @default(false)` to MaintenanceTicket
- [ ] Supabase `maintenance-photos` bucket — create with public read access
- [ ] `vercel.json` — create with cron schedule for `/api/cron/maintenance-tasks`
- [ ] `.env.example` — add `CRON_SECRET` entry

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI category auto-suggest | SUBMIT-08 | Requires Gemini API key + visual check of auto-filled category | Upload photo in wizard, verify category dropdown is auto-filled with "AI suggested" label |
| AI multi-issue detection | SUBMIT-09 | Requires Gemini API key + visual check of split suggestion | Submit ticket with multiple issues described, verify "Split into 2 tickets" banner appears on Review step |
| Ticket detail page rendering | DETAIL-01 thru DETAIL-05 | UI layout verification | Open ticket detail, confirm two-column layout, status progress bar, activity feed, submitter info |
| Cron: 48h stale alerts | NOTIF-09 | Requires time passage or manual cron trigger | Create BACKLOG ticket, wait 48h (or manually invoke cron), verify alert email + in-app notification |
| Cron: scheduled ticket activation | LIFE-07 | Requires scheduled date to pass | Create SCHEDULED ticket with past date, invoke cron, verify status moves to BACKLOG |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
