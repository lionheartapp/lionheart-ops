---
phase: 19
slug: event-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest (via Next.js) |
| **Config file** | `jest.config.js` or `vitest.config.ts` |
| **Quick run command** | `npm test -- --changedSince=HEAD~1` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --changedSince=HEAD~1`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | EVNT-09 | integration | `npm test -- sidebar` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | EVNT-04 | unit | `npm test -- EventProject` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | EVNT-01 | integration | `npm test -- event-project` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 1 | EVNT-02 | integration | `npm test -- event-series` | ❌ W0 | ⬜ pending |
| 19-02-03 | 02 | 1 | EVNT-03 | integration | `npm test -- event-request` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | EVNT-05 | unit | `npm test -- schedule-block` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 2 | EVNT-06 | unit | `npm test -- event-task` | ❌ W0 | ⬜ pending |
| 19-03-03 | 03 | 2 | EVNT-07 | unit | `npm test -- activity-log` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 3 | EVNT-08 | integration | `npm test -- calendar-bridge` | ❌ W0 | ⬜ pending |
| 19-05-01 | 05 | 3 | EVNT-10 | integration | `npm test -- event-dashboard` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/event-project/` — test directory structure
- [ ] `src/__tests__/event-project/api.test.ts` — API route tests for EventProject CRUD
- [ ] `src/__tests__/event-project/service.test.ts` — Service layer tests
- [ ] `src/__tests__/event-project/sidebar.test.ts` — Sidebar navigation refactor tests
- [ ] Test fixtures for EventProject, EventSeries, EventScheduleBlock, EventTask, EventActivityLog

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar shows Events with nested Calendar/Planning | EVNT-09 | Visual layout + animation | 1. Log in as staff 2. Verify Events in sidebar 3. Click to expand 4. Verify Calendar + Planning nested |
| 8-tab EventProject page loads without error | EVNT-04 | Visual + UX verification | 1. Create EventProject 2. Click each of 8 tabs 3. Verify empty states render correctly |
| Calendar deep-link from bridged event | EVNT-08 | Browser navigation | 1. Create EventProject 2. View calendar 3. Click bridged event 4. Verify lands on EventProject page |
| AI dashboard action items render | EVNT-10 | AI output variability | 1. Create 3+ active events with tasks 2. Visit dashboard 3. Verify action items appear 4. Tap to resolve |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
