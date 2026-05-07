---
phase: 23
slug: schema-permissions-and-rls-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing project test infra) |
| **Config file** | `jest.config.js` or "none — Wave 0 installs" |
| **Quick run command** | `npx jest --testPathPattern messaging --bail` |
| **Full suite command** | `npx jest --testPathPattern messaging` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern messaging --bail`
- **After every plan wave:** Run `npx jest --testPathPattern messaging`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | SCHEMA-01 | — | N/A | schema | `npx prisma validate` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | SCHEMA-03 | — | N/A | unit | `npx jest --testPathPattern permissions` | ❌ W0 | ⬜ pending |
| 23-02-01 | 02 | 1 | SCHEMA-02 | T-23-01 | Org A token cannot read Org B messages | integration | `npx jest --testPathPattern rls` | ❌ W0 | ⬜ pending |
| 23-02-02 | 02 | 1 | SCHEMA-04 | T-23-02 | Channel member isolation enforced | integration | `npx jest --testPathPattern rls` | ❌ W0 | ⬜ pending |
| 23-03-01 | 03 | 2 | SCHEMA-05 | — | N/A | integration | `npx jest --testPathPattern triggers` | ❌ W0 | ⬜ pending |
| 23-03-02 | 03 | 2 | SCHEMA-06 | — | N/A | unit | `npx jest --testPathPattern messaging-gate` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for schema validation (SCHEMA-01)
- [ ] Test stubs for RLS org isolation (SCHEMA-02)
- [ ] Test stubs for permission seeding (SCHEMA-03)
- [ ] Test stubs for channel membership isolation (SCHEMA-04)
- [ ] Test stubs for tsvector/GIN and unread triggers (SCHEMA-05)
- [ ] Test stubs for messagingEnabled gate (SCHEMA-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS cross-org isolation with real Supabase JWT | SCHEMA-02 | Requires two separate org JWT tokens against live Supabase | Use smoke test scripts with two org tokens; verify SELECT returns 0 rows for wrong org |
| db:push completes without errors | SCHEMA-01 | Requires live database connection | Run `npm run db:push` and verify exit code 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
