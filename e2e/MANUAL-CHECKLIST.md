# Pre-Release Manual Checklist

Run this list with a real browser before every meaningful release. The automated tests catch regressions in the things they know about; this list catches the things humans see and bots don't (animation glitches, unclear copy, weird empty states, scroll bugs).

**Time budget:** ~30 minutes if nothing's broken. Stretch to 90 if it is.

**Where to run:** staging first (`E2E_BASE_URL`), then production smoke after deploy.

**How to use:** print or copy this into a checklist tool. Tick each box. Note anything weird in a doc; do not file individual tickets until you've finished the sweep — patterns matter.

---

## 0. Pre-flight

- [ ] CI is green on the branch you're about to ship
- [ ] `npm run inventory:routes` and `npm run inventory:pages` ran without errors
- [ ] `npm run test:e2e:matrix` passed against staging
- [ ] Last 24h of Sentry shows no new error spikes
- [ ] Database migrations are committed AND applied to staging

---

## 1. Auth flows

- [ ] `/login` — happy path with valid creds works
- [ ] `/login` — wrong password shows a clear, non-leaky error (not "user not found")
- [ ] `/login` — empty fields show validation, not a 500
- [ ] `/signup` — full org-creation flow lands you logged in as super-admin
- [ ] Welcome email arrives within 60s
- [ ] `/set-password` — token from email lands on the page, password form submits, login works after
- [ ] Logout — clears session and redirects to `/login`
- [ ] Loading the app while logged out (any deep link) → redirects to `/login` then back after sign-in

---

## 2. Dashboard + navigation

- [ ] `/dashboard` loads with no JS errors
- [ ] Sidebar has every section you expect for your role
- [ ] Click every sidebar item — page changes, breadcrumb updates, no white flash
- [ ] Open every sub-tab inside settings (members, roles, teams, campus, schools, school info, billing) — each renders its own UI, none silently fall back to a default tab
- [ ] Avatar menu (top-right) opens, has Profile, Logout
- [ ] Notifications bell — opens, marks read works, scrolls
- [ ] Search bar — types, returns results, clicking a result navigates

---

## 3. Tickets (IT, A/V, Maintenance)

- [ ] List page loads with skeleton, then shows real data (not "Select a team to start")
- [ ] Filter by status → URL updates, count updates, list updates
- [ ] Filter by school/campus → list filters
- [ ] "New ticket" — modal/drawer opens
- [ ] Create ticket with valid data → row appears in list, no page reload needed
- [ ] Create ticket with empty title → inline error, no submit
- [ ] Open a ticket → detail drawer shows all fields, comments load
- [ ] Add a comment → appears immediately
- [ ] Upload an attachment → upload progress, file appears, opens
- [ ] Assign ticket → assignee updates, refresh confirms
- [ ] Close ticket → status pills update, list reflects
- [ ] Try to delete as a member account → 403 / hidden
- [ ] Edit URL to another org's ticket UUID → 403 / 404 (NEVER show data)

---

## 4. Events

- [ ] `/events` calendar loads
- [ ] Switch month/week/day views — no broken layout
- [ ] Drag an event (if drag enabled) → optimistic update, persists
- [ ] Create event with AI helper → completes, fills form sensibly
- [ ] Approve a draft event → moves to published
- [ ] Reject with a comment → reason saved, requester sees it
- [ ] Public event page (`/events/public/[orgSlug]/[eventSlug]`) renders unauthenticated
- [ ] Registration form on public page works end-to-end (test mode if Stripe)
- [ ] QR code on confirmation page is scannable and lands on the right page

---

## 5. Settings

### Members tab
- [ ] List loads, shows everyone
- [ ] Search by name filters
- [ ] Invite a new user → email sent (check inbox)
- [ ] Change a user's role → permission changes reflected next page load
- [ ] Soft-delete a user → disappears from list, can be recovered (super-admin only)

### Roles tab
- [ ] List shows the 4 default roles + any custom
- [ ] Click a role → permission matrix renders
- [ ] Toggle a permission → save persists across reload
- [ ] Try to delete a system role → blocked with a clear message

### Teams tab
- [ ] List loads
- [ ] Create team → appears
- [ ] Add user to team → user shows in team detail
- [ ] Rename team → no broken references in UserTeam links

### Campus / Schools / School Info
- [ ] Buildings list loads, can add a building
- [ ] Areas inside a building work
- [ ] Rooms inside an area work
- [ ] School info (principal, grade range) saves cleanly

### Billing
- [ ] Plan page loads
- [ ] Stripe portal link opens (test mode is fine)
- [ ] After trial expiry, mutating endpoints return TRIAL_EXPIRED — read-only banner appears

---

## 6. Multi-tenant safety

- [ ] Log in as a member of Org A
- [ ] Open DevTools → Network tab
- [ ] Find a request that hits `/api/tickets` or similar
- [ ] Manually replay it with `x-org-id` set to a known Org B UUID
- [ ] **MUST get 401/403/404. NEVER Org B data.**
- [ ] Repeat for events, inventory, settings/users
- [ ] If anything leaks: STOP. File a SEV1.

---

## 7. Permissions spot-check

- [ ] Log in as `member` role
- [ ] Try Settings → Members → Invite (should be hidden or 403)
- [ ] Try Settings → Roles → Create (should be hidden or 403)
- [ ] Try `/admin/billing` URL directly (should redirect or 403)
- [ ] Log in as `viewer` role
- [ ] Confirm all "Add" / "New" / "Edit" buttons are absent or disabled
- [ ] Confirm read-only banners or tooltips explain why

---

## 8. Empty + error states

For each major list page (tickets, events, inventory, members, schools):

- [ ] Empty state (zero rows) — shows a useful illustration, primary CTA, NOT "Select a team"
- [ ] Loading state — skeleton matches final layout (no jump on data arrival)
- [ ] Server error (you can simulate by killing the network or a 500 endpoint) — shows retry, doesn't blank the page
- [ ] 404 — random URL like `/dashboard/foo/bar` shows a friendly 404, not a stack trace

---

## 9. Mobile spot-check

Run on a real phone or DevTools mobile mode (375px wide).

- [ ] Login fits, no horizontal scroll
- [ ] Sidebar collapses into a hamburger
- [ ] Dashboard cards stack
- [ ] Ticket list is readable, can tap a row
- [ ] New ticket modal fits
- [ ] Forms don't have inputs hidden by the keyboard
- [ ] No element is clipped by safe-area insets (iOS notch)

---

## 10. Performance smell test

- [ ] Hard refresh on `/dashboard` — first paint within 2 seconds on broadband
- [ ] No console errors in DevTools
- [ ] No console warnings about hydration mismatches
- [ ] Network tab — no requests larger than 1MB except images
- [ ] No more than 2 sequential database round-trips on a single page load (rough proxy: total network duration < 1.5s after first paint)

---

## 11. Dark areas

These are the things automated tests almost never catch. Spend 5 minutes here.

- [ ] Open every drawer / modal you can find. Close it. Open it again. Does state reset?
- [ ] Press Escape on every drawer / modal — does it close?
- [ ] Tab through any form with the keyboard only — focus order makes sense
- [ ] Use a screen reader (VoiceOver on Mac: Cmd+F5) on /dashboard — primary actions announce sensibly
- [ ] Refresh on a deep route (e.g. `/settings/teams/some-id`) — does it survive refresh?
- [ ] Click the browser back button after creating a row — list still up-to-date?
- [ ] Resize the window from 1440px to 320px slowly — does the layout break at any width?

---

## 12. After release

- [ ] Watch Sentry for 30 minutes after deploy
- [ ] Spot-check production (the real domain, not staging) on the top 5 pages
- [ ] If anything from this list is broken, file a single "release smoke fails" issue with the list of items, not 12 separate tickets
- [ ] Note any "this checklist missed X" in a follow-up so we can add X next time

---

**Owner:** the engineer shipping the release.
**Cadence:** every release.
**Last updated:** auto-generated; edit as the app grows.
