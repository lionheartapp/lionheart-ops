---
phase: 9
slug: marketing-and-legal-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests (curl/fetch against live API) — no Vitest yet (Phase 13) |
| **Config file** | none — smoke scripts in `scripts/` |
| **Quick run command** | `npm run smoke:all` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `curl` spot checks on affected routes
- **After every plan wave:** Visual review of all new pages + footer link audit
- **Before `/gsd:verify-work`:** All 6 requirement checks green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | PAGE-01 | Smoke/manual | `curl -s http://localhost:3004/privacy` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | PAGE-02 | Smoke/manual | `curl -s http://localhost:3004/terms` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | PAGE-03 | Smoke/manual | `curl -s http://localhost:3004/pricing` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | PAGE-04 | Smoke/API | `curl -s -X POST http://localhost:3004/api/public/contact -H "Content-Type: application/json" -d '{"name":"Test","email":"t@t.com","message":"Test"}'` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | PAGE-05 | Manual link audit | Click each footer link; verify 200 | ❌ W0 | ⬜ pending |
| 09-03-03 | 03 | 2 | PAGE-06 | Manual/DOM | `curl -s http://localhost:3004/signup` — verify OAuth buttons absent | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No Vitest infrastructure required — smoke/curl checks are sufficient. Vitest is a Phase 13 concern.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Privacy page has COPPA/FERPA sections | PAGE-01 | Content review — must verify legal section depth | Load /privacy, search for "COPPA" and "FERPA" headings |
| Footer links all resolve | PAGE-05 | Full link audit across pages | Click every footer link, confirm no 404s or placeholders |
| OAuth buttons removed from signup | PAGE-06 | Visual/DOM check | Load /signup, verify no "Continue with Google/Microsoft" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
