import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'
import type { ApiClient } from '../helpers/api'

/**
 * SchoolSelector — dual-school viewpoint E2E.
 *
 * Covers the hierarchy restructuring work: global school picker in the sidebar,
 * `useActiveSchool` hook, and the "Viewing: X" subtitle on consumer pages
 * (Dashboard, IT Help Desk).
 *
 * Skip gates (each test has its own guard — no hard env requirements beyond the
 * standard E2E_* vars):
 *   - Admin tests skip if Org A has < 2 active schools.
 *   - Scoped-role tests skip if the member user is not school-scoped in the DB
 *     (i.e. their `campusScope` column is empty).
 *
 * Reference implementations exercised:
 *   - src/components/sidebar/SchoolSelector.tsx
 *   - src/lib/hooks/useActiveSchool.ts
 *   - src/app/dashboard/page.tsx   (subtitle + isMultiSchool gate)
 *   - src/app/it/page.tsx          (subtitle + prop-drilled activeSchoolId)
 *   - src/app/athletics/page.tsx   (drives ScheduleSection from activeSchoolId)
 *   - src/components/athletics/ScheduleSection.tsx  (dual-school viewpoint flip)
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

interface CampusRow {
  id: string
  name: string
  isActive: boolean
}

/**
 * Fetch the list of active schools for Org A. We rely on the same endpoint
 * `useActiveSchool` consumes so the test data mirrors what the UI sees.
 */
async function fetchActiveSchools(api: ApiClient): Promise<CampusRow[]> {
  const { status, body } = await api.get<CampusRow[]>('/api/settings/campus/campuses')
  expect(status, 'campuses endpoint should return 200').toBe(200)
  if (!body.ok) {
    throw new Error(`campuses endpoint returned error: ${body.error.code}`)
  }
  return (body.data ?? []).filter((s) => s.isActive)
}

/**
 * Read the auth/role localStorage stamps written by `Providers` after login.
 * Waits until both `user-role` and `org-id` are present (or times out) so that
 * subsequent assertions have a stable baseline.
 */
async function waitForAuthStamps(page: Page): Promise<{
  role: string | null
  campusScope: string | null
}> {
  await page.waitForFunction(
    () => {
      return Boolean(window.localStorage.getItem('org-id')) &&
        window.localStorage.getItem('user-role') !== null
    },
    undefined,
    { timeout: 15_000 },
  )
  return page.evaluate(() => ({
    role: window.localStorage.getItem('user-role'),
    campusScope:
      window.localStorage.getItem('user-campus-scope') ||
      window.localStorage.getItem('user-school-scope'),
  }))
}

/** Read the currently-persisted active school id from localStorage. */
async function readActiveSchool(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('active-school-id'))
}

/** Locate the SchoolSelector trigger button (interactive mode only). */
function schoolSelectorTrigger(page: Page) {
  return page.getByRole('button', { name: /^active (school|campus):.+click to change/i })
}

/** Locate the SchoolSelector read-only badge (scoped mode only). */
function schoolSelectorBadge(page: Page) {
  return page.getByRole('group', { name: /active (school|campus):.+pinned to your account/i })
}

// ── Admin: interactive selector ────────────────────────────────────────────

test.describe('SchoolSelector — admin interactive', () => {
  test('switches active school and propagates across pages', async ({
    adminPage,
    adminApi,
  }) => {
    const schools = await fetchActiveSchools(adminApi)
    test.skip(
      schools.length < 2,
      `Org A only has ${schools.length} active school(s); need ≥ 2 for the multi-school test.`,
    )

    // Navigate to the dashboard and confirm auth has fully bootstrapped so the
    // role/scope stamps are in place before reading them.
    await adminPage.goto('/dashboard')
    const { role } = await waitForAuthStamps(adminPage)
    test.skip(
      !role || role.toLowerCase() === 'member' || role.toLowerCase() === 'viewer',
      `Admin fixture is not admin-level (role=${role ?? 'null'}); scoped roles can't exercise the picker.`,
    )

    // Reset any stale pick so the test starts from "All Schools".
    await adminPage.evaluate(() =>
      window.localStorage.removeItem('active-school-id'),
    )
    await adminPage.reload()
    await waitForAuthStamps(adminPage)

    // Trigger is visible and interactive (not the read-only badge).
    const trigger = schoolSelectorTrigger(adminPage)
    await expect(trigger).toBeVisible({ timeout: 10_000 })
    await expect(schoolSelectorBadge(adminPage)).toHaveCount(0)

    // Open the listbox, confirm "All Schools" + every active school is present.
    await trigger.click()
    const listbox = adminPage.getByRole('listbox', { name: /select a (school|campus)/i })
    await expect(listbox).toBeVisible({ timeout: 5_000 })

    const allOption = listbox.getByRole('option', { name: /^all schools$/i })
    await expect(allOption).toBeVisible()
    for (const s of schools) {
      await expect(
        listbox.getByRole('option', { name: new RegExp(`^${escapeRegex(s.name)}$`) }),
      ).toBeVisible()
    }

    // Pick the first school.
    const target = schools[0]
    await listbox.getByRole('option', { name: new RegExp(`^${escapeRegex(target.name)}$`) }).click()

    // Trigger label updates + localStorage writes + subtitle renders on dashboard.
    await expect(trigger).toHaveAccessibleName(
      new RegExp(`active (school|campus): ${escapeRegex(target.name)}`, 'i'),
    )
    await expect
      .poll(() => readActiveSchool(adminPage), { timeout: 5_000 })
      .toBe(target.id)
    await expect(
      adminPage.getByText(new RegExp(`Viewing:\\s*${escapeRegex(target.name)}`)),
    ).toBeVisible({ timeout: 5_000 })

    // Navigate to another non-module-gated page — the same viewpoint must
    // render there. Proves the hook is a shared store (localStorage + custom
    // event), not page-local state.
    await adminPage.goto('/calendar')
    await expect(schoolSelectorTrigger(adminPage)).toHaveAccessibleName(
      new RegExp(`active (school|campus): ${escapeRegex(target.name)}`, 'i'),
    )

    // Switching back to "All Schools" clears the persisted value and hides the
    // subtitle on pages where it's conditional. isMultiSchool stays true so the
    // selector itself keeps rendering.
    await schoolSelectorTrigger(adminPage).click()
    await adminPage.getByRole('listbox').getByRole('option', { name: /^all schools$/i }).click()
    await expect
      .poll(() => readActiveSchool(adminPage), { timeout: 5_000 })
      .toBeNull()
    await expect(schoolSelectorTrigger(adminPage)).toHaveAccessibleName(
      /active (school|campus): all schools/i,
    )
  })

  test('keyboard navigation selects a school without a mouse', async ({
    adminPage,
    adminApi,
  }) => {
    const schools = await fetchActiveSchools(adminApi)
    test.skip(schools.length < 2, `Need ≥ 2 active schools; have ${schools.length}.`)

    await adminPage.goto('/dashboard')
    const { role } = await waitForAuthStamps(adminPage)
    test.skip(
      !role || role.toLowerCase() === 'member' || role.toLowerCase() === 'viewer',
      `Admin fixture is not admin-level (role=${role}).`,
    )
    await adminPage.evaluate(() =>
      window.localStorage.removeItem('active-school-id'),
    )
    await adminPage.reload()
    await waitForAuthStamps(adminPage)

    const trigger = schoolSelectorTrigger(adminPage)
    await trigger.focus()
    await adminPage.keyboard.press('Enter')

    const listbox = adminPage.getByRole('listbox', { name: /select a (school|campus)/i })
    await expect(listbox).toBeVisible()
    await listbox.focus()

    // ArrowDown from "All Schools" → first real school (index 1), then Enter.
    await adminPage.keyboard.press('ArrowDown')
    await adminPage.keyboard.press('Enter')

    const target = schools[0]
    await expect
      .poll(() => readActiveSchool(adminPage), { timeout: 5_000 })
      .toBe(target.id)
    await expect(trigger).toHaveAccessibleName(
      new RegExp(`active (school|campus): ${escapeRegex(target.name)}`, 'i'),
    )
  })
})

// ── Member: scoped role (read-only badge + snap-back) ──────────────────────

test.describe('SchoolSelector — scoped role', () => {
  test('pinned member sees a read-only badge, not a dropdown', async ({
    memberPage,
    adminApi,
  }) => {
    const schools = await fetchActiveSchools(adminApi)
    test.skip(
      schools.length < 2,
      `Org A only has ${schools.length} active school(s); scoped-role test needs ≥ 2.`,
    )

    await memberPage.goto('/dashboard')
    const { role, campusScope } = await waitForAuthStamps(memberPage)

    const isScoped =
      (role?.toLowerCase() === 'member' || role?.toLowerCase() === 'viewer') &&
      Boolean(campusScope)
    test.skip(
      !isScoped,
      `Member fixture is not school-scoped (role=${role}, campusScope=${campusScope ?? 'null'}). ` +
        `Set User.campusScope on E2E_MEMBER_EMAIL to exercise this path.`,
    )

    // Reload once to guarantee the hook's initial-state getter sees the stamped
    // localStorage. (Providers stamps async on mount; a fresh getter run reads
    // the final values.)
    await memberPage.reload()
    await waitForAuthStamps(memberPage)

    // The read-only badge should render; the interactive trigger should not.
    const badge = schoolSelectorBadge(memberPage)
    await expect(badge).toBeVisible({ timeout: 10_000 })
    await expect(schoolSelectorTrigger(memberPage)).toHaveCount(0)

    // No listbox accessible from the badge — keyboard focus on it doesn't open
    // a menu.
    await badge.focus().catch(() => {
      /* group has no inherent tabstop — that's fine */
    })
    await memberPage.keyboard.press('Enter')
    await expect(
      memberPage.getByRole('listbox', { name: /select a (school|campus)/i }),
    ).toHaveCount(0)
  })

  test('snap-back: tampering with localStorage reverts to the pinned school', async ({
    memberPage,
    adminApi,
  }) => {
    const schools = await fetchActiveSchools(adminApi)
    test.skip(
      schools.length < 2,
      `Org A only has ${schools.length} active school(s); snap-back needs ≥ 2.`,
    )

    await memberPage.goto('/dashboard')
    const { role, campusScope } = await waitForAuthStamps(memberPage)
    const isScoped =
      (role?.toLowerCase() === 'member' || role?.toLowerCase() === 'viewer') &&
      Boolean(campusScope)
    test.skip(
      !isScoped,
      `Member fixture is not school-scoped (role=${role}, campusScope=${campusScope ?? 'null'}).`,
    )

    // Resolve the pinned school id. campusScope may be stored as either an id
    // or a name — mirror the hook's own resolution logic.
    const pinned =
      schools.find((s) => s.id === campusScope) ??
      schools.find((s) => s.name === campusScope)
    test.skip(
      !pinned,
      `campusScope="${campusScope}" did not match any active school — data seed issue.`,
    )

    // Pick a different school to simulate tampering with.
    const rogue = schools.find((s) => s.id !== pinned!.id)
    expect(rogue, 'need a second distinct school for snap-back').toBeDefined()

    // Write the rogue id into localStorage and reload. The hook's role-pin
    // effect should fire on mount, detect the mismatch, and snap back.
    await memberPage.evaluate((id) => {
      window.localStorage.setItem('active-school-id', id)
    }, rogue!.id)

    await memberPage.reload()
    await waitForAuthStamps(memberPage)

    await expect
      .poll(() => readActiveSchool(memberPage), { timeout: 10_000 })
      .toBe(pinned!.id)
  })
})

// ── Athletics viewpoint flip ───────────────────────────────────────────────

/**
 * Shape of the rows returned by `/api/athletics/games`. We only depend on the
 * fields the viewpoint math reads, so unrelated columns (scores, venue, etc.)
 * stay untyped.
 */
interface GameRow {
  id: string
  athleticTeamId: string
  opponentAthleticTeamId: string | null
  opponentName: string
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL'
  athleticTeam?: {
    id: string
    name: string
    schoolId: string | null
  }
  opponentAthleticTeam?: {
    id: string
    name: string
    schoolId: string | null
  } | null
}

interface CrossSchoolGame {
  game: GameRow
  owningSchoolId: string
  opponentSchoolId: string
  owningTeamName: string
  opponentTeamName: string
  homeAway: 'HOME' | 'AWAY'
}

/**
 * Find a game that genuinely exercises the dual-school viewpoint flip:
 *   - has an in-org opponent team (opponentAthleticTeamId set)
 *   - owning team and opponent team live in *different* schools
 *   - homeAway is decisive (not 'NEUTRAL', which doesn't flip)
 *
 * Returns `null` when no such game exists — the caller should skip the test
 * rather than fabricate data, so this spec stays seed-tolerant.
 */
async function findCrossSchoolGame(api: ApiClient): Promise<CrossSchoolGame | null> {
  const { status, body } = await api.get<GameRow[]>('/api/athletics/games')
  if (status !== 200 || !body.ok) return null
  const games = body.data ?? []
  for (const g of games) {
    if (!g.opponentAthleticTeamId) continue
    if (g.homeAway === 'NEUTRAL') continue
    const owningSchoolId = g.athleticTeam?.schoolId ?? null
    const opponentSchoolId = g.opponentAthleticTeam?.schoolId ?? null
    if (!owningSchoolId || !opponentSchoolId) continue
    if (owningSchoolId === opponentSchoolId) continue
    return {
      game: g,
      owningSchoolId,
      opponentSchoolId,
      owningTeamName: g.athleticTeam!.name,
      opponentTeamName: g.opponentAthleticTeam!.name,
      homeAway: g.homeAway,
    }
  }
  return null
}

/**
 * Write the active school viewpoint via the same storage + event contract
 * `useActiveSchool` consumes. Doing this directly (rather than through the
 * SchoolSelector click path) keeps the athletics test focused on the
 * viewpoint-flip contract — the picker itself is already exercised by the
 * admin-interactive tests above.
 */
async function setActiveSchoolViaStorage(page: Page, schoolId: string): Promise<void> {
  await page.evaluate((id) => {
    window.localStorage.setItem('active-school-id', id)
    window.dispatchEvent(
      new CustomEvent('active-school-changed', { detail: { schoolId: id } }),
    )
  }, schoolId)
}

/** Tell the athletics page to switch to the Schedule tab. */
async function openScheduleTab(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('athletics-tab-change', { detail: { tab: 'schedule' } }),
    ),
  )
}

test.describe('SchoolSelector — athletics viewpoint flip', () => {
  test('cross-school game prefix flips when viewing the opponent school', async ({
    adminPage,
    adminApi,
  }) => {
    const schools = await fetchActiveSchools(adminApi)
    test.skip(
      schools.length < 2,
      `Org A only has ${schools.length} active school(s); viewpoint-flip test needs ≥ 2.`,
    )

    const candidate = await findCrossSchoolGame(adminApi)
    test.skip(
      !candidate,
      'No cross-school games (owning school ≠ opponent school, non-neutral) found in Org A. ' +
        'Seed a dual-school game to exercise this path.',
    )

    // Confirm both schools from the candidate are actually selectable — a game
    // could reference a deactivated school edge case. Skip if so.
    const owningKnown = schools.some((s) => s.id === candidate!.owningSchoolId)
    const opponentKnown = schools.some((s) => s.id === candidate!.opponentSchoolId)
    test.skip(
      !owningKnown || !opponentKnown,
      'Candidate game references a school that is no longer active — skipping.',
    )

    await adminPage.goto('/athletics')
    const { role } = await waitForAuthStamps(adminPage)
    test.skip(
      !role || role.toLowerCase() === 'member' || role.toLowerCase() === 'viewer',
      `Admin fixture is not admin-level (role=${role ?? 'null'}); scoped roles can't switch schools.`,
    )

    await openScheduleTab(adminPage)

    // ── Owning-school viewpoint: homeAway stored on the row is what renders. ──
    await setActiveSchoolViaStorage(adminPage, candidate!.owningSchoolId)

    const owningPrefix = candidate!.homeAway === 'AWAY' ? '@' : 'vs'
    await expect(
      adminPage
        .getByText(
          new RegExp(
            `${escapeRegex(owningPrefix)}\\s+${escapeRegex(candidate!.opponentTeamName)}`,
          ),
        )
        .first(),
      `owning-school view should render "${owningPrefix} ${candidate!.opponentTeamName}"`,
    ).toBeVisible({ timeout: 15_000 })

    // ── Opponent-school viewpoint: homeAway flips, opponent label swaps. ──
    await setActiveSchoolViaStorage(adminPage, candidate!.opponentSchoolId)

    const flippedPrefix = candidate!.homeAway === 'AWAY' ? 'vs' : '@'
    await expect(
      adminPage
        .getByText(
          new RegExp(
            `${escapeRegex(flippedPrefix)}\\s+${escapeRegex(candidate!.owningTeamName)}`,
          ),
        )
        .first(),
      `opponent-school view should render "${flippedPrefix} ${candidate!.owningTeamName}"`,
    ).toBeVisible({ timeout: 15_000 })

    // Sanity: the original prefix+opponentTeam text must NOT be visible once
    // we're on the opponent viewpoint — otherwise the viewpoint didn't flip.
    await expect(
      adminPage.getByText(
        new RegExp(
          `${escapeRegex(owningPrefix)}\\s+${escapeRegex(candidate!.opponentTeamName)}`,
        ),
      ),
      'owning-view row should disappear after flipping to the opponent school',
    ).toHaveCount(0, { timeout: 5_000 })
  })
})

// ── Utilities ──────────────────────────────────────────────────────────────

/** Escape a string so it can be embedded in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
