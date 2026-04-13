# Events Area — UX Audit

**Date:** 2026-04-10
**Scope:** Every route under `/events`, plus siblings `/calendar` and `/planning`, plus the create-event drawers/modals, and the public registration portal.
**Screenshots:** `audit/01-*.png` through `audit/24-*.png`

---

## TL;DR — The One Big Finding

**The warm editorial reskin stopped at `/events`.** Every other page in the events area — `/events/[id]`, `/calendar`, `/planning`, `/events/new/ai`, the create wizard, the day-of dashboard — is still on the **pre-reskin palette**: slate/indigo/emerald, bright bg-blue-50 accent tiles, green `Approve` buttons, `bg-slate-900 → bg-slate-800` hover. The visual improvement we just shipped is an island. A user clicking into any event immediately leaves the reskin.

**Fix this first.** Before any of the improvements below, the warm palette remap needs to extend to `EventDashboard.tsx`, `EventProjectTabs.tsx`, `EventOverviewTab.tsx`, `CalendarView.tsx`, `CreateEventProjectModal.tsx`, `EventSeriesDrawer.tsx`, `TemplateListDrawer.tsx`, `AIEventWizard.tsx`, and the planning page. Otherwise the reskin feels accidental.

---

## Severity legend

- **🔴 P0 — Broken / misleading / safety**
- **🟠 P1 — Major UX friction**
- **🟡 P2 — Polish / consistency**

---

## 1. `/events` — Events Hub (the one page with the reskin)

See `audit/01-event-detail.png` is the detail, but the hub itself is already covered in the session screenshots. Findings from observing the hub in context:

### 🔴 P0 — Filter empty state is wrong
**Screenshot:** `24-filter-empty-bug.png`

Clicking `Confirmed` with no confirmed events shows:

> "No events yet — Create your first event to start planning"

…even though there are 3 events (just none confirmed). The empty state is unaware of the filter and lies to the user. **Fix:** distinguish two empty states — "zero events in org" (show CTA) vs. "zero events match filter" (show "No confirmed events. Try a different filter.").

### 🔴 P0 — Approval queue: the heading is backwards
Every Event Approval card uses **"Event Awaiting Approval"** as the h3, with the actual event name demoted to a tiny warm chip below. That inverts the information hierarchy. The event name should be the heading, and "Awaiting approval" is a status badge. Also every card's description repeats the same sentence ("'X' has been submitted and is waiting for admin approval") which is zero-signal boilerplate.

**Fix:** heading = event name. Description = who submitted, when, which gates are outstanding (e.g. `Submitted 2 days ago by Jordan · 2 of 3 gates remain`).

### 🔴 P0 — "Approve" is a one-click commitment from a list
Single pill, no drawer, no confirmation, no ability to read request context or see what's being approved. This is the classic way you get accidental approvals, especially in a list of visually identical cards.

**Fix:** primary action on the approval card should be **View** (opens a drawer with gate status, request reason, attachments). **Approve / Reject** live inside the drawer. Or at minimum, a confirm step.

### 🟠 P1 — Stat cards are decorative, not informative
`3` + `ACTIVE EVENTS` on a 200×90 slab is mostly whitespace. A bare integer alone tells an admin nothing actionable.

**Fix:** either shrink to a one-liner in the header (`Events Hub · 3 active · 3 awaiting approval`), or earn the space with a delta (`+2 this week`), a breakdown (`2 this week · 1 next week`), or a mini sparkline. Right now they're chartjunk with no chart.

### 🟠 P1 — Source + Status chips are redundant noise
Every event card shows `Direct Request` + `Pending Approval`. If every card has the same two chips, the chips are signal-free and just eat density.

**Fix:** only show chips that **diverge from the default** (e.g. show `Series` only for series-sourced events, hide `Direct Request` as it's the default). Show the status color in the vertical bar; drop the status chip unless it deviates from what the bar shows.

### 🟠 P1 — Date is duplicated; time is missing
Left side has `SUN 12` chip, right side says `Apr 12, 2026`. Drop the long date (month is already implied) and show the **time range** (`2:00 PM – 3:30 PM`). We're hiding useful data to display duplicated data.

### 🟠 P1 — Filter chips wrap awkwardly
`Completed` drops alone to row 2. Visually broken at this viewport width.

**Fix:** use `flex-wrap: nowrap` with horizontal scroll, or collapse less-used filters (`Completed`, `Cancelled`) behind a `More` menu. Also the filter chips currently use the same dark pill style as the `+ Event` primary CTA — filters should be visually subordinate (outlined/ghost).

### 🟠 P1 — Two-column 50/50 is structurally wrong
Admin view gives equal real estate to `All Events` and `Event Approvals`, but approvals are almost always a smaller subset of total events. On a busy day the left column scrolls for ages and the right sits half-empty.

**Fix:** 60/40 split, or make approvals a collapsible right rail that hides when empty.

### 🟡 P2 — Gate indicator (`+ Admin`) dangling under "By Admin User"
Standalone orange chip with no context. Reads like a tag or typo. Should sit with other status chips or have a label ("1 of 3 gates pending").

### 🟡 P2 — Section headers have no counts
`All Events` and `Event Approvals` both lack a count suffix. Admins want to see scale at a glance. `All Events · 3` / `Event Approvals · 3`.

### 🟡 P2 — `AI Ranked` badge floats with no anchor
The small green `AI Ranked` badge in the top-right of Event Approvals reads like a free-floating label. It needs stronger visual association with the panel, or move it as a subtitle ("Ranked by AI · 3 items").

### 🟡 P2 — "Manage all your school events from planning to completion"
Generic header subtitle. Could be more useful as live status: "3 events need your attention" or "Next approval due in 2 days".

---

## 2. `/events/[id]` — Event detail (9 tabs)

Screenshots: `01-event-detail.png` (Overview), `02-event-schedule.png`, `03-event-team.png`, `04-event-registration.png`, `05-event-documents.png`, `06-event-logistics.png`, `07-event-budget.png`, `08-event-tasks.png`, `09-event-comms.png`

### 🔴 P0 — Entire detail page is un-reskinned
All 9 tabs are still on the slate + green palette. The `Approve` button in every top-right is `bg-green-600` text-white, the sidebar accent is indigo, the "Event Details" card uses old rounded style. The minute a user clicks into an event, the warm aesthetic vanishes.

### 🔴 P0 — "Approve" is persistent in every top-right corner of every tab
The same bright green `Approve` button appears in Overview, Schedule, Team, Registration, Documents, Logistics, Budget, Tasks, Comms — 9 places. It's one click from catastrophe no matter where you are. A user scrolling in Budget could accidentally hit Approve and commit without ever reading the request.

**Fix:** confine the approve action to a confirmation flow, or at least to the Overview tab's approval gates card. Don't plaster it globally.

### 🟠 P1 — Left sidebar has 3 navigation systems stacked
1. Main sidebar (Dashboard / Events / Athletics…)
2. Events sub-nav column (Events Hub / Calendar / Planning / Create with Leo)
3. Event-detail left panel with tabs (Overview / Schedule / Team / Registration / Documents / Logistics / Budget / Tasks / Comms)
4. **Plus** the top-right `← Back to Events` link.

Four navigation affordances competing for attention. The user's mental model breaks down. The mid-column events sub-nav is useless on the detail page because all events-related links point away from the event you're on. **Fix:** collapse/hide the mid-column sub-nav once you're inside an event detail.

### 🟠 P1 — The tab label "Team" routes to `?tab=people`
Clicking `Team` updates the URL to `tab=people`. Confusing mismatch between label and state. Pick one.

### 🟠 P1 — Overview "Event Status" progress bar is confusingly active
The horizontal status bar shows Draft → Pending Approval → Confirmed → In Progress → Completed with `Pending Approval` highlighted. But the event badge in the sidebar says **Pending** (different word), and the banner at top says **Awaiting approvals**. Three different labels for the same state on the same screen.

**Fix:** unify the terminology. Pick `Pending Approval` and use it everywhere.

### 🟠 P1 — AI Status Summary card just shows "0% — internal server error"
The AI card on Overview shows an error state as default content. For a user who has no AI key configured, this is permanent negative feedback on every event page load. **Fix:** hide the card entirely when AI isn't configured, or show a neutral "AI insights unavailable" without the scary error verbiage.

### 🟠 P1 — Stats row on Overview (Tasks 0/0, Blocks 0, Attendance —, Event Date "1 day away")
Same `decorative stat card` problem as the hub. Four cards that carry almost no information for a freshly-created event. Could collapse into one meta strip.

### 🟠 P1 — Schedule tab empty state is weaker than it should be
"No schedule items yet — Build your event schedule by adding sessions, activities, meals, and more." Good copy but the `AI Generate` button right above it doesn't get called out in the empty state even though AI is probably the fastest path to a populated schedule. Move `AI Generate` into the empty state as the primary CTA.

### 🟠 P1 — Registration empty state offers two unranked actions
`Set Up Registration` (dark) and `Generate with AI` (outlined). Both look clickable, neither is clearly primary. The user has to read both to decide. Pick a single recommended path.

### 🟠 P1 — Logistics is visually dense but offers no onboarding
The Logistics tab lands you on a 6-sub-tab interface (Buses / Cabins / Small Groups / Activities / Dietary/Medical / Print) with "Check Conflicts" and "AI Suggest Assignments" and participant-drag-and-drop panes, all immediately visible. Brand-new users are going to bounce. **Fix:** add an intro empty state explaining what Logistics does, hide sub-tabs that are irrelevant for the event type, and make `AI Suggest Assignments` more prominent as the path of least resistance.

### 🟠 P1 — Budget tab lists 5 empty categories with 5 identical "Add Expense" buttons
Venue / Transportation / Food & Catering / Supplies & Materials / Insurance — each with `$0.00 budgeted / $0.00 actual / + Add Expense`. This is 5 rows of identical emptiness. **Fix:** collapse all empty categories into a single "Add your first expense" empty state. Only expand the category rows once expenses exist.

### 🟠 P1 — Comms tab: three stats (0/0/0) then a dense composer form
Empty-stat triplet (Announcements sent / Active surveys / Notification rules) that teaches nothing, then an immediately-visible announcement composer with subject/message/audience. **Fix:** hide the composer behind an `Announce` button. The triplet should collapse to a meta line.

### 🟡 P2 — Sidebar tab `Tasks` appears twice (Tasks tab AND Tasks sub-item)
Actually looking again, it's one `Tasks` in the main nav. OK, false alarm — but worth double-checking nothing is double-nested.

### 🟡 P2 — "Recent Activity" card at bottom of Overview shows a single entry
"Admin User created this event · about 1 hour ago". Single-entry activity cards are weak. Either show richer context (who else has looked at it, what gates auto-ran, etc.) or don't show the card until there's more than one entry.

---

## 3. Create Event drawer (3-step wizard)

Screenshots: `11-create-modal-step1.png`, `12-create-modal-step2.png`, `13-create-modal-step2-location.png`, `14-create-modal-step3-people.png`, `15-create-modal-off-campus.png`

### 🔴 P0 — Validation error persists after fixing the underlying problem
**Screenshot:** `15-create-modal-off-campus.png`

In Step 2 (Location), toggling `Off Campus` changes the input from "Select a building..." to "Search for a venue or address..." — but the error message `Please select a building` **remains visible**. The error doesn't clear when the user switches modes. This makes the user think they've done something wrong even though the field is now valid.

### 🔴 P0 — Step navigation is locked
You can't click back to Step 1 from Step 2 via the numbered stepper ("1 Details", "2 Location", "3 Team & People"). The buttons render as `[disabled]`. You have to use the `← Back` button at the bottom. Stepper numbers should be clickable to jump between completed steps.

### 🟠 P1 — "Team & People" step forces Expected Attendance as required
Every event — even staff meetings — has to guess an attendee count to proceed. Make optional for events that aren't ticketed.

### 🟠 P1 — Drawer UX is inconsistent with reskin (slate, not warm)
Input borders are `border-gray-300` / `border-red-300`. Focus ring is `border-indigo-400`. These don't match the warm editorial palette from `/events`.

### 🟡 P2 — Step labels overflow into the chevron separators at narrower widths
At 500px drawer width, "Team & People" can break under the chevron. Pad or shorten to "People".

### 🟡 P2 — No keyboard shortcut mentioned
No `Enter` to submit, no `Esc` to close documented. Modals should advertise both.

---

## 4. Recurring Event drawer

Screenshot: `16-series-drawer.png`

### 🟠 P1 — Day-of-week selector uses `M T W Th F Sat Sun` chips, but only one is togglable?
At a glance the chips look like a single-select filter, not a multi-day-per-week recurrence picker. Needs clearer visual that multiple can be selected (a check mark inside, or "1 day selected" helper).

### 🟠 P1 — End condition buttons `After N occurrences` / `Until date` are radio-styled but look like tabs
Confusing UI — is this a toggle or a tab? Use native radios with labels or make them look like distinct pills.

### 🟡 P2 — No preview of generated dates
Before clicking `Create Series`, the user cannot see what dates will actually be generated. For "weekly on Monday starting May 11 for 10 occurrences" they should see a preview: `May 11, May 18, May 25, Jun 1…`. High-trust feature.

### 🟡 P2 — `Requirements` at the bottom shows only `A/V Production` toggle
Why is this the only default requirement? What are requirements for? Needs a tooltip or a label like "Flag which teams need to approve each instance". Otherwise it looks orphaned.

---

## 5. Template drawer

Screenshot: `17-template-drawer.png`

### 🟠 P1 — Empty state says "Save any event as a template from the Overview tab to get started"
…but I just walked through the entire Overview tab and I don't see a `Save as Template` action anywhere. Either it's hidden behind a menu (bad discoverability) or the copy is wrong. Audit needed.

### 🟡 P2 — `All Types` filter dropdown is useless when there are zero templates
Hide it until there's at least one template.

---

## 6. `/events/new/ai` — Create with Leo

Screenshot: `18-create-with-leo.png`

### 🟠 P1 — "Leo" is introduced nowhere
"Create with Leo" appears in sidebar and this page, but there's no onboarding for who Leo is, what he does, or why I should use him vs. the regular create flow. A new admin has no idea.

**Fix:** first-visit modal or a `ℹ What is Leo?` link next to the title. Or better: rename to `Create with AI` and drop the anthropomorphism.

### 🟠 P1 — Giant left pane is wasted real estate
The chat column takes ~50% of the viewport and shows a single intro message and an input at the bottom. Right pane is entirely empty with `Describe your event to Leo — Once you describe your event, Leo will fill in the details here. You can edit everything before creating.` → 50% of the screen is permanently empty until the user types. **Fix:** either collapse the right pane until there's content, or preview examples in it ("Try: 'Spring concert on May 15, 6pm, 200 guests'").

### 🟡 P2 — Chat input has no "suggested prompts"
Modern AI tools offer 3-4 example prompts as clickable chips to lower the blank-page anxiety. Nothing here.

---

## 7. `/calendar`

Screenshot: `19-calendar.png`

### 🔴 P0 — None of my just-created events show up
I created 3 events (Spring Assembly Preview, Fall Open House, Staff Planning Retreat) with dates in April 2026 and set `isMultiDay: false`. The calendar month view for April 2026 is **entirely empty**. The events exist in `/events` hub and `/events/[id]` detail, but don't render on the calendar.

Either:
- `PENDING_APPROVAL` events are filtered out of calendar (should still be shown with dimmer style, not hidden), OR
- The calendar query doesn't include `EventProject` records, OR
- A bug

Either way, users creating events from the hub will be confused when they don't appear on the calendar.

### 🔴 P0 — `Create` button on calendar is blue gradient, not warm black pill
Hard inconsistency with `/events` hub. Every page must use the same CTA style. **Fix:** use `EventCreateMenu` (the new one) on the calendar too.

### 🟠 P1 — `View` toggle has 4 options (Month / Week / Day / Agenda)
That's a lot. `Agenda` is redundant with `/events` hub which is already a list view. Consider dropping `Agenda` or marking it as redundant.

### 🟠 P1 — `Search events` + `Filters` + `Export CSV` + `Create` + `Today/Month/Week/Day/Agenda`
Calendar top bar has 9 controls at once. Budget them into two rows or a primary/secondary split.

### 🟡 P2 — Month view has no events but no empty state either
Just an empty grid. Could show a "No events in April — `+ Create event`" bubble in the middle.

---

## 8. `/planning`

Screenshot: `20-planning.png`

### 🔴 P0 — Page is blank
Title, subtitle, single `+ Create Planning Season` button in top right. No empty-state illustration, no explanation of what a "Planning Season" is, no examples. A new user has no idea what this page does.

**Fix:** add an empty state explaining the Planning concept. "Planning seasons are periods where teachers and staff can submit event proposals for the admin to review before they're published to the calendar. Create your first season below." + example seasons (Fall 2026, Spring 2027) as one-click presets.

### 🟠 P1 — The term "Planning Season" is unintroduced
Like "Leo", this is domain jargon the user has to learn. What's a season? How is it different from a school year? Needs a tooltip or docs link.

---

## 9. `/events/[id]/dayof`

Screenshot: `21-dayof.png`

### 🟠 P1 — Jumps straight into a QR scanner that requires camera permission
First-time users land here and see a big black rectangle saying `Point camera at participant QR code` with a permission prompt. No explanation of what happens after you scan, what the sub-tabs do, or how to use the Roster/Incidents/Headcount features.

**Fix:** default to `Roster` sub-tab (non-destructive, explains the context), and make `Check-in` the secondary affordance.

### 🟡 P2 — No preview of what a successful check-in looks like
Empty states don't show the happy-path. Useful for training new staff.

### 🟡 P2 — No way to test scanner without a real QR code
Admins setting this up for the first time would benefit from a "Test check-in" mode with a fake participant.

---

## 10. `/events/public/[orgSlug]/[eventSlug]`

Screenshot: `22-public-event.png`

### 🔴 P0 — Generic 500 error on an event that exists but isn't "published"
Navigating to `/events/public/demo/spring-assembly-preview` returned **"Something went wrong — An unexpected error occurred. Please try again or contact support if the problem persists."**

This is wrong for two reasons:
1. The event exists — the slug may not match (my guess), or the event isn't published. Either way, the response should be a **404 "Event not found"** or **"This event isn't public yet"**, not a generic 500.
2. Telling the user to "contact support" for a routing mistake is hostile. Public-facing pages are where this matters most.

**Fix:** proper 404 with helpful copy ("This event isn't published yet. If you're looking for your registration, visit the [Registration Portal]."). Generic 500s erode trust.

---

## 11. `/events/portal`

Screenshot: `23-portal.png`

### 🟠 P1 — Purpose unclear without context
"Access Your Registration — Enter the email address you used when registering…" is fine copy but the page is visually isolated (no org branding visible, no event context, no back-to-event link). If a parent lands here from a shared link, they don't know what event they're accessing registration for.

### 🟡 P2 — Card uses old rounded/blue gradient styling
Not aligned with warm reskin. Since this is a public-facing page, it should match the organization's branding, not Lionheart's.

---

## 12. Sibling / global consistency issues

### 🔴 P0 — Primary CTA style is inconsistent across events area
| Page | Primary CTA | Style |
|---|---|---|
| `/events` (hub) | `+ Event` (dropdown) | Warm near-black pill ✅ |
| `/events/[id]` (detail) | `Approve` | **Green** (`bg-green-600`) |
| `/calendar` | `+ Create` | **Blue gradient** |
| `/planning` | `+ Create Planning Season` | Warm near-black pill |
| Create drawer | `Continue` | Warm near-black pill ✅ |
| Leo page | (implicit "send message") | Blue |

Four different CTA styles inside the same product area. **Fix:** enforce `ui-btn-primary` (warm near-black pill) globally for primary actions. Status-specific actions (Approve/Reject) can use color but should be constrained to inside drawers, not persistent top-right buttons.

### 🔴 P0 — Sidebar has duplicate "EVENTS" header + "Events Hub" link
**Screenshot:** any of them.

The events subnav column has a caps `EVENTS` header at the top, and `Events Hub` as the first link. The caps header is redundant with the section — it's the column for events, obviously. Remove it.

### 🟠 P1 — Event status vocabulary drifts
We have:
- `Draft` / `Pending` / `Pending Approval` / `Awaiting Approval` / `Awaiting approvals` / `PENDING_APPROVAL`

All for the same state. Pick one (`Pending Approval`) and use it in every UI string, badge, URL param, and toast.

### 🟠 P1 — Search is absent from `/events` but present on `/calendar`
Inconsistent. Users looking for an event by name will search on the hub first and come up empty. Add search to `/events`.

### 🟠 P1 — No bulk actions on events
Can't select multiple events to delete, move, or re-assign status. Common admin task.

---

## 13. Information-architecture observations

### 🟠 P1 — Too much functionality crammed under `/events/[id]` with no hierarchy
9 tabs per event is a lot for a small event. A "school staff meeting" doesn't need Logistics, Budget, Documents, Registration, Comms, or Tasks. Consider:
- **Event templates dictate which tabs are visible** (a "meeting" template hides 5 tabs, a "trip" template shows all 9).
- Or **progressive disclosure**: show Overview + Schedule + Team by default, "Advanced" collapses Logistics/Budget/Documents/Tasks/Comms into a secondary row.

### 🟠 P1 — `Events Hub` vs `Calendar` vs `Planning` — what's the difference?
Three sibling nav items for what is fundamentally three views of the same data:
- **Events Hub** = list view
- **Calendar** = calendar view
- **Planning** = proposal-submission view (lifecycle stage before events)

This isn't obvious from the labels. Add short subtitles next to each nav link: "Events Hub — browse and manage events", "Calendar — month/week view", "Planning — proposal workflow".

---

## Priority fix order (recommended)

If I could only ship 10 things before launch, in order:

1. **Extend warm reskin to `/events/[id]`, `/calendar`, create drawers, and all detail tabs.** This is the biggest visual cliff in the product right now.
2. **Fix filter empty-state bug** (`24-filter-empty-bug.png`). Trivial but makes the hub look broken.
3. **Move `Approve` into a drawer.** The one-click-from-a-list approve is a production incident waiting to happen.
4. **Fix approval queue heading hierarchy.** Event name up, status badge down.
5. **Fix calendar → hub data sync.** Events created from the hub should appear on the calendar immediately, regardless of approval status (with a dimmer style for pending).
6. **Unify CTA styles.** One primary pill across the whole section.
7. **Fix step wizard back navigation.** Stepper numbers clickable, error messages clear on context change.
8. **Unify status vocabulary.** `Pending Approval` everywhere.
9. **Public event error handler.** Proper 404 instead of 500.
10. **Empty state on Planning.** Explain what the page does.

---

## Things NOT broken (for the record)

- Warm reskin on `/events` hub looks great
- Date chip + vertical accent bar pattern on EventCard is strong
- Create dropdown (warm, just lifted into the header) is consistent and tidy
- Event detail left-panel tab layout is clean even if the colors are off
- Day-of check-in flow has a clear visual intent even if the onboarding is missing
- Registration portal has good focused copy (just branding issues)

---

## Open questions for Michael

1. Is the warm reskin intentionally scoped to `/events` only, or was it supposed to cascade to the whole area?
2. Is `Create with Leo` a separate AI entry point, or should it replace the create wizard entirely?
3. What's the relationship between `Planning Seasons` and school years? Are they meant to map 1:1, or can there be multiple seasons per year?
4. Is the `Approve` button's current prominence intentional for a demo/sales context? If so, consider a "presentation mode" vs. "production mode" toggle.
5. Who is the primary user of `Day-of Dashboard` — admins running an event live, or event staff/volunteers? Onboarding should be tailored to them.
