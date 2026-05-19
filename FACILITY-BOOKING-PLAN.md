# Facility Booking System — Build Plan

> Athletic facility reservation with conflict detection, messaging integration, and calendar sync.
> Ship Phase 1 + 2 together so coaches never see a space picker without conflict awareness.

---

## What We're Building

When a coach schedules a game or practice, they pick a real facility (gym, field, court) instead of typing text. The system checks if that space is available, warns about conflicts, suggests alternatives, and lets the coach message whoever has the space booked — all inline, without leaving the booking flow.

Everything flows through CalendarEvent as the single source of truth for "is this space taken?"

---

## What Already Exists (Reuse List)

| Asset | Where | How We Use It |
|-------|-------|---------------|
| `LocationPicker` | `src/components/events/LocationPicker.tsx` | Drop into Game/Practice drawers for space selection |
| `checkLocationConflict()` | `src/lib/services/calendar-core.ts:214` | Extend for recurring events + space status checks |
| `findOrCreateDM()` | `src/lib/services/channelService.ts:596` | Open/continue DM from conflict card |
| Reference chips | `src/app/api/messaging/references/route.ts` | Extend to support booking references |
| `CalendarEvent` model | Prisma schema | Already has `spaceId`, `buildingId`, recurrence, buffer |
| `Space` model | Prisma schema | Already has `spaceType` enum (FIELD, COURT, GYM, etc.), multi-level scoping |
| Game → CalendarEvent bridge | `createGame()` in athletics service | Already creates CalendarEvent — just needs `spaceId`/`buildingId` |
| `eventBufferMinutes` | Organization model | Org-level default buffer (60 min) |
| Push notifications | `sendPushToUser()` | Will fire automatically on DM send |
| Mobile messaging | `MobileShell` + messaging routes | DMs already work on mobile |

---

## Schema Changes

### 1. Space Model — Add Status + Capacity

```prisma
// Add to Space model
status        SpaceStatus  @default(ACTIVE)
capacity      Int?         // concurrent uses (null = unlimited / not tracked)

// New enum
enum SpaceStatus {
  ACTIVE
  UNDER_MAINTENANCE
  CLOSED
}
```

**Why capacity:** A gym with a divider curtain can host 2 practices. A large field might fit 2 teams on separate halves. `capacity` tracks how many concurrent bookings a space allows. `null` means "one at a time" (the default, safest assumption). Setting it to `2` means two overlapping bookings are OK before a conflict fires.

**Why status:** Maintenance needs to block a space without creating a fake event. When a maintenance ticket is created on a space with "block facility" checked, set status to `UNDER_MAINTENANCE`. The conflict checker treats this the same as "booked."

### 2. Game Model — Keep Lean

Game already has `calendarEventId` linking to CalendarEvent. We do NOT duplicate `spaceId`, `buildingId`, `roomId`, `setupMinutes`, or `teardownMinutes` on Game. All facility data lives on the linked CalendarEvent (single source of truth). The `venue` text field stays as a display fallback for games without a linked calendar event.

When the UI needs to show a game's facility, it joins through `calendarEventId` → `CalendarEvent.space` / `CalendarEvent.building`.

### 3. Practice Model — Keep Lean

Same approach as Game. Practice already has `calendarEventId`. We add nothing to the Practice model — facility data lives on the linked CalendarEvent. The `location` text field stays as a display fallback.

**New behavior:** Practices now auto-create a linked CalendarEvent on save (like games already do). This is what makes practices visible to the conflict system.

### 4. CalendarEvent Model — Add Per-Event Buffer + Exclusive Use

```prisma
// Add to CalendarEvent model
setupMinutes    Int?       // override org default buffer (before event)
teardownMinutes Int?       // override org default buffer (after event)
exclusiveUse    Boolean    @default(false)  // claims full capacity of space
```

CalendarEvent is the single source of truth for ALL facility booking data. It already has `spaceId`, `buildingId`, `locationText`. The bridge service (Game/Practice → CalendarEvent) writes facility selections here. Reads always come from here.

**Bridge sync rule:** When a Game or Practice is created or updated with facility info, the bridge ALWAYS syncs those values to the linked CalendarEvent. Edits to the CalendarEvent directly (via the calendar UI) sync back to the Game/Practice's text fields (`venue` / `location`) for display. One direction is canonical (CalendarEvent), the other is convenience.

### 5. MaintenanceTicket — Add Facility Blocking

```prisma
// Add to MaintenanceTicket model
blocksFacility  Boolean   @default(false)
```

When `blocksFacility` is true AND the ticket references a `spaceId`, the space status should be set to `UNDER_MAINTENANCE`. When the ticket is resolved/closed, only restore the space to `ACTIVE` if no other open `blocksFacility` tickets exist on that space. One query: `count where spaceId = X AND blocksFacility = true AND status NOT IN ('RESOLVED', 'CLOSED')`. If count > 0, stay `UNDER_MAINTENANCE`.

### 6. Message Model — Add Metadata for Booking Cards

```prisma
// Add to Message model
metadata      Json?       // structured data for rich cards (booking refs, etc.)
```

This stores booking reference data so the DM can render a card showing the conflicting event details.

### 7. Space Operating Hours

```prisma
// Add to Space model
openTime      String?      // "07:00" (HH:mm, 24hr) — null = no restriction
closeTime     String?      // "22:00"
```

No weekly schedule for v1 — just daily open/close. Bookings outside these hours are rejected with "Space is only available 7:00 AM – 10:00 PM." If both are null, the space is bookable 24/7.

### 8. Blackout Dates (Org-Level)

```prisma
model BlackoutDate {
  id             String   @id @default(cuid())
  organizationId String
  date           DateTime // the blocked date (date only, no time)
  reason         String?  // "Winter Break", "Teacher In-Service", etc.
  appliesToAll   Boolean  @default(true)   // true = all spaces blocked
  spaceId        String?  // if not appliesToAll, block specific space
  // Constraint: if appliesToAll = true then spaceId must be null.
  // Enforced via Zod refinement on the API (Postgres check constraints
  // don't work well with Prisma). Zod rule:
  //   .refine(d => !d.appliesToAll || !d.spaceId,
  //     "Cannot set a specific space when appliesToAll is true")
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  space          Space?       @relation(fields: [spaceId], references: [id], onDelete: SetNull)

  @@index([organizationId, date])
}
```

Admins create blackout dates (school holidays, in-service days). The availability checker rejects any booking that falls on a blackout date. Recurring bookings skip blackout dates automatically and flag them in the RecurringConflictSummary as "School closed — [reason]."

**Timezone handling:** `BlackoutDate.date` is stored as UTC midnight, but comparison must happen in org timezone. A 6 PM Christmas Eve booking is Dec 24 local but Dec 25 UTC — without normalization that would incorrectly match a Dec 25 blackout. Always convert the booking's startTime to org timezone before extracting the date for comparison.

### 9. Booking Override Audit Trail

```prisma
model BookingOverride {
  id                 String   @id @default(cuid())
  organizationId     String
  calendarEventId    String?  // the event that was booked despite conflict (nullable — audit survives event deletion)
  overriddenEventId  String?  // the event that was already there (nullable — same reason)
  overriddenByUserId String   // who performed the override
  reason             String   // required — why the override was needed
  createdAt          DateTime @default(now())

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  calendarEvent    CalendarEvent? @relation("OverrideSource", fields: [calendarEventId], references: [id], onDelete: SetNull)
  overriddenEvent  CalendarEvent? @relation("OverrideTarget", fields: [overriddenEventId], references: [id], onDelete: SetNull)
  overriddenBy     User           @relation(fields: [overriddenByUserId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([calendarEventId])
  @@index([overriddenEventId])
}
```

Every "Book anyway" override creates a row here. The `reason` field is **required** — admins must explain why they're overriding. This gives the audit trail real value and forces intentionality. The overridden event's owner is automatically notified with the reason included (see Override Notification Flow below).

### Migration Note

All new fields are optional with defaults. No data loss, no backfill needed. Existing games/practices keep working with text-only venue/location. The CalendarEvent bridge logic just starts populating `spaceId`/`buildingId` when available.

---

## Concurrency Safety (Race Condition Prevention)

The availability check happens client-side before save, but two coaches could both pass that check and save within the same second. The save endpoint must re-check inside the transaction.

**Pattern:**

```typescript
// In the game/practice create endpoint:
return await runWithOrgContext(orgId, async () => {
  // 1. Create the practice/game record
  const practice = await prisma.practice.create({ data: { ... } })

  // 2. Re-check availability RIGHT BEFORE creating the CalendarEvent
  if (spaceId) {
    const conflict = await checkLocationConflict({
      startTime, endTime, spaceId, buildingId
    })
    if (conflict.hasConflict && !overrideFlag) {
      // Roll back: delete the practice we just created
      await prisma.practice.delete({ where: { id: practice.id } })
      return NextResponse.json(
        fail('CONFLICT', 'Space was booked while you were editing', conflict),
        { status: 409 }
      )
    }
  }

  // 3. Create CalendarEvent (this is what actually "claims" the space)
  const calEvent = await prisma.calendarEvent.create({ data: { ... } })

  return NextResponse.json(ok({ practice, calendarEvent: calEvent }))
})
```

The CalendarEvent creation is the atomic "claim." Since Prisma runs inside a single connection within `runWithOrgContext`, and we check + create sequentially, the window for a race condition is minimal. The transactional re-check is the real protection — not a database constraint. A simple unique index on `(spaceId, startTime, endTime)` won't work because it only catches identical times, not overlaps (3:00–4:00 vs. 3:30–4:30). Postgres has `EXCLUDE` constraints with GiST indexes over `tstzrange` that can catch overlaps, but they don't account for capacity or buffers, so they'd only cover the simplest case. The re-check-before-write pattern is what we rely on.

**Client handling:** If the save returns 409 CONFLICT, the UI shows the ConflictCard with the new conflict info and asks the coach to choose again. This should be rare in practice.

**Soft-delete safety:** The org-scoped `prisma` client already filters `deletedAt: null` automatically on all reads. Cancelled/deleted events will NOT block new bookings. This is verified by the Prisma extension in `db/index.ts` — no additional filter needed in `checkLocationConflict()`.

---

## Timezone Handling

**Rule: Store UTC, render in org timezone.**

- All `startTime`/`endTime` values are stored as UTC `DateTime` in Postgres (Prisma default)
- CalendarEvent already has a `timezone` field (default `"America/Chicago"`) for display
- The org's `timezone` setting is the default for all new events
- UI renders times using the org timezone via `Intl.DateTimeFormat` or a date library
- If the org has campuses in different timezones (rare for K-12, but possible), the CalendarEvent's `timezone` field can differ per event
- Availability checks compare UTC values — timezone is only a display concern, never a logic concern

This is already how the system works for CalendarEvents. We just need to make sure the Game/Practice drawers pass UTC to the API and render in org timezone consistently.

---

## Validation Rules

All bookings enforce:

| Rule | Value | Rationale |
|------|-------|-----------|
| Min duration | 15 minutes | No one books a gym for 5 minutes |
| Max duration | 24 hours | Single booking, not a multi-day block |
| Max advance booking | 12 months | Prevent "squatting" years ahead |
| No past dates | startTime > now | Can't book yesterday |
| Event within operating hours | startTime/endTime within space openTime/closeTime | Respects building hours |
| Setup within operating hours | startTime − setupMinutes >= space openTime | Can't set up before the building opens |
| Not on blackout dates | date (in org timezone) not in BlackoutDate | Respects school closures |
| Setup + teardown sanity | setupMinutes <= 120, teardownMinutes <= 120 | 2 hours max buffer each side |
| Recurring max occurrences | 200 | Covers a full school year of daily practices (~180 days) with headroom |

Enforced server-side in Zod schemas. Client-side validation mirrors these for immediate feedback.

---

## API Changes

### New Endpoints

#### `GET /api/facilities/availability`

Check if a space is available for a given time range. Handles recurring bookings by expanding rrules.

```
Query params:
  spaceId: string (required)
  startTime: ISO string
  endTime: ISO string
  rrule?: string (RFC 5545 — expands and checks each occurrence)
  excludeEventId?: string (ignore self when editing)

Response:
{
  ok: true,
  data: {
    available: boolean,
    space: { id, name, status, capacity, currentBookings: number },
    conflicts: [{
      id: string,
      title: string,
      startTime: Date,
      endTime: Date,
      date: string,           // for recurring — which specific date conflicts
      bookedBy: { id, name, email, avatar },
      sourceModule: string,   // 'athletics', 'event-project', etc.
    }],
    alternatives: [{          // same spaceType, available in this window
      id: string,
      name: string,
      spaceType: string,
      building: { id, name },
    }]
  }
}
```

**Logic:**
1. Check `space.status` — if `UNDER_MAINTENANCE` or `CLOSED`, return unavailable immediately with reason
2. If `rrule` provided, expand occurrences within a reasonable window (season length or 6 months max)
3. For each occurrence (or single event), call `checkLocationConflict()` extended version
4. Count current overlapping bookings — compare against `space.capacity`
5. If conflicts found, query same-type spaces that ARE available as alternatives
6. Return the conflict list with booker info (for the "message them" flow)

#### `POST /api/facilities/check-bulk`

For season-level bulk booking. Takes an array of date/time slots and a spaceId, returns which ones conflict.

```
Body:
{
  spaceId: string,
  slots: [{ startTime, endTime }],   // expanded from rrule by client — max 200 slots (server-enforced)
  excludeEventId?: string
}

Response:
{
  ok: true,
  data: {
    results: [{
      startTime, endTime,
      available: boolean,
      conflict?: { title, bookedBy, ... }
    }]
  }
}
```

#### `GET /api/facilities/space-schedule`

Week/day view of a single space's bookings. Powers the "space availability view."

```
Query params:
  spaceId: string
  start: ISO date
  end: ISO date

Response:
{
  ok: true,
  data: {
    space: { id, name, status, capacity, spaceType },
    bookings: [{
      id, title, startTime, endTime,
      sourceModule, calendarStatus,
      bookedBy: { id, name, avatar }
    }]
  }
}
```

### Modified Endpoints

#### `POST /PUT /api/athletics/games`

- Accept new fields: `spaceId`, `buildingId`, `roomId`, `setupMinutes`, `teardownMinutes`
- When creating/updating, pass facility refs to the CalendarEvent bridge
- Bridge logic: set `calendarEvent.spaceId`, `calendarEvent.buildingId`, `calendarEvent.setupMinutes`, `calendarEvent.teardownMinutes`
- Keep `venue` field as fallback display text (auto-generate from space/building name if not provided)

#### `POST /PUT /api/athletics/practices`

- Accept same new fields as games
- **New behavior:** auto-create a CalendarEvent on practice creation (like games already do)
- For recurring practices: create one CalendarEvent with the `rrule` field set
- Bridge logic same as games

#### `POST /api/messaging/channels/[id]/messages`

- Accept optional `metadata` field in body
- When present, store it on the Message record
- Metadata schema for booking references:
```json
{
  "type": "booking-conflict",
  "booking": {
    "title": "Basketball Practice",
    "spaceName": "Main Gymnasium",
    "date": "2026-05-20",
    "startTime": "15:00",
    "endTime": "17:00",
    "calendarEventId": "clx...",
    "sourceModule": "athletics"
  }
}
```

#### `GET /api/messaging/references`

- Add `type=booking` option alongside existing `it`, `maintenance`, `event`
- Returns matching CalendarEvents with facility info for reference chip insertion

### Modified Services

#### `checkLocationConflict()` — Extend

Current: checks single time window against CalendarEvents.

Add:
1. **Space status check** — if `space.status !== 'ACTIVE'`, return conflict with reason "Space is under maintenance" or "Space is closed"
2. **Capacity awareness** — count overlapping bookings, only conflict if count >= capacity
3. **Per-event buffer** — use `setupMinutes`/`teardownMinutes` from the event if set, otherwise fall back to org `eventBufferMinutes`
4. **Booker info** — include `createdBy` user data in conflict response so the UI can show who to contact
5. **Cross-school awareness** — for district-level spaces, check ALL bookings regardless of which school's calendar they're on (already works since CalendarEvent is org-scoped, but verify)

#### `createGame()` / `updateGame()` — Athletics Service

- Pass `spaceId`, `buildingId`, `roomId` through to CalendarEvent bridge
- Auto-generate `locationText` from space/building name if venue text not provided
- Set `calendarEvent.setupMinutes` / `teardownMinutes`

#### `createPractice()` / `updatePractice()` — Athletics Service

- **New:** Create linked CalendarEvent (practices don't do this today)
- Same facility ref pass-through as games
- For recurring: set `calendarEvent.rrule` from practice rrule
- `sourceModule = 'athletics'`, `sourceId = practice.id`

#### Maintenance Ticket Service

When a ticket with `blocksFacility: true` is created/updated:
- Set `space.status = 'UNDER_MAINTENANCE'`
- When ticket is resolved/closed: set `space.status = 'ACTIVE'`

---

## UI Components

### 1. Facility Picker (Extend LocationPicker)

**File:** Reuse `src/components/events/LocationPicker.tsx` directly in GameDrawer and PracticeDrawer.

The LocationPicker already handles:
- Building selection grouped by campus/district/school
- Space selection (it calls them "unassigned spaces")
- Room selection within a building
- Off-campus venue via Google Places

**Modifications needed:**
- Add a `spaceTypeFilter` prop so athletics can filter to FIELD, COURT, GYM, POOL (hide classrooms, offices, etc.)
- Add visual indicator for space status (under maintenance badge, closed badge)
- Show capacity info on space items when available

### 2. Conflict Card Component

**File:** `src/components/athletics/ConflictCard.tsx`

Appears inline in the GameDrawer/PracticeDrawer when a conflict is detected after the user picks a space + time.

**Design (using established patterns):**

```
┌─────────────────────────────────────────────┐
│  ⚠️  Schedule Conflict                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  🏀 Basketball Practice             │    │
│  │  Main Gymnasium                     │    │
│  │  Tue, May 20 · 3:00 – 5:00 PM     │    │
│  │  Booked by: Coach Smith            │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐    │
│  │ 💬 Message    │  │ Try Another Space │    │
│  └──────────────┘  └───────────────────┘    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Or book anyway (override)             │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Styling:**
- Outer: `bg-amber-50 border border-amber-200 rounded-xl p-4` (warning tone)
- Inner booking card: `bg-white border border-amber-100 rounded-lg p-3`
- "Message" button: primary dark pill
- "Try Another Space" button: secondary ghost pill
- "Book anyway" link: tertiary text style, less prominent (override is intentional, not encouraged)

**Behavior:**
- "Message" → calls `findOrCreateDM` with the booker's userId, opens messaging with a pre-populated booking reference card
- "Try Another Space" → scrolls to the alternatives section (or re-opens space picker filtered to available spaces)
- "Book anyway" → opens a reason modal (required text field) before saving. Creates a `BookingOverride` audit record with who overrode, when, why, and which event was displaced. Notifies the displaced booker.

### 3. Recurring Conflict Summary

**File:** `src/components/athletics/RecurringConflictSummary.tsx`

When booking a recurring practice (e.g., every Tuesday/Thursday for 12 weeks), the system checks all 24 occurrences. Most will be fine. This component shows only the ones that conflict.

**Design:**

```
┌──────────────────────────────────────────────────────┐
│  Recurring Practice: 22 of 24 dates available        │
│                                                      │
│  ⚠️ 2 conflicts found:                               │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Tue, Jun 3 · 3:00–5:00 PM                    │  │
│  │  Main Gym booked: "Volleyball Tournament"      │  │
│  │  by Athletic Dept                              │  │
│  │  [Message]  [Skip this date]  [Move to ___]   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Thu, Jun 19 · 3:00–5:00 PM                   │  │
│  │  Main Gym booked: "8th Grade Graduation"       │  │
│  │  by Administration                             │  │
│  │  [Message]  [Skip this date]  [Move to ___]   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────┐                          │
│  │ Book 22 available dates │  (primary pill)         │
│  └────────────────────────┘                          │
│  Book all 24 anyway (override)  (tertiary text)      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Behavior:**
- Per-conflict actions: message the booker, skip that one date (create exception in rrule), or pick an alternative space for just that date
- "Book 22 available dates" — creates the recurring CalendarEvent with exceptions for conflict dates
- "Book all 24 anyway" — override, books everything including conflicts

### 4. Booking Reference Card (Messaging)

**File:** `src/components/messaging/BookingReferenceCard.tsx`

Renders inside a message bubble when `message.metadata.type === 'booking-conflict'`.

**Design:**

```
┌─────────────────────────────────────────┐
│  📅  Booking Request                     │
│  ─────────────────────────────────       │
│  Basketball Practice                     │
│  Main Gymnasium                          │
│  Tue, May 20 · 3:00 – 5:00 PM          │
│                                          │
│  [View on Calendar →]                    │
└─────────────────────────────────────────┘
```

**Styling:**
- `bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4` (aurora-light tones)
- "View on Calendar" link navigates to the calendar day view with that event highlighted
- Rendered by `MessageBubble.tsx` when it detects metadata

### 5. Space Availability View

**File:** `src/components/athletics/SpaceAvailabilityView.tsx`

A new view accessible from the athletics section (and potentially from campus settings). Shows a week-at-a-glance for a selected space.

**Design:**

```
┌──────────────────────────────────────────────────┐
│  Space: [Main Gymnasium ▾]    ← [Week] →         │
│                                                   │
│  Mon 5/19    Tue 5/20    Wed 5/21    ...          │
│  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │        │  │ 🏀 BBall│  │        │              │
│  │  Open  │  │ 3-5 PM │  │  Open  │              │
│  │        │  │        │  │        │              │
│  │────────│  │────────│  │────────│              │
│  │ 🏐 VB  │  │        │  │ 🏀 BBall│              │
│  │ 6-8 PM │  │  Open  │  │ 3-5 PM │              │
│  └────────┘  └────────┘  └────────┘              │
│                                                   │
│  Legend: ■ Game  ■ Practice  ■ Event  ■ Blocked  │
└──────────────────────────────────────────────────┘
```

**Styling:**
- Glass card container (`ui-glass p-6`)
- Time blocks colored by source: aurora gradient for games, blue-100 for practices, gray-100 for other events, red-100 for maintenance blocks
- Open slots shown as white/transparent
- Tap a booking block to see details + "Message booker" option
- Space dropdown filters by `spaceType`

### 6. Calendar Conflict Badges + Buffer Visibility

**File:** Modify existing calendar components

On the main calendar view, days that have a conflict for the current user's bookings show a small warning dot/badge.

- Orange dot on the calendar day cell (alongside existing event dots)
- Tap/click reveals the conflict detail in the day's event list
- Only shows for spaces the user has booked — not every conflict in the org

**Buffer time visibility:** If a 3:00 PM game has a 45-min setup buffer, the calendar shows the buffer as a faded/hatched block from 2:15–3:00 PM so coaches understand why 2:30 looks blocked. Style: same color as the event but at 20% opacity with a diagonal stripe pattern. Label: "Setup — [Event name]"

### 7. Weather Cancellation Flow

**File:** `src/components/athletics/CancelOccurrenceModal.tsx`

Quick-action for cancelling a single occurrence of a recurring booking.

**Flow:**
1. Coach taps a practice on a specific date → "Cancel this date" option
2. Modal: "Cancel practice on [date]?" with options:
   - **Cancel only** — creates rrule exception, marks CalendarEvent occurrence as CANCELLED
   - **Cancel & reschedule** — cancel + open a new booking form pre-filled with the same details
   - **Cancel & notify** — cancel + auto-send push notification to team members + DM to relevant people
3. Reason field (optional): "Weather", "Field condition", "Scheduling change", "Other"
4. If outdoor space + reason is "Weather", offer to cancel all outdoor practices for the day across the org (admin only)

### 8. Mobile Adaptations

All new components must work in `MobileShell`:

- **ConflictCard**: Full-width, stacked buttons instead of side-by-side
- **RecurringConflictSummary**: Scrollable conflict list, sticky "Book available dates" button at bottom
- **SpaceAvailabilityView**: Horizontal scroll for week view, or switch to single-day view on mobile
- **CancelOccurrenceModal**: Bottom sheet style (slide up from bottom)
- **LocationPicker in drawers**: Already mobile-responsive

---

## Permissions

### New Permission Strings

```typescript
// Add to PERMISSIONS in src/lib/permissions.ts
FACILITIES_BOOK:          'facilities:book'           // book a space for own team
FACILITIES_BOOK_ANY:      'facilities:book:all'       // book for any team (athletic director)
FACILITIES_OVERRIDE:      'facilities:override'       // override conflicts
FACILITIES_VIEW_SCHEDULE: 'facilities:view-schedule'  // view space availability
FACILITIES_VIEW_ALL:      'facilities:view:all'       // view all bookings across all schools (reporting)
FACILITIES_BLOCK:         'facilities:block'          // block a space (maintenance)
FACILITIES_MANAGE_HOURS:  'facilities:manage-hours'   // set operating hours + blackout dates
CALENDAR_FEED_MANAGE:    'calendar:feed:manage'      // create/revoke iCal subscription feeds
```

### Role Assignments

| Permission | Super Admin | Admin | Coach (Member) | Viewer |
|------------|:-----------:|:-----:|:--------------:|:------:|
| `facilities:book` | yes | yes | yes | no |
| `facilities:book:all` | yes | yes | no | no |
| `facilities:override` | yes | yes | no | no |
| `facilities:view-schedule` | yes | yes | yes | yes |
| `facilities:view:all` | yes | yes | no | no |
| `facilities:block` | yes | yes | no | no |
| `facilities:manage-hours` | yes | yes | no | no |
| `calendar:feed:manage` | yes | yes | yes | no |

Coaches can book spaces for their own team's games/practices. Athletic directors (admin+) can book for any team, override conflicts, and view utilization reports across all schools.

---

## Data Flow (End to End)

### Happy Path: Coach Books a Practice

1. Coach opens Practice drawer, picks team, sets date/time
2. Coach selects "Main Gymnasium" from LocationPicker (filtered to GYM/COURT types)
3. On space selection, client calls `GET /api/facilities/availability?spaceId=X&startTime=...&endTime=...`
4. API returns `{ available: true }` — green checkmark shown next to space name
5. Coach saves practice
6. API creates Practice (no facility columns on the Practice record itself)
7. API creates linked CalendarEvent with `spaceId`, `buildingId`, `sourceModule: 'athletics'` — this is where the facility claim lives
8. Practice appears on calendar with facility info

### Conflict Path: Space Already Booked

1. Steps 1-2 same as above
2. Availability check returns `{ available: false, conflicts: [...], alternatives: [...] }`
3. ConflictCard appears showing who has it booked and when
4. Coach picks one:
   - **"Try Another Space"** → alternatives shown, coach picks one, availability re-checked
   - **"Message"** → DM opened with booker, booking card auto-attached
   - **"Book anyway"** → practice saved with override flag

### Recurring Path: Season Practice Schedule

1. Coach creates practice with recurrence (e.g., Tue/Thu 3-5pm for 12 weeks)
2. Client expands rrule into 24 concrete date/time slots
3. Client calls `POST /api/facilities/check-bulk` with all 24 slots
4. API returns per-slot availability
5. RecurringConflictSummary shows "22 of 24 available, 2 conflicts"
6. Coach resolves each conflict (skip, move, message, or override)
7. Practice saved with rrule + exceptions for skipped dates
8. CalendarEvent created with rrule + matching exceptions

### Maintenance Blocks Space

1. Maintenance admin creates ticket on "Football Field" with `blocksFacility: true`
2. API sets `space.status = 'UNDER_MAINTENANCE'`
3. Any availability check on that space returns unavailable with "Space is under maintenance — contact [maintenance admin]"
4. LocationPicker shows maintenance badge on the space (still visible, not hidden)
5. When ticket is resolved, space returns to `ACTIVE`

### Weather Cancellation

1. Coach views upcoming practice on a stormy day
2. Taps practice → "Cancel this date"
3. Selects reason: "Weather"
4. System offers: "Cancel all outdoor practices today?" (if admin)
5. Creates rrule exception in CalendarEvent
6. Sends push notification to team: "Practice cancelled — Weather"
7. Space is freed up, available for rebooking

### Override Notification Flow

When an admin uses "Book anyway" to override a conflict:

1. Admin taps "Book anyway" — a reason modal appears requiring an explanation before the save proceeds
2. API creates the booking + `BookingOverride` audit record
3. API sends push notification to the overridden event's creator: "Your booking of [Space] on [Date] has a new overlap — [Admin Name] booked [Title] at the same time. Reason: [reason]"
4. API sends email via Resend (same content + reason) as backup for users without push enabled
5. Notification includes a one-tap "Open DM with [Admin Name]" action
6. The overridden coach can then discuss/coordinate via DM

This prevents silent conflicts from burning trust. The original booker always knows.

### Messaging Flow

1. Coach sees conflict card with "Coach Smith has Basketball Practice 3-5pm"
2. Taps "Message"
3. Client calls `POST /api/messaging/dms` with Coach Smith's userId
4. If existing DM → returns that channel (unhides if hidden)
5. If no DM → creates new DM channel
6. Client navigates to messaging with that channel open
7. Composer pre-populates with booking reference card (metadata)
8. Coach types their message: "Hey, any chance I can get the gym Tuesday? We have a game Friday and need to prep."
9. Message sent with booking card attached
10. Coach Smith gets push notification
11. Coach Smith sees the booking card in the DM — taps "View on Calendar" to see the context

---

## Email Notifications (Resend Templates)

Not everyone has push enabled. These booking events send email via the existing Resend integration:

| Trigger | Recipients | Template |
|---------|-----------|----------|
| Booking confirmed | The booker | "Your booking is confirmed: [Title] at [Space], [Date/Time]" |
| Booking cancelled | The booker + attendees | "[Title] at [Space] on [Date] has been cancelled. Reason: [reason]" |
| Override created | The overridden booker | "[Admin] booked [Title] at [Space] during your [ExistingTitle]. Tap to message them." |
| Weather cancellation (bulk) | All affected team members | "All outdoor practices cancelled for [Date] due to weather" |
| Maintenance block | Users with bookings on that space in the next 30 days | "[Space] is now under maintenance. Your booking on [Date] may be affected." |

Each email includes a deep link back to the calendar or messaging. Templates follow the existing email style from `emailService.ts`.

**Batching:** A maintenance block on a popular space could affect dozens of future bookings. Don't fire 50 individual emails. Batch per recipient — one email listing all their affected bookings. Use a short delay (5 seconds) to collect affected events before sending, so a single block action produces one email per person, not one per booking.

---

## Editing Recurring Bookings

Standard three-choice pattern when editing a recurring practice/game:

**"Edit this occurrence only"**
- Creates a CalendarEvent exception (child event with `parentEventId` pointing to the recurring event, `originalStart` set to the occurrence's original start)
- The exception has its own space/time/details that override the parent for that date
- Original rrule stays unchanged

**"Edit this and all future"**
- Splits the recurrence: original event gets an `UNTIL` added to its rrule (ending before the edit date)
- A new recurring CalendarEvent is created starting from the edit date with the updated details
- Linked Practice/Game record updated accordingly

**"Edit all occurrences"**
- Updates the parent CalendarEvent and Practice/Game record directly
- Deletes any existing exceptions (they're now stale)
- Re-runs conflict check on all expanded occurrences

**UI:** The edit drawer shows a modal asking which scope before applying changes. Same pattern as Google Calendar.

---

## Calendar Export / iCal Feeds

### `GET /api/calendar/ical/[token].ics`

A subscription URL that returns an iCalendar (.ics) feed. Coaches and parents add this to Google Calendar or Apple Calendar for live sync.

**Feed types:**
- **Per-team feed**: All games + practices for a specific athletic team
- **Per-space feed**: All bookings for a specific space (useful for facility managers)
- **Per-user feed**: All events the user is involved in (as creator or attendee)

**Token:** A signed, non-guessable token per feed (like `hmac(userId + feedType + entityId, AUTH_SECRET)`). No auth header needed — calendar apps can't send one. The token is tied to a user + feed combo and can be revoked.

**Schema addition:**

```prisma
model CalendarFeed {
  id             String   @id @default(cuid())
  organizationId String
  userId         String?  // who created/owns this feed (null for public team feeds)
  feedType       String   // 'team' (user-bound, coach's own view) | 'team-public' (shareable, no userId, parent-facing) | 'space' | 'user'
  entityId       String?  // teamId or spaceId (null for user feed)
  token          String   @unique // signed token for URL
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User?        @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Cascade: if the user is deleted, their personal feeds die with them.
  // Public team feeds (userId=null) are unaffected by user deletion.

  @@index([token])
  @@index([userId])
}
```

**Revoked feeds:** When a feed is deactivated (`isActive = false`) or the token is regenerated, the endpoint returns `410 Gone` so calendar apps stop polling. Invalid/unknown tokens return `404`.

**Permissions:** Coaches and admins can create/revoke feeds for their own teams. Add `CALENDAR_FEED_MANAGE: 'calendar:feed:manage'` to the permissions list — granted to member, admin, and super-admin roles.

**UI:** "Subscribe to Calendar" button on team pages and space schedule views. Shows a copyable URL + QR code. One tap to add to Apple Calendar on mobile.

**Implementation:** Generate iCal using the `ics` npm package (or hand-roll — the format is simple). Recurring events use VEVENT with RRULE. Cancelled occurrences use EXDATE.

**Filtering:** Only `CONFIRMED` events are included in feeds. `PENDING_APPROVAL`, `CANCELLED`, `DRAFT`, and `REJECTED` are excluded — parents and coaches should only see finalized schedules.

**Caching:** Public team feeds will be polled by every parent's calendar app every 5–15 min. Set `Cache-Control: public, max-age=300` (5 min) on the response. For popular feeds, cache the rendered .ics string in memory (simple Map with TTL) to avoid re-querying on every poll.

---

## Booking Reference Card — Graceful Degradation

When the underlying CalendarEvent for a booking reference in a message is deleted or moved:

- The `BookingReferenceCard` component fetches the CalendarEvent by ID on render
- If the event still exists: show current details (may differ from original if moved)
- If the event was cancelled: show original details from message metadata + a "This booking was cancelled" badge
- If the event was deleted (hard or soft): show original details from metadata + "This booking no longer exists" badge
- The "View on Calendar" link gracefully handles missing events (navigates to the date, not to a broken event)

The message metadata always stores a snapshot of the booking at send time. This means the card always has something to show, even if the source event is gone.

---

## Split Spaces (Capacity Model)

For spaces that can host multiple concurrent activities:

**Setup (Campus Settings):**
- Admin sets `capacity: 2` on "Main Gymnasium" (it has a divider curtain)
- Or `capacity: 2` on "Athletic Field" (two halves)

**Conflict Logic:**
- When checking availability, count how many CalendarEvents overlap the requested time window for that space
- If `count < capacity` → available (no conflict)
- If `count >= capacity` → conflict (space is full)
- `capacity: null` or `capacity: 1` → one booking at a time (current behavior)

**UI Indicator:**
- Space picker shows "1 of 2 slots available" when partially booked
- "Full" badge when at capacity

**Exclusive use:** When a tournament or large event needs the whole gym (both halves), the booker checks "Exclusive use" which sets `calendarEvent.exclusiveUse = true`. This overrides the capacity — the event claims all slots. Conflict detection treats an exclusive-use event as filling the space to capacity regardless of the space's actual capacity setting.

**Future Enhancement (not now):** Sub-spaces (Court A / Court B) as child Space records. The capacity model handles the immediate need without that complexity.

---

## Shared District Facilities

Spaces scoped at the district level are automatically visible to all schools in that district (already true in the data model).

**Conflict detection:** Since CalendarEvent is org-scoped (not school-scoped), `checkLocationConflict()` already checks ALL bookings for a space regardless of which school created them. No code change needed — just verify with a test.

**Visibility:** The LocationPicker's campus/district grouping already shows district-level spaces. Coaches from any school can see and book them.

**Contact info:** When a conflict is from another school, the conflict card shows the school name alongside the booker: "Coach Smith (Lincoln Middle School) — Basketball Practice"

---

## Community/External Rentals (Future-Proofing Only)

We're NOT building this now, but the architecture supports it:

- External bookings would be CalendarEvents with `sourceModule: 'external-rental'`
- A future `FacilityRental` model would link to CalendarEvent the same way Game/Practice do
- Conflict detection already works against ALL CalendarEvents regardless of source
- The `metadata` JSON field on CalendarEvent can store rental-specific data (renter name, contract ID, etc.)

No schema changes needed now. Just don't build anything that assumes all bookings come from athletics.

---

## Equipment / Resources (Future-Proofing Only)

Coaches will eventually want to book "Gym + scoreboard + mic" together. We're not building this now, but the architecture supports it:

- `EventResourceRequest` already exists in the schema with types `FACILITY`, `AV_EQUIPMENT`, `CUSTODIAL`
- A future `EquipmentBooking` model would link to CalendarEvent the same way facility refs do
- The `metadata` JSON field on CalendarEvent can store equipment needs until a formal model exists
- The Space model could gain an `equipment` relation (what's available in this space)

No schema changes needed now. Just be aware this is coming.

---

## Technical Decisions (Settled)

### Recurrence Library: `rrule.js`

Use [`rrule`](https://www.npmjs.com/package/rrule) (the standard RFC 5545 JavaScript implementation) for all recurrence expansion. One library, one place. Do not pull in alternatives.

### DST Behavior for Recurring Practices

"Tuesday at 3:00 PM" means 3:00 PM local time year-round, even across daylight saving transitions. This is the standard behavior when you store the recurrence rule with a timezone (`DTSTART;TZID=America/Chicago`). `rrule.js` handles this correctly when configured with `tzid`. A practice created at 3pm in March still starts at 3pm in November — it doesn't shift to 2pm or 4pm.

### PENDING_APPROVAL — Existing, Not New

`CalendarEventStatus.PENDING_APPROVAL` already exists in the schema. It's used by the existing calendar approval workflow (calendars can have `requiresApproval = true`). We don't build a new approval system for facility bookings in v1 — but when checking conflicts, we DO include `PENDING_APPROVAL` events because they represent claimed time slots even if not yet approved. If a future version adds facility-specific approval, the status is already there.

### Booking Notes

CalendarEvent already has a `description` field. Coaches can use this for notes like "Use the side entrance" or "Leave the scoreboard on." The Game/Practice drawers should surface this field (it may already be there for games via the CalendarEvent bridge). No new field needed — just make sure the UI exposes it.

### Game vs. Practice Priority

No auto-override in v1. First-write wins. If an AD wants a varsity game to take precedence over a JV practice, they use the override flow (which notifies the practice coach). This is a deliberate choice — auto-bumping bookings without human confirmation would cause more problems than it solves in a school setting. Revisit if ADs consistently request it.

### Drag-to-Reschedule on Calendar

Not in v1. Coaches edit bookings through the drawer. Calendar drag-and-drop is a v2 enhancement.

### Outdoor vs. Indoor Spaces

The weather cancellation flow says "cancel all outdoor practices" but needs to know which spaces are outdoor. Derived from `spaceType` — no new field needed:

- **Outdoor:** `FIELD`, `COURT`, `GARDEN`, `PLAYGROUND`, `PARKING`
- **Indoor:** `GYM`, `POOL`, `COMMON`, `OTHER`

This mapping lives as a constant in `facilityBookingService.ts`. If a space type is ambiguous (a covered court), admins can override by setting an `isOutdoor` flag — but we start with the derived mapping and only add the explicit flag if real-world usage demands it.

### Buffer Time vs. Operating Hours

A 9:45 PM event with 30-min teardown extends to 10:15 PM. If the space closes at 10:00 PM, is that allowed?

**Rule:**
- `event.startTime - setupMinutes >= space.openTime` (enforced — you need the building open to set up)
- `event.endTime <= space.closeTime` (enforced — event itself must finish before closing)
- `event.endTime + teardownMinutes` can extend past closing (cleanup is just the tail end, attendees have left)

Example: Space opens 7:00 AM, closes 10:00 PM. A game at 9:00 PM with 45-min setup and 30-min teardown needs the space from 8:15 PM to 9:30 PM+teardown. Setup start (8:15 PM) >= 7:00 AM, event end (9:30 PM) <= 10:00 PM, teardown extends to 10:00 PM — all good. But a 6:00 AM start with 45-min setup would need access at 5:15 AM — rejected, building isn't open.

### Optimistic Concurrency (Concurrent Edits)

Two admins opening the same booking drawer at the same time is a general problem, not facility-specific. Last write silently wins today. A lightweight fix: check `updatedAt` on save — if it changed since the drawer loaded, show "This booking was updated by someone else. Reload?" instead of silently overwriting. Small lift, deferring to v2, but noting it here so we don't forget.

### Facility Utilization Reporting

`FACILITIES_VIEW_ALL` permission exists but no reporting UI in v1. Stub: "Facility utilization report — v2." The data is all in CalendarEvent and queryable when we build it.

---

## iCal Feeds — Non-User Access (Parents)

The `CalendarFeed` token is user-bound by default (a coach generates their own feed URL). For parent access to team schedules:

**Option: Public team feed.** Each `AthleticTeam` can have a public feed token (no user binding). Generated by a coach or AD, shareable via link or QR code on the team page. The feed is read-only and contains only games + practices for that team — no sensitive data.

Schema: `CalendarFeed.userId` is nullable. When null, `feedType = 'team-public'` and `entityId` = the team ID. Anyone with the token can subscribe.

The coach controls whether the public feed exists (toggle on/off). Revoking the token invalidates all subscriptions — subscribers would need the new URL.

---

## Setup/Teardown Buffer Implementation

### How It Works

The current `checkLocationConflict()` uses `eventBufferMinutes` (org-level, default 60 min) on both sides of every event. This is a symmetric buffer.

We're adding **asymmetric, per-event overrides:**

- `setupMinutes` — time needed BEFORE the event (field prep, warmups, equipment setup)
- `teardownMinutes` — time needed AFTER the event (cleanup, equipment teardown)
- If not set, fall back to org's `eventBufferMinutes` split equally (30 min each side of a 60 min buffer)

**Conflict check logic (updated):**

```
effectiveStart = event.startTime - (event.setupMinutes ?? orgBuffer/2)
effectiveEnd   = event.endTime   + (event.teardownMinutes ?? orgBuffer/2)
```

Two events conflict if their effective windows overlap.

**UI:** Optional "Setup time" and "Teardown time" fields in Game/Practice drawers (collapsed by default under "Advanced" or "Buffer time" accordion). Shown as simple minute inputs: "Setup time: [30] min before" / "Teardown time: [15] min after"

---

## File Inventory (What Gets Created or Modified)

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/facilities/availability/route.ts` | Space availability check endpoint |
| `src/app/api/facilities/check-bulk/route.ts` | Bulk availability for recurring bookings |
| `src/app/api/facilities/space-schedule/route.ts` | Week schedule for a single space |
| `src/lib/services/facilityBookingService.ts` | Core booking logic, conflict expansion, alternative finder |
| `src/components/athletics/ConflictCard.tsx` | Inline conflict warning with actions |
| `src/components/athletics/RecurringConflictSummary.tsx` | Multi-date conflict summary for recurring bookings |
| `src/components/athletics/SpaceAvailabilityView.tsx` | Week-at-a-glance space schedule |
| `src/components/athletics/CancelOccurrenceModal.tsx` | Cancel single occurrence of recurring booking |
| `src/components/messaging/BookingReferenceCard.tsx` | Rich card for booking context in DMs |
| `src/lib/hooks/useFacilityAvailability.ts` | TanStack Query hook for availability checks |
| `src/components/athletics/EditRecurrenceModal.tsx` | "This only / this and future / all" choice for recurring edits |
| `src/app/api/calendar/ical/[token]/route.ts` | iCal subscription feed endpoint |
| `src/app/api/facilities/blackout-dates/route.ts` | CRUD for org blackout dates |
| `src/lib/services/facilityNotificationService.ts` | Email + push for booking confirmations, overrides, cancellations |
| `src/components/settings/BlackoutDatesTab.tsx` | Admin UI for managing blackout dates |
| `prisma/migrations/XXXXXX_facility_booking/` | Migration for all schema changes |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add fields to Space, CalendarEvent, MaintenanceTicket, Message + new models (BlackoutDate, BookingOverride, CalendarFeed) |
| `src/lib/permissions.ts` | Add `FACILITIES_*` permission strings |
| `src/lib/services/calendar-core.ts` | Extend `checkLocationConflict()` with capacity, status, per-event buffers |
| `src/lib/services/athletics/core.ts` | Pass facility refs to CalendarEvent bridge, add Practice→CalendarEvent creation |
| `src/components/athletics/GameDrawer.tsx` | Add LocationPicker, conflict checking, setup/teardown fields |
| `src/components/athletics/PracticeDrawer.tsx` | Add LocationPicker, conflict checking, setup/teardown fields |
| `src/components/athletics/ScheduleSection.tsx` | Show facility name instead of text venue/location |
| `src/components/events/LocationPicker.tsx` | Add `spaceTypeFilter` prop, status badges, capacity display |
| `src/components/messaging/MessageBubble.tsx` | Render BookingReferenceCard when metadata present |
| `src/app/api/messaging/channels/[id]/messages/route.ts` | Accept + store metadata field |
| `src/app/api/messaging/references/route.ts` | Add `type=booking` support |
| `src/app/api/athletics/games/route.ts` | Accept facility fields |
| `src/app/api/athletics/practices/route.ts` | Accept facility fields |
| `src/components/settings/campus/SpaceFormDrawer.tsx` | Add status dropdown, capacity field, operating hours |
| `src/lib/services/organizationRegistrationService.ts` | Add facilities permissions to `seedOrgDefaults` |
| `src/lib/services/messageService.ts` | Accept + store metadata on messages |
| `src/lib/services/maintenanceService.ts` | Auto-set space status on blocksFacility tickets |
| `src/components/maintenance/TicketFormDrawer.tsx` | Add "Block facility" checkbox |

---

## Build Order

Build in this sequence so each step is testable independently:

### Step 1: Schema + Migration
- All Prisma schema changes (Space status/capacity/hours, CalendarEvent buffers/exclusiveUse, BlackoutDate, BookingOverride, CalendarFeed, MaintenanceTicket blocksFacility, Message metadata)
- Run `db:migrate` to create migration file
- Seed new permissions via `seedOrgDefaults` update

### Step 2: Core Service Layer
- `facilityBookingService.ts` — availability check with capacity, status, operating hours, blackout dates, exclusive use
- Extend `checkLocationConflict()` — capacity awareness, per-event buffers, booker info, space status
- Extend athletics service — Practice→CalendarEvent bridge, facility ref pass-through for both Game and Practice
- Transactional re-check on save (race condition prevention)
- Validation rules (min/max duration, advance booking limit, operating hours, blackout dates)

### Step 3: API Endpoints
- `/api/facilities/availability` — single + recurring availability check
- `/api/facilities/check-bulk` — season-level bulk check
- `/api/facilities/space-schedule` — week view for a space
- `/api/facilities/blackout-dates` — CRUD for org blackout dates
- Modify athletics game/practice endpoints to accept + pass through facility fields

### Step 4: LocationPicker Enhancements
- `spaceTypeFilter` prop (filter to FIELD, COURT, GYM, etc.)
- Status badges (under maintenance, closed)
- Capacity display ("1 of 2 slots available")
- Operating hours display

### Step 5: Conflict UI
- `ConflictCard` component with message, alternative, and override actions
- `RecurringConflictSummary` component with per-date conflict resolution
- Integration into GameDrawer and PracticeDrawer
- Override reason modal + `BookingOverride` audit record creation

### Step 6: Notifications
- `facilityNotificationService.ts` — email + push for confirmations, cancellations, overrides
- Override notification to original booker (push + email + DM link)
- Maintenance block notification to affected bookers
- Email templates via Resend

### Step 7: Messaging Integration
- `BookingReferenceCard` component (with graceful degradation for deleted/moved events)
- Message metadata support (API + UI)
- "Message" action from ConflictCard → DM flow
- Booking reference type in references endpoint

### Step 8: Recurring Booking Edits
- `EditRecurrenceModal` — "this only / this and future / all" choice
- Rrule splitting service (for "this and future" edits)
- CalendarEvent exception creation (for "this only" edits)
- Re-run conflict check after edit scope is chosen

### Step 9: Space Availability View + Calendar Enhancements
- `SpaceAvailabilityView` component (week-at-a-glance)
- Buffer time visibility on calendar (faded blocks for setup/teardown)
- Conflict badge dots on calendar day cells

### Step 10: Weather Cancellation
- `CancelOccurrenceModal` component (cancel, cancel+reschedule, cancel+notify)
- Rrule exception creation service
- Bulk outdoor cancellation for admins
- Push + email notification on cancellation

### Step 11: Maintenance Blocking + Blackout Dates
- `blocksFacility` toggle in maintenance ticket forms
- Auto-set space status on ticket create/resolve
- `BlackoutDatesTab` in settings for admin CRUD
- Space operating hours fields in SpaceFormDrawer

### Step 12: iCal Feeds
- `CalendarFeed` model + token generation
- `/api/calendar/ical/[token]` endpoint (generates .ics)
- "Subscribe to Calendar" button on team pages + space schedule
- QR code for mobile subscription

### Step 13: Mobile Polish
- Responsive testing for all new components
- Bottom sheet style for modals on mobile
- Conflict cards full-width layout
- Space availability horizontal scroll or day view on mobile

---

## Testing Plan

### Smoke Tests (Priority)

1. **Book a space** — Create game with space, verify CalendarEvent created with `spaceId`
2. **Detect conflict** — Book same space at same time, verify conflict returned
3. **Capacity** — Set capacity=2, book twice, verify no conflict. Book third, verify conflict
4. **Recurring conflicts** — Create recurring practice, verify per-date conflict detection
5. **Maintenance block** — Block a space, verify availability check returns blocked
6. **Weather cancel** — Cancel single occurrence, verify rrule exception created
7. **Cross-school conflict** — Two schools book same district space, verify conflict
8. **Buffer override** — Set 45 min setup, verify conflict window expands
9. **DM flow** — Tap "Message" on conflict, verify DM created/continued with booking card
10. **Alternative spaces** — When space conflicts, verify alternatives of same type returned

### Additional Smoke Tests

11. **Race condition** — Two concurrent saves on same space/time, verify only one succeeds (or both if capacity allows)
12. **Operating hours** — Book outside space hours, verify rejection with clear message
13. **Blackout date** — Book on a school holiday, verify rejection
14. **Override notification** — Override a booking, verify original booker gets push + email
15. **Exclusive use** — Book exclusive on capacity-2 space, verify it blocks both slots
16. **Edit recurring (this only)** — Edit one occurrence, verify exception created, others unchanged
17. **Edit recurring (this and future)** — Edit from mid-series, verify split into two rrules
18. **iCal feed** — Generate feed URL, verify valid .ics with correct events + recurrence
19. **Booking card degradation** — Delete a CalendarEvent, verify the DM card shows "cancelled" badge
20. **Validation** — Try booking 13 months out, verify rejection. Try 5-minute booking, verify rejection.

### Edge Cases to Test

- Practice with no space selected (should still work — text-only location like today)
- Space with `capacity: null` (treat as 1)
- Recurring practice spanning a season boundary
- Cancelling a cancelled occurrence (no-op)
- Two coaches messaging the same booker (should continue same DM thread)
- Space status changing while someone is mid-booking flow
- Off-campus game (no space, no conflict check needed)
- Editing an event to a new time AND new space simultaneously (excludeEventId must work on both axes)
- Booking a space at exactly the boundary of another booking's teardown window
- Exclusive use event on a space with existing partial bookings (should show conflict)
- Blackout date on one specific space vs. all spaces
- LocationPicker search with 50+ spaces across multiple campuses (verify text search works — it already exists in the component)

---

## Success Criteria

When this ships, a coach should be able to:

1. Pick a real facility when scheduling a game or practice (not type free text)
2. Instantly see if that facility is available or who has it booked
3. See alternative spaces if their first choice is taken
4. Message the person who booked it with one tap, with the booking context attached
5. Book a full season of recurring practices and resolve only the specific dates that conflict
6. Cancel a single practice due to weather and notify the team
7. See a week view of any facility's schedule before deciding when to book
8. Trust that the calendar shows everything — games, practices, events, maintenance blocks

And an admin should be able to:

1. Block a facility for maintenance with one checkbox
2. Override any conflict when needed — and the original booker is automatically notified
3. See all bookings across all schools for shared facilities
4. Set capacity on split spaces (gym with divider, large field)
5. Set operating hours on spaces and create blackout dates for holidays
6. See an audit trail of all overrides (who, when, why)

And parents / external users should be able to:

1. Subscribe to a team's game/practice schedule in their own calendar app (Google Calendar, Apple Calendar) via iCal feed
