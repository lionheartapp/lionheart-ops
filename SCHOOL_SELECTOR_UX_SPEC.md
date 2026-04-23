# Global School Selector — UX Spec

**Status:** Draft for review
**Date:** 2026-04-20
**Verified against:** current codebase (not memory, not the handoff)

---

## TL;DR

Put a single selector at the top of the navigation that says either **"All Schools"** or the name of one specific school. Everything below it obeys the selection. Replace today's two inconsistent patterns (Athletics sidebar buttons, Maintenance page-header chip) with this one thing.

For users who only belong to one school, the selector stays out of the way — it just shows the school name as a label, not a picker.

---

## What exists today (verified in code)

- **No selector in the main nav** (`DashboardLayout`, top header). The main nav has no school or campus picker.
- **Athletics sidebar panel** (`AthleticsPanel.tsx`): renders campus buttons in the sidebar, only if the user has access to more than one. State is local `useState`, no persistence, synced via custom DOM events.
- **Maintenance header chip** (`CampusFilterChip.tsx`): a dropdown in the maintenance page header. State lives in a `useCampusFilter` hook with localStorage under the key `facilities-campus-filter`. "All Campuses" is the empty string.
- **Role-based default** (`user-school-scope` in localStorage): members and viewers are auto-scoped to one campus; admins default to "All."
- **No `activeSchoolId`** anywhere. Only campus.
- **No UI anywhere** lets a user switch which School they're looking at — only Campus.

So we're not refactoring a mature pattern. We're consolidating two half-built ones and adding the School dimension.

---

## The core idea

One selector. Top of the nav. Always visible. Controls what gets shown everywhere below it unless a screen explicitly opts out (see Athletics exceptions below).

```
┌──────────────────────────────────────────────────────────────────┐
│ Lionheart  [ 🏫 All Schools    ▾ ]    Michael ▾   ⚙  🔔         │
├──────────────────────────────────────────────────────────────────┤
│ Dashboard                                                         │
│ Tickets                                                           │
│ ...                                                               │
```

The selector lives in the top bar next to the logo. Clicking it opens a dropdown:

```
┌────────────────────────────────┐
│ 🏫 All Schools            ▾   │
├────────────────────────────────┤
│ ● All Schools                  │
│   See data across every school │
├────────────────────────────────┤
│   Renaissance                  │
│   Temecula Campus              │
│                                │
│   i-Shine                      │
│   Temecula Campus              │
│                                │
│   Da Vinci                     │
│   Temecula Campus              │
│                                │
│   Springs Charter Valley       │
│   Valley Campus                │
│   ...                          │
├────────────────────────────────┤
│   Manage schools →             │
└────────────────────────────────┘
```

Each row shows the School name (primary) and the Campus name (secondary, smaller). This is because multiple schools can share a campus — Renaissance, i-Shine, and Da Vinci all live at Temecula. Showing the campus helps users disambiguate.

---

## States and edge cases

### 1. User has access to exactly one school

Don't show a picker. Show the school name as a static label, or hide it entirely.

```
┌──────────────────────────────────────────────┐
│ Lionheart    Renaissance          Michael ▾  │
```

No dropdown, no "All" option. Everything is already scoped to their one school.

### 2. User has access to 2+ schools

Show the picker with all accessible schools and an "All Schools" option at the top.

### 3. User has access to 2+ schools but no cross-school permissions

Show the picker, but hide "All Schools." They can switch between individual schools, not see aggregate data.

### 4. User just signed up / only has the default school

Same as case 1 — static label, no picker.

### 5. User is a super-admin / platform admin

"All Schools" is the default. Every school they have access to is listed. They can switch freely.

### 6. Empty state (org has no schools yet)

Selector doesn't render. User gets routed through onboarding to create their first school first.

---

## Default behavior

- **On first load after login:** default to the user's last selection (localStorage). Fall back to the role-based default (`user-school-scope` logic that already exists for campuses). Fall back to "All Schools" for admins, or the user's single accessible school for everyone else.
- **Persistence:** localStorage, per-user, per-device. Key: `active-school-id`. Value: school UUID or the literal string `"all"`.
- **On school switch:** every page refreshes its data (TanStack Query invalidation). The URL does not include the school ID — keeping it URL-free means shareable links show whoever opens them *their* selected school, which is the right behavior for a school admin who shares a link with a colleague.
- **On logout:** clear `active-school-id`.

---

## What the selector controls (page by page)

Default rule: **every list/dashboard filters by the selected school.** Detail pages (e.g. `/tickets/abc123`) don't filter — once you're looking at a specific record, scope doesn't matter.

### Filters automatically

- Dashboard: tile counts, charts, recent activity
- Tickets list (general, maintenance, IT)
- Events list, calendar
- Assets, devices
- Inventory
- Rosters, students
- Reports / analytics
- Staff / users list (shows only users assigned to the selected school)

### Detail pages (no filter)

- `/tickets/[id]`, `/events/[id]`, `/assets/[id]`, etc.
- Settings pages that are org-level (billing, integrations, API keys)

### Special: Settings → Schools

This page is *for managing schools themselves*, so it always shows all schools regardless of the selector. The selector is visually disabled or grayed here with a tooltip.

### Special: Athletics

This is the tricky one — details below.

---

## Athletics behavior

Athletics is where the global selector gets interesting because of the multi-school opponent case. Today athletics is single-school (one team per school, opponent is a free-text name). The future direction has Renaissance and Da Vinci potentially playing each other inside the same org.

### Rule for athletics

**The selected school is the *viewpoint*, not a hard filter.** You see athletics from the selected school's perspective.

- **Teams tab:** shows teams that belong to the selected school. "All Schools" shows every team, grouped by school.
- **Schedule tab:** shows games and practices involving the selected school's teams. When a game involves two in-org schools (Renaissance vs Da Vinci), it appears in both schools' schedules, labeled "vs Da Vinci" or "vs Renaissance" depending on viewpoint.
- **Standings:** scoped to the selected school's leagues. "All Schools" shows a district-wide standings view.
- **Roster:** scoped to teams that belong to the selected school.
- **Tournaments:** a tournament can span multiple schools. Show the tournament if any of the selected school's teams are in it; a tournament-detail page always shows all brackets regardless of selector (you're already "zoomed in" to that tournament).

### Dual-school game model (forward-looking)

To make Renaissance-vs-Da Vinci work cleanly:

- Add an optional `opponentAthleticTeamId` FK on Game, alongside the existing `opponentName` text field. If the opponent is an in-org team, the FK is set; if it's an external school, only the text is set.
- When a game is created with an in-org opponent, optionally auto-create a mirrored Game from the other team's perspective (or, better, treat Game as a single record that both schools can view via the team IDs involved).

This is a schema change and belongs in the migration plan, not this UX spec. But the selector should be designed to accommodate it.

---

## Interaction with the hierarchy migration

If we go with Option A (add District, keep Campus/School where they are):

- The selector lists **Schools**, not Districts or Campuses.
- When an org has multiple Districts, we add a second row of secondary text: **School name / Campus / District**.
- We don't ship a District-level selector unless a real customer needs cross-district aggregation. Most won't.
- Under the hood, "All Schools" sends no school filter to the API; specific school sends `schoolId`.

If the Athletics dual-school model ships, the API filter becomes `school involves this school` (for athletics) and `school owns this` (for everything else). One selector, two slightly different query semantics per domain — fine as long as it's well-tested.

---

## Rollout (how to get from today's mess to this)

This can ship in four small steps, none of which breaks existing users.

### Step 1 — Add the selector, no consumers yet

- Build the selector component. Wire it to a new `useActiveSchool` hook backed by localStorage `active-school-id`.
- Render it in `DashboardLayout` next to the logo. On orgs with zero or one school, it hides itself.
- Doesn't filter anything yet. Safe to ship.

### Step 2 — Wire one page at a time

Start with the dashboard (lowest blast radius). Verify "All" and "specific school" both return the right counts. Then tickets. Then events. Then athletics. Then maintenance (retire the existing chip once parity is confirmed).

Retire the sidebar athletics buttons in the same PR that migrates athletics to the global selector.

### Step 3 — Unify the storage pattern

Once every consumer reads from `useActiveSchool`, delete `useCampusFilter` and the athletics DOM-event plumbing. Both patterns were working around the missing global primitive.

### Step 4 — Handle the edge cases

Single-school users, permission-filtered school list, per-device persistence, the "Manage schools →" jump at the bottom of the dropdown.

---

## Open questions

1. **School vs Campus labeling.** Today's schema calls the site "Campus" and the organizational unit "School." Most K-12 admins use "School" to mean the thing with a name ("Da Vinci"). Is the selector a *School* selector in user-facing terms? I've assumed yes. If you'd rather call it "Campus" for consistency with PowerSchool-style apps, we'd relabel — but I think School is right because that's the unit that has teams, events, calendars, and principals. Campus is where things physically happen.

2. **Districts in the selector?** If a super-admin has 30 schools across 5 districts, do we let them pick "All schools in District X" as a shortcut? I'd defer this until a customer asks. Search-in-dropdown handles the long-list case fine.

3. **Mobile.** On narrow widths, does the selector collapse to an icon that expands to a full-screen sheet? Or stay inline and truncate? I'd suggest the sheet — better for thumb reach and for long school names.

4. **Athletics mirrored games.** When a game between two in-org schools is created, do we auto-create the mirror, or is it one shared Game record? One record is cleaner but requires the schema change mentioned above. Decide in the athletics-hierarchy follow-up spec.

5. **URL state.** Keep the selector out of the URL (my recommendation) or put it in a query param `?school=abc` so links share with recipient context? The tradeoff is: query-param links surprise recipients with someone else's scope; localStorage-only means users can't easily share a pre-scoped link. I lean localStorage-only.

---

## Why this is a good idea (the case for)

- Users stop having to remember *where* to filter on each page. One selector, one mental model.
- Replaces two half-built patterns with one well-designed one. Net reduction in code.
- Matches the dominant K-12 admin UX (PowerSchool's school selector at the top is the reference point). Admins coming from other tools will recognize it immediately.
- Plays nicely with the hierarchy migration — whichever option we pick, the selector still makes sense.
- Makes athletics' cross-school story a lot clearer: the viewpoint switch is explicit and visible.

## Why to think twice

- Users who work across many schools simultaneously (rare, but real — district IT) will do a lot of switching. "All Schools" mode helps but isn't a silver bullet. Need to make sure pages perform well under "All."
- The selector becomes a coordination point — if it breaks, everything downstream breaks. Extra test coverage warranted.
- Migrating existing users' mental model: today they pick campus on some pages and not others. After launch, the pattern is consistent — but transition needs a short in-app explainer the first time.
