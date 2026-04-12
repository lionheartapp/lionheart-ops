# Approval System Unification Plan

## The Problem

There are two completely disconnected approval systems in the codebase:

**System 1 — EventProject Gates (active, but dumb)**
- Uses a JSON field (`approvalGates`) on EventProject
- Only 3 hardcoded gate types: `av`, `facilities`, `admin`
- Gate creation driven by manual toggles (`requiresAV`, `requiresFacilities`) on the event creation form
- Admin gate always created for direct requests
- Never reads ApprovalChannelConfig settings
- Escalation cron hardcodes 72 hours instead of reading config
- Admin gate has NO team notification — only AV and Facilities get notified

**System 2 — CalendarEvent EventApproval records (orphaned, but smart)**
- Uses separate `EventApproval` database model linked to CalendarEvents
- Reads `ApprovalChannelConfig` to decide which channels to create
- Respects mode (REQUIRED/NOTIFICATION/DISABLED)
- Has auto-approve logic (`autoApproveIfNoResource`)
- Supports all 6 channels
- Has API routes and hooks, but they're not connected to the main EventProject flow

**The Settings Page** writes to `ApprovalChannelConfig`, which only System 2 reads — but System 2 is orphaned. So the Approval Config UI does nothing.

---

## Proposed Solution: Config-Driven EventProject Gates

Unify by bringing System 2's config-awareness into System 1's gate engine. Keep EventProject gates as the single source of truth, but make them dynamic based on the org's ApprovalChannelConfig.

### Design Principles

1. **Config is king** — The ApprovalChannelConfig determines which gates exist, not hardcoded logic
2. **Event metadata informs, config decides** — Event creators still indicate resource needs (AV, facilities, etc.), but the config determines whether that triggers a gate, a notification, or nothing
3. **Dynamic gate types** — Support all 6 channel types as gates, not just 3
4. **Backward compatible** — Events already in PENDING_APPROVAL with existing gates continue to work
5. **Remove dead code** — Delete System 2 (EventApproval model and CalendarEvent approval routes) once migration is complete

### Decisions (Open Questions Resolved)

1. **Admin always required?** — Yes. Add a guardrail: the UI prevents saving a config where zero channels are REQUIRED. Show a warning if Admin is set to DISABLED.
2. **Campus-level config** — Skip for Phase 1. Org-level only. The schema already supports `campusId`, so it's additive later.
3. **Approval queue pages** — Unified queue page filtered by the viewer's team membership. Separate per-channel pages don't scale to 6 channels.
4. **NOTIFICATION mode behavior** — Notification only (in-app + optional email). No queue entry. Queues are reserved for REQUIRED channels.
5. **Auto-approve timing** — Immediate. Gate created as SKIPPED at submission time. No artificial delay.

---

## Implementation Phases

### Phase 1: Make Gates Config-Driven

**Goal:** When an event is submitted, read ApprovalChannelConfig to build gates dynamically.

#### 1a. Expand GateType and ApprovalGates (`eventProject-gates.ts`)

```typescript
// Before
export type GateType = 'av' | 'facilities' | 'admin'
export interface ApprovalGates {
  av?: GateState
  facilities?: GateState
  admin: GateState
}

// After
export type GateType = 'admin' | 'facilities' | 'av' | 'custodial' | 'security' | 'athletic_director'
export interface ApprovalGates {
  admin?: GateState
  facilities?: GateState
  av?: GateState
  custodial?: GateState
  security?: GateState
  athletic_director?: GateState
}
```

#### 1b. Channel enum ↔ gate key translation layer

The `ApprovalChannel` enum uses `AV_PRODUCTION` but the gate key is `av`. This mismatch will cause bugs if not explicitly mapped:

```typescript
const CHANNEL_TO_GATE: Record<ApprovalChannel, GateType> = {
  ADMIN: 'admin',
  FACILITIES: 'facilities',
  AV_PRODUCTION: 'av',
  CUSTODIAL: 'custodial',
  SECURITY: 'security',
  ATHLETIC_DIRECTOR: 'athletic_director',
}

const GATE_TO_CHANNEL: Record<GateType, ApprovalChannel> = {
  admin: 'ADMIN',
  facilities: 'FACILITIES',
  av: 'AV_PRODUCTION',
  custodial: 'CUSTODIAL',
  security: 'SECURITY',
  athletic_director: 'ATHLETIC_DIRECTOR',
}
```

Place these in `eventProject-gates.ts` and import everywhere — no inline translation.

#### 1c. New gate builder that reads config (`eventProject-gates.ts`)

Replace `buildApprovalGates(requiresAV, requiresFacilities)` with:

```typescript
buildApprovalGatesFromConfig(orgId: string, eventMetadata: {
  requiresAV: boolean
  requiresFacilities: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
  requiresAthleticDirector?: boolean
  source: EventProjectSource
}): Promise<{ gates: ApprovalGates, notifications: ApprovalChannel[] }>
```

Logic:
1. Fetch all `ApprovalChannelConfig` records for the org
2. **If no config rows exist** (org never configured approvals), seed defaults via `seedDefaultApprovalConfigs` before proceeding — never silently auto-confirm
3. For each channel config:
   - **DISABLED** → skip entirely
   - **REQUIRED** → create a PENDING gate if the event needs that resource, OR if the channel is "always required" (like Admin often is). If `autoApproveIfNoResource` is true and the event doesn't need that resource → create gate as `SKIPPED`
   - **NOTIFICATION** → don't create a gate (non-blocking), but add to notification list
4. Return both the gates object and the list of channels that need notifications

#### 1d. Map channel types to event needs

Define a clear mapping between ApprovalChannel enum values and event metadata:

| Channel | Triggered By | Always Required Option |
|---------|-------------|----------------------|
| ADMIN | Always (if config mode = REQUIRED) | Yes — most orgs will want this |
| FACILITIES | `requiresFacilities` flag | No |
| AV_PRODUCTION | `requiresAV` flag | No |
| CUSTODIAL | `requiresCustodial` flag (new) | No |
| SECURITY | `requiresSecurity` flag (new) | No |
| ATHLETIC_DIRECTOR | `requiresAthleticDirector` flag (new) | No |

#### 1e. Handle PLANNING_SUBMISSION and SERIES sources

Currently, events from these sources skip gates if `requiresAV` and `requiresFacilities` are both false. With config-driven gates, the behavior should be:

- If Admin is REQUIRED in config, **all events go through approval regardless of source** — including planning submissions and series instances
- The event source should be visible in the approval review UI so reviewers can see "this came from the year plan" vs "this is a direct request"
- This is a behavior change — document it in release notes

#### 1f. Update `createEventProject` in `eventProjectService.ts`

Replace the hardcoded gate logic:

```typescript
// Before
const requiresAV = !!(data as Record<string, unknown>).requiresAV
const requiresFacilities = !!(data as Record<string, unknown>).requiresFacilities
const needsGates = isDirectRequest || requiresAV || requiresFacilities
const approvalGates = needsGates ? buildApprovalGates(requiresAV, requiresFacilities) : null

// After
const { gates, notifications } = await buildApprovalGatesFromConfig(orgId, {
  requiresAV: !!data.requiresAV,
  requiresFacilities: !!data.requiresFacilities,
  requiresCustodial: !!data.requiresCustodial,
  requiresSecurity: !!data.requiresSecurity,
  requiresAthleticDirector: !!data.requiresAthleticDirector,
  source: data.source,
})
const hasActiveGates = Object.values(gates).some(g => g?.status === 'PENDING')
const initialStatus = hasActiveGates ? 'PENDING_APPROVAL' : 'CONFIRMED'
```

#### 1g. Update prerequisite logic (`isAdminGateActionable`)

Currently: Admin waits for AV + Facilities only.
New: Admin waits for ALL other gates to clear. This makes sense because Admin is the final sign-off.

```typescript
export function isAdminGateActionable(gates: ApprovalGates): boolean {
  return Object.entries(gates).every(([key, gate]) => {
    if (key === 'admin') return true // skip self
    if (!gate) return true // gate doesn't exist
    return gate.status === 'APPROVED' || gate.status === 'SKIPPED'
  })
}
```

#### 1h. Update `allGatesApproved` similarly

```typescript
export function allGatesApproved(gates: ApprovalGates): boolean {
  return Object.entries(gates).every(([key, gate]) => {
    if (!gate) return true
    return gate.status === 'APPROVED' || gate.status === 'SKIPPED'
  })
}
```

### Phase 2: Wire Config to Notifications

**Goal:** Use `assignedTeamId` from config instead of hardcoded team slugs. Fix admin gate notifications.

#### 2a. Consolidate GATE_TEAM_SLUGS

**Critical**: `GATE_TEAM_SLUGS` is duplicated in two files:
- `eventProject-notifications.ts` (lines 15-18)
- `automationService.ts` (lines 198-201)

Delete both. Replace with a single config-driven lookup:

```typescript
// In eventProject-gates.ts (single source of truth)
async function getTeamForGate(gateKey: GateType, orgId: string): Promise<string | null> {
  const channelType = GATE_TO_CHANNEL[gateKey]
  const configs = await getApprovalConfigs()
  const match = configs.find(c => c.channelType === channelType)
  return match?.assignedTeamId || null
}
```

Import this in both `eventProject-notifications.ts` and `automationService.ts`.

#### 2b. Fix admin gate notifications

Currently admin gate never notifies anyone — no team slug, no email. With config, the Admin channel can have `assignedTeamId` pointing to an admin team. Wire it up:

- When admin gate becomes actionable (all prerequisite gates cleared), notify the assigned admin team
- Use the same notification mechanism as AV/Facilities gates

#### 2c. Send NOTIFICATION-mode alerts

For channels set to NOTIFICATION mode, send notifications to the assigned team without creating a blocking gate. These are informational — "heads up, this event needs facilities setup" — but the event doesn't wait for their approval.

Delivery: In-app notification via the existing `Notification` model. Email only if the org has email configured and the channel config has `assignedTeamId` set.

#### 2d. Gate labels and link URLs

Create a config-driven label/URL map instead of hardcoded strings:

```typescript
const GATE_CONFIG: Record<GateType, { label: string, defaultUrl: string }> = {
  admin: { label: 'Admin', defaultUrl: '/events' },
  av: { label: 'A/V Production', defaultUrl: '/av/event-approvals' },
  facilities: { label: 'Facilities', defaultUrl: '/maintenance/event-approvals' },
  custodial: { label: 'Custodial', defaultUrl: '/maintenance/event-approvals' },
  security: { label: 'Security', defaultUrl: '/events' },
  athletic_director: { label: 'Athletic Director', defaultUrl: '/events' },
}
```

### Phase 3: Wire Config to Escalation

**Goal:** Use `escalationHours` from config instead of hardcoded 72 hours.

#### 3a. Update `processApprovalGateTimeouts` in `automationService.ts`

```typescript
// Before: hardcoded 72 hours for all gates
const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000)

// After: per-channel escalation from config
const channelConfigs = await getApprovalConfigs()

for (const [gateKey, gate] of Object.entries(gates)) {
  if (gate.status !== 'PENDING') continue
  const config = channelConfigs.find(c => c.channelType === GATE_TO_CHANNEL[gateKey])
  const hours = config?.escalationHours ?? 72
  const deadline = new Date(project.updatedAt.getTime() + hours * 60 * 60 * 1000)
  if (new Date() > deadline) {
    // send escalation notification using config.assignedTeamId
  }
}
```

#### 3b. Remove duplicate GATE_TEAM_SLUGS from automationService

Already addressed in Phase 2a — the automation service should import the shared lookup, not maintain its own copy.

### Phase 4: Update UI

#### 4a. Approve/Reject API routes

Expand the Zod enum to accept all 6 gate types:

```typescript
// Before
gateType: z.enum(['av', 'facilities', 'admin'])

// After
gateType: z.enum(['admin', 'facilities', 'av', 'custodial', 'security', 'athletic_director'])
```

#### 4b. ApprovalGatesBar component

Update the gate config map to include all 6 types with appropriate icons and colors. Currently hardcoded to 3 gates with Shield (admin), Monitor (av), Wrench (facilities).

#### 4c. Event creation form (CreateEventProjectModal)

Add optional toggles for the new resource types (Custodial, Security, Athletic Director) in Step 3 of the form, similar to the existing AV and Facilities toggles.

**Important**: Only show toggles for channels that are REQUIRED or NOTIFICATION in the org's config. If a channel is DISABLED, don't show the toggle — no point asking about a resource nobody reviews.

Fetch the org's config on mount:
```typescript
const { data: approvalConfig } = useQuery({
  queryKey: ['approval-config'],
  queryFn: () => fetchApi('/api/settings/approval-config'),
})
```

#### 4d. Approval Config page

The existing ApprovalConfigTab.tsx should work as-is since it already supports all 6 channels. Add:

- A guardrail preventing a save where zero channels are REQUIRED (show a warning: "At least one approval channel must be required, otherwise events will be auto-confirmed with no review")
- A visual indicator showing which channels are actively wired up (have gates in the EventProject flow) vs which are config-only
- Validation that `assignedTeamId` is set for REQUIRED channels (otherwise nobody receives the approval request)

#### 4e. Unified approval queue page

Replace the separate `/av/event-approvals` and `/maintenance/event-approvals` pages with a single unified queue at `/events/approvals` (or similar):

- Filter by the viewer's team membership — show gates assigned to their team
- Super-admins see all pending gates across all channels
- Each queue item shows: event title, gate type, time pending, requester, event date
- Click → navigates to event detail page with approval drawer

### Phase 5: Cleanup

#### 5a. Remove orphaned System 2 code

Verify no calendar flows depend on EventApproval before deleting:

- Delete `/src/app/api/calendar-events/[id]/submit/route.ts`
- Delete `/src/app/api/calendar-events/[id]/approve/route.ts`
- Delete `/src/app/api/calendar-events/[id]/reject/route.ts`
- Remove `submitForApproval`, `approveEvent`, `rejectEvent` from `calendar-events.ts`
- Remove `useSubmitForApproval`, `useApproveEvent`, `useRejectEvent` from `useCalendar.ts`
- Remove approval UI section from `EventDetailPanel.tsx`

#### 5b. Remove EventApproval model

After confirming no other code references it, remove the `EventApproval` model from schema.prisma. This is a schema change — use `db:push` for dev, create a proper migration for production.

#### 5c. Add new EventProject fields to schema

```prisma
model EventProject {
  // existing
  requiresAV          Boolean @default(false)
  requiresFacilities  Boolean @default(false)
  // new
  requiresCustodial        Boolean @default(false)
  requiresSecurity         Boolean @default(false)
  requiresAthleticDirector Boolean @default(false)
}
```

---

## Migration Strategy

### Existing events in PENDING_APPROVAL

Events already in the pipeline with the old 3-gate structure will still work because:
- `approveGate` and `rejectGate` operate on whatever gates exist in the JSON
- `allGatesApproved` checks all present gates dynamically
- The only change is that new events get config-driven gates

### Backfill migration for existing orgs

**Critical**: Orgs that never opened the Approval Config page have zero `ApprovalChannelConfig` rows. Without a backfill, the new config-driven gate builder would find no config and could either:
- Auto-confirm everything (dangerous — no review)
- Error out (bad UX)

**Solution**: Run a one-time migration script that calls `seedDefaultApprovalConfigs(orgId)` for every org that has zero config rows. Additionally, the gate builder should defensively seed defaults if it finds no config (belt and suspenders).

### Config seeding

`seedDefaultApprovalConfigs` already creates default configs for new orgs (Admin=REQUIRED, others=NOTIFICATION). After the backfill migration, all orgs will have configs.

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 3 new boolean fields to EventProject; remove EventApproval model |
| `src/lib/services/eventProject-gates.ts` | Expand GateType, add CHANNEL↔GATE maps, make ApprovalGates fully dynamic, update prerequisite logic, add shared `getTeamForGate` |
| `src/lib/services/eventProjectService.ts` | Replace hardcoded gate builder with config-driven builder |
| `src/lib/services/approvalConfigService.ts` | Add helper to map channel types ↔ gate keys |
| `src/lib/services/eventProject-notifications.ts` | Remove hardcoded GATE_TEAM_SLUGS, use config-driven team lookup, add admin notifications |
| `src/lib/services/automationService.ts` | Remove duplicate GATE_TEAM_SLUGS, read escalationHours per-channel from config |
| `src/app/api/events/projects/[id]/approve-gate/route.ts` | Expand Zod enum to 6 types |
| `src/app/api/events/projects/[id]/reject-gate/route.ts` | Expand Zod enum to 6 types |
| `src/components/events/overview/ApprovalGatesBar.tsx` | Support all 6 gate types with icons/colors |
| `src/components/events/CreateEventProjectModal.tsx` | Add toggles for new resource types, conditionally show based on config |
| `src/components/settings/ApprovalConfigTab.tsx` | Add guardrail (≥1 REQUIRED), assignedTeamId validation, wired-up indicators |
| Multiple System 2 files | Delete orphaned CalendarEvent approval code |
| New: unified approval queue page | Single queue filtered by viewer's team |
| Migration script | Backfill `ApprovalChannelConfig` for existing orgs |
