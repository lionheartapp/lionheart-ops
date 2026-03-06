---
phase: 3
slug: kanban-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke tests (`scripts/smoke-*.mjs`) — no automated test framework |
| **Config file** | None — smoke tests are standalone Node scripts |
| **Quick run command** | `npm run smoke:all` (requires live API) |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Manual review of changed components in browser
- **After every plan wave:** Run `npm run smoke:all` and verify board loads + drag works
- **Before `/gsd:verify-work`:** Full smoke suite green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | BOARD-01 | manual | Browser: verify columns render | N/A | ⬜ pending |
| 03-01-02 | 01 | 1 | BOARD-02 | manual | Browser: drag card between columns | N/A | ⬜ pending |
| 03-01-03 | 01 | 1 | BOARD-03 | smoke | `node scripts/smoke-kanban-board.mjs` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | BOARD-04 | smoke | `node scripts/smoke-kanban-board.mjs` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | BOARD-05 | smoke | `node scripts/smoke-kanban-board.mjs` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | BOARD-06 | manual | Browser: verify card content | N/A | ⬜ pending |
| 03-01-07 | 01 | 1 | BOARD-07 | smoke | `node scripts/smoke-kanban-board.mjs` | ❌ W0 | ⬜ pending |
| 03-01-08 | 01 | 1 | BOARD-08 | manual | Browser: verify SCHEDULED separation | N/A | ⬜ pending |
| 03-02-01 | 02 | 2 | AI-01 | manual | Browser: expand panel, verify lazy load | N/A | ⬜ pending |
| 03-02-02 | 02 | 2 | AI-02 | manual | Browser: verify diagnosis fields | N/A | ⬜ pending |
| 03-02-03 | 02 | 2 | AI-03 | manual | Browser: verify confidence badge | N/A | ⬜ pending |
| 03-02-04 | 02 | 2 | AI-04 | manual | Browser: Ask AI input + response | N/A | ⬜ pending |
| 03-02-05 | 02 | 2 | AI-05 | manual | Browser: open Custodial ticket, verify PPE | N/A | ⬜ pending |
| 03-02-06 | 02 | 2 | AI-06 | smoke | Check aiAnalysis field in API response | ❌ W0 | ⬜ pending |
| 03-02-07 | 02 | 2 | AI-07 | manual | Browser: verify label text | N/A | ⬜ pending |
| 03-02-08 | 02 | 2 | AI-08 | manual | Check route imports Anthropic SDK | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-kanban-board.mjs` — covers BOARD-03, BOARD-04, BOARD-05, BOARD-07 (verify board API returns correct ticket sets per view, filters work)
- No framework install needed — smoke test pattern already established in project

*Existing infrastructure covers remaining requirements via manual browser verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop moves ticket | BOARD-02 | Requires browser interaction | Drag card from BACKLOG to TODO, verify status updates in DB |
| Invalid drag visual rejection | BOARD-02 | Requires visual inspection | Drag BACKLOG card to IN_PROGRESS, verify red overlay + snap back |
| Gate modal on ON_HOLD drop | BOARD-02 | Requires form interaction | Drag to ON_HOLD, verify modal appears, cancel reverts |
| AI panel lazy loads | AI-01 | Requires browser timing | Open ticket with photos, expand AI panel, verify network call |
| PPE panel auto-shows | AI-05 | Requires visual inspection | Open Custodial ticket, verify amber warning card visible |
| Cached AI results | AI-06 | Requires two page loads | Load ticket with AI, navigate away, return, verify no second API call |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
