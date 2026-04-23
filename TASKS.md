# Lionheart Platform — Tasks & Progress

Last updated: **April 23, 2026**

A living log of what's been shipped, what's in progress, and what's left to finish + test.

---

## Quick Status

- **Completed tasks:** 78
- **In progress:** 0
- **Current phase:** Phase A — Performance work (complete, mid-term cleanup remaining)
- **Next up:** Mid-term — CSP fix, performance re-benchmark, monitoring

---

## ✅ What We've Done

### Phase 0 — Dual-School Foundation

Built the multi-school scoping that lets one organization manage multiple schools.

1. Audited Prisma schema vs. handoff assumptions (#1)
2. Mapped full blast radius of hierarchy foreign keys (#6)
3. Synthesized migration PR plan (#7)
4. Wrote global school selector UX spec (#10)
5. Built `useActiveSchool` hook (#13)
6. Built `SchoolSelector` component + mounted in Sidebar (#14)
7. Wired Dashboard as reference consumer (#18)
8. Migrated `/tickets`, `/events`, `/athletics`, `/it-help-desk` to `useActiveSchool` (#21, #22, #31, #33)
9. Fixed `SchoolSelector` role scope (Defect A) (#29)
10. Defaulted `CreateEventProjectModal` to active school (#34)
11. Static QA of all wiring (#25)
12. Playwright E2E for dual-school flow (#26, #30)

### Phase 1 — Athletics Dual-School

Let games have a "home" and "opposing" school.

1. Updated Prisma schema for dual-school games (#12)
2. Updated Game Zod schemas + service layer (#15)
3. Updated Game API routes (#16)
4. Updated `GameDrawer` + `ScheduleSection` UI (#17)
5. Fixed athletics rollups for dual-school viewpoint (#27)
6. Fixed `GameDrawer.updateGame` calendar event title sync (#28)

### Phase 1b — Events Page Integration

1. Verified `eventProjectService` filters + assigns `schoolId` (#32)
2. Type-checked migration (#35)
3. Visual smoke-test of events page school filtering (#36)

### Phase 1c — Facilities Restructure (7-pass migration)

The biggest schema change yet — renamed the whole facilities ontology.

1. Audited current schema vs. proposal (#41)
2. Drafted Phase 1 schema design doc (#42)
3. Presented plan for remote approval (#45)
4. Full blast-radius audit for Path B ontology inversion (#46)
5. Snapshotted local DB before rewrite (#47)
6. Read + rewrote full `prisma/schema.prisma` (#48, #49)
7. Dropped old facilities tables on local DB (#50)
8. Ran `db push` on local (#51)
9. Wrote + ran `seed-linfield-phase-1` script (#52)
10. Verified local DB in Prisma Studio (#53)
11. Ran baseline TypeScript check (#54)
12. Grep audit for old-ontology references (#55)
13. Pass 1: Facilities API + services (#56)
14. Pass 2: Auth + User `schoolScope` → `campusScope` (#57)
15. Pass 3: Organization fields moved to School/District (#58)
16. Pass 4: Area → Space rename (189 hits) (#59)
17. Pass 5: Semantic FK swap — `schoolId` ↔ `campusId` (#60)
18. Pass 6: Type-check clean + smoke test dev server (#61)
19. Pass 7: Fix runtime errors from Pass 5 FK swap (#62)
20. Built clickable HTML mockup of new facilities UI (#38)
21. Fixed mockup page-switching + Linfield campuses bugs (#39)

### Phase A — Performance Optimization (current)

1. Shift 1: Trimmed auth chain (embed role + permissions in JWT) (#63)
2. Shift 2: Edge caching for read-mostly GET endpoints (#64)
3. Shift 2: Inventoried every GET endpoint + classified cacheable (#67)
4. Shift 2: Built shared cached-fetch helper (#68)
5. Shift 2: Wired caching into endpoints (wide sweep) (#69)
6. Shift 2: Two-org smoke test — no cross-tenant leaks (#70)
7. Benchmarked before/after for Phase A (#66)
8. Built shared helpers: query keys + cache invalidation (#65)
9. Wired `useOptimisticMutation` into 2-3 real forms — **pilot** (#71)
10. Rolled out `useOptimisticMutation` to ~68 mutations across all modules (#72)
11. Cleaned up dead hand-rolled `useMutation` imports (#73)
12. Wrote `docs/optimistic-mutations.md` pattern guide (#74)
13. Fixed Phase 1c stragglers: `academicCalendarService` + `studentService` schoolId → campusId (#75)
14. Added passkey (WebAuthn) support as 2FA method alongside TOTP (#76)
15. Verified all Phase 0–1c work with 3-agent parallel audit (#77)
16. Production deploy + smoke tests passing (isolation + benchmark) (#78)

### Supporting Work

1. Wrote consumer migration playbook (#20)
2. Updated playbook priority order (#24)
3. Type-checked tickets migration (#23)
4. Investigated BuildingSchool/AreaSchool junction usage (#4)
5. Audited activeCampusId / global filter pattern (#9)
6. Verified DashboardLayout + hook patterns (#11)
7. Fixed FacilitiesCard hydration error (#37)
8. Revised Facilities restructure proposal (#40)

---

## 🚧 What's Left

### ~~Near-term (finish Phase A)~~ — DONE

1. ~~Roll out `useOptimisticMutation` to more forms~~ — **Done** (~68 mutations converted across IT, Maintenance, Events, Inventory, Settings, Notifications)
2. ~~Delete dead hand-rolled optimistic patterns~~ — **Done** (12 dead imports removed, only ITKanbanBoard + ITMagicLinksTab retain `useMutation` intentionally)
3. ~~Document the pattern~~ — **Done** (`docs/optimistic-mutations.md`)
4. ~~Production deploy + monitoring~~ — **Done** (deployed, smoke tests + benchmarks passing)

### Mid-term

1. **Performance re-benchmark** — re-run the Phase A benchmark after full optimistic rollout.
2. **Remove service-worker Unsplash CSP violations** — the DevTools console is noisy from blocked Unsplash fetches. Either allowlist or stop caching them.
3. **Vercel 500 monitoring** — the recent production 500s (fixed via CLI) suggest we need a health check + alerting pipeline.

### Long-term

1. Phase B: not yet scoped.
2. SOC 2 / security review prep.
3. Full Playwright coverage of critical flows.

---

## 🧪 How to Test Everything

### 1. Type check
```bash
npm run typecheck
```
Must return **0 errors**.

### 2. Local dev smoke test
```bash
npm run dev
```
Open `http://localhost:3004` and walk through:

1. Log in as `admin@demo.com / test123`
2. Academic Calendar → Create Year → row appears → refresh → still there
3. Academic Calendar → Delete Year → row disappears optimistically → persists on refresh
4. Trigger a failure (e.g., duplicate name) → red toast appears → optimistic row rolls back
5. Repeat for Bell Schedules + Special Days
6. Switch schools via `SchoolSelector` → data filters correctly
7. Athletics → create a dual-school game → both schools show in rollups
8. Tickets → assign a ticket → status flips optimistically

### 3. Two-org tenant isolation
```bash
npm run smoke:all
```
Must pass with **no cross-tenant leaks**.

### 4. Playwright E2E
```bash
npx playwright test
```
Focus on the dual-school + athletics viewpoint flip suites (#26, #30).

### 5. Production sanity check
After deploying to `demo.lionheartapp.com`:

1. Open DevTools → Network tab
2. Load `/settings?tab=academic-calendar` — no 500s
3. Load `/athletics` — no 500s
4. Load `/it-help-desk` — no 500s
5. Create → Edit → Delete a year end-to-end

### 6. Benchmark check
Re-run the Phase A benchmark script and compare p50/p95 latencies against the baseline recorded in #66.

---

## 📁 Key Files (for context)

- `src/lib/hooks/useOptimisticMutation.ts` — the pattern being rolled out
- `src/lib/queries.ts` — query key factory
- `src/lib/cache/route-cache.ts` — server-side cache
- `src/lib/db/index.ts` — org-scoped Prisma client
- `src/lib/auth.ts` — JWT sign/verify
- `prisma/schema.prisma` — source of truth for data model
- `CLAUDE.md` — architecture + conventions
