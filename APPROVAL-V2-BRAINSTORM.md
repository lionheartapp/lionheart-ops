# Approval System V2 — Team-Based Flow (Brainstorm)

## The Idea

Instead of 6 hardcoded approval channels (Admin, Facilities, A/V, etc.), let admins build their approval flow from their actual teams. Any team can be added to the flow with a trigger rule.

## Current Model (V1 — just shipped)

```
ApprovalChannelConfig
  channelType: enum (ADMIN, FACILITIES, AV_PRODUCTION, CUSTODIAL, SECURITY, ATHLETIC_DIRECTOR)
  mode: REQUIRED | NOTIFICATION | DISABLED
  assignedTeamId: FK to Team (optional)
  escalationHours: number
  autoApproveIfNoResource: boolean
```

Problem: Fixed 6 channels. Can't add Transportation, Food Services, Campus Ministry. The team dropdown is redundant — if you set "Facilities" to Required, obviously it goes to the Facilities team.

## Proposed Model (V2)

```
ApprovalFlowEntry
  id
  organizationId
  teamId: FK to Team (required — the team IS the channel)
  mode: REQUIRED | NOTIFICATION
  trigger: ALWAYS | WHEN_RESOURCE_REQUESTED
  resourceType: string? (e.g. "av", "facilities", "custodial", "security", "athletic", "transportation")
  escalationHours: number (default 72)
  autoSkipIfNotNeeded: boolean (default true, only relevant when trigger=WHEN_RESOURCE_REQUESTED)
  sortOrder: number (controls gate prerequisite order — lower = must clear first)
  assignedUserId: string? (optional override — specific person instead of whole team)
  campusId: string? (for per-campus overrides, future)
```

Key differences from V1:
- **teamId is required** — the team IS the approval channel, no separate "channelType"
- **No enum** — any team can be an approver
- **trigger field** replaces the implicit channel↔resource mapping
- **sortOrder** replaces the hardcoded "admin goes last" logic
- **assignedUserId** allows specific-person override
- Mode only has 2 values — if a team isn't in the flow, it's "off" (no row exists). No DISABLED rows.

## Resource Types

Need a fixed-ish set of resource types that appear as toggles on the event creation form. These map to `resourceType` on ApprovalFlowEntry.

Current hardcoded ones:
- `av` — Audio/visual equipment
- `facilities` — Physical space setup
- `custodial` — Cleaning and prep
- `security` — Security presence
- `athletic` — Athletic facilities

Could add:
- `transportation` — Buses, vehicles
- `food_service` — Catering, kitchen
- `technology` — IT equipment, projectors
- `custom_1` through `custom_3` — Org-defined

Or: store resource types as a separate config table so orgs can define their own.

## UI Flow

### Config Page

```
Event Approval Flow
When someone creates an event, these teams review it before it's confirmed.

[+ Add Team to Flow]

┌─────────────────────────────────────────────────┐
│ 🛡 Administration          Must Approve | Remove │
│ Trigger: Every event                             │
│ Escalation: 72 hours                             │
│ Person: (entire team)                            │
├─────────────────────────────────────────────────┤
│ 🔧 Facility Maintenance    Must Approve | Remove │
│ Trigger: When event requests → Facilities        │
│ Auto-skip if not needed: On                      │
│ Escalation: 72 hours                             │
├─────────────────────────────────────────────────┤
│ 🎵 A/V Production          Notify Only | Remove │
│ Trigger: When event requests → A/V               │
└─────────────────────────────────────────────────┘

Live preview:
"A new event will need approval from Administration. If it 
requires Facilities, Facility Maintenance must also approve. 
A/V Production will be notified when A/V is needed."
```

### "Add Team" Flow

Click "+ Add Team" → shows teams not already in the flow → pick one → choose:
1. Trigger: "Every event" or "When event requests [resource type]"
2. Mode: "Must Approve" or "Notify Only"

## Gate Builder Changes

Currently `buildApprovalGatesFromConfig` reads `ApprovalChannelConfig` and uses `CHANNEL_TO_GATE` mapping. With V2:

```typescript
async function buildApprovalGatesFromFlow(orgId, needs) {
  const entries = await getApprovalFlowEntries(orgId) // sorted by sortOrder

  const gates = {}
  const notifications = []

  for (const entry of entries) {
    const gateKey = entry.teamId // team ID IS the gate key now

    if (entry.trigger === 'ALWAYS') {
      if (entry.mode === 'REQUIRED') gates[gateKey] = { status: 'PENDING' }
      else notifications.push(entry)
    } else {
      // WHEN_RESOURCE_REQUESTED
      const needed = needs[entry.resourceType]
      if (needed) {
        if (entry.mode === 'REQUIRED') gates[gateKey] = { status: 'PENDING' }
        else notifications.push(entry)
      } else if (entry.autoSkipIfNotNeeded && entry.mode === 'REQUIRED') {
        gates[gateKey] = { status: 'SKIPPED' }
      }
    }
  }
  return { gates, notifications }
}
```

## Gate Key Problem

Currently gate keys are short strings ('admin', 'av', 'facilities'). With team-based gates, the key would be the team UUID. This affects:
- `approvalGates` JSON field on EventProject — keys become UUIDs
- `approve-gate` and `reject-gate` API routes — accept team IDs instead of gate type strings
- `ApprovalGatesBar` UI — needs to look up team name by ID
- `isAdminGateActionable` — "admin goes last" becomes "highest sortOrder goes last"

This is the biggest migration risk. Existing events in PENDING_APPROVAL have gates keyed by 'admin', 'av', 'facilities'. New events would have UUID keys. Need a backward-compat layer or a migration.

## Prerequisite Order

Currently hardcoded: AV + Facilities must clear before Admin. With V2, `sortOrder` defines the order:

```
sortOrder 0: A/V (must clear first)
sortOrder 0: Facilities (must clear first, parallel with A/V)
sortOrder 1: Admin (waits for all sortOrder 0 gates)
```

`isAdminGateActionable` becomes `isGateActionable(gateKey, gates, entries)` — checks if all lower-sortOrder gates are cleared.

## Open Questions

1. **Resource types: fixed list or configurable?** Fixed is simpler. Configurable is more flexible but adds a whole resource type management UI.

2. **Migration path:** How to handle existing events with old-style gate keys? Options:
   a. Dual-read: gate builder writes new format, approval functions read both
   b. One-time migration script: update all PENDING_APPROVAL events to new key format
   c. Keep V1 for existing events, V2 for new — they'll age out naturally

3. **What if a team is deleted?** Remove from flow? Keep as orphan entry? Block deletion if team is in approval flow?

4. **Sort order UI:** Drag-to-reorder the teams in the flow? Or just "this team goes last (final approver)" checkbox?

5. **Per-campus overrides:** Still needed? Or does team membership per campus handle it? (e.g., "Elementary Admin" team only has elementary staff)

## Recommendation

This is the right direction but it's a significant refactor. I'd suggest:

1. **Design the schema first** and get alignment before writing code
2. **Build the migration path** for existing PENDING_APPROVAL events
3. **Ship incrementally** — V2 config page first, then gate builder, then clean up V1

Don't rush this — the V1 we just shipped works. V2 is a better architecture but it touches the core approval engine.
