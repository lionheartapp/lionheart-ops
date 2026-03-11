---
phase: 14
slug: ai-assistant-ux-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests (Node.js .mjs scripts hitting live API) |
| **Config file** | `scripts/smoke-*.mjs` |
| **Quick run command** | `npm run smoke:all` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Manual browser test of affected component + `npm run smoke:all`
- **After every plan wave:** `npm run smoke:all` + manual chat panel walkthrough
- **Before `/gsd:verify-work`:** Full suite must be green + all 5 AI-UX requirements visually verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | AI-UX-01 | manual UI | Visual inspection in browser | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | AI-UX-02 | manual UI | Visual inspection in browser | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | AI-UX-03 | smoke/integration | `node scripts/smoke-ai-assistant.mjs` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | AI-UX-04 | smoke/integration | `node scripts/smoke-ai-assistant.mjs` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | AI-UX-05 | manual UI | Visual inspection in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-ai-assistant.mjs` — smoke test covering AI-UX-03 and AI-UX-04 (room availability + weather tool calls via API)

*UI component tests (AI-UX-01, AI-UX-02, AI-UX-05) are manual-only — Vitest not yet installed (Phase 13 INFRA-01).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Choice buttons appear below Leo messages | AI-UX-01 | UI rendering requires browser | 1. Ask Leo a question that triggers choices 2. Verify tappable buttons appear 3. Click a button, verify it sends as user message |
| Suggestion chips after data responses | AI-UX-02 | UI rendering requires browser | 1. Ask Leo for data (e.g., ticket stats) 2. Verify contextual chips appear below response 3. Click a chip, verify it sends as user message |
| Rich confirmation card for event creation | AI-UX-05 | Complex UI component with inline editing | 1. Ask Leo to create an event 2. Verify card shows editable fields 3. Verify resource availability warnings shown 4. Verify approval chain preview 5. Edit a field inline, confirm, verify payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
