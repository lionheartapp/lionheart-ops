---
phase: 11
slug: calendar-ticket-and-feature-gaps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests (Node.js .mjs scripts) — no Vitest unit tests yet |
| **Config file** | `package.json` scripts (`smoke:*`) |
| **Quick run command** | `npm run smoke:campus` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run smoke:campus`
- **After every plan wave:** Run `npm run smoke:all && node scripts/smoke-draft-events.mjs && node scripts/smoke-tickets.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | CAL-01 | smoke | `node scripts/smoke-draft-events.mjs` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | CAL-02 | smoke | `node scripts/smoke-draft-events.mjs` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | TIX-01 | manual visual | manual | N/A | ⬜ pending |
| 11-03-02 | 03 | 2 | TIX-02 | smoke | `node scripts/smoke-tickets.mjs` | ❌ W0 | ⬜ pending |
| 11-03-03 | 03 | 2 | TIX-03 | smoke | `node scripts/smoke-tickets.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-draft-events.mjs` — stubs for CAL-01, CAL-02
- [ ] `scripts/smoke-tickets.mjs` — stubs for TIX-02, TIX-03

*Existing `smoke:campus` and `smoke:all` cover baseline; new scripts needed for phase-specific routes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edit button opens editable fields in ticket drawer | TIX-01 | UI interaction — click behavior in React component | 1. Open dashboard 2. Click a ticket 3. Click edit button 4. Verify editable fields appear 5. Save and verify update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
