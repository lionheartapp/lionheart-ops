# Phase 29: Auto-Channels, System Bot, and Integrations - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults selected)

<domain>
## Phase Boundary

Teams and schools get auto-created messaging channels with synced membership, and a system bot posts updates when tickets change status, events are approved, or maintenance alerts fire. Auto-channel headers display source context with links back.

Requirements: INT-01 through INT-04.

</domain>

<decisions>
## Implementation Decisions

### Team Auto-Channels (INT-01)
- **D-01:** When a Team is created, an auto-channel is created with type=PUBLIC, name matching the team name, and a `sourceType: 'team'` + `sourceId: teamId` metadata field on the Channel model.
- **D-02:** All current team members are added as ChannelMembers. When a user is added/removed from a team (UserTeam create/delete), their channel membership is synced automatically.
- **D-03:** Sync happens via a server-side function called from the team membership API routes (POST/DELETE /api/settings/teams/[id]/members). Not a database trigger — keeps logic in the app layer.

### School Auto-Channels (INT-02)
- **D-04:** Each School in a multi-school org gets an auto-created staff channel. Name: "{School Name} Staff". sourceType: 'school', sourceId: schoolId.
- **D-05:** Membership tracks school assignment — users with a schoolId matching the school are auto-added. When a user's school assignment changes, their channel membership updates.
- **D-06:** Sync triggered from user update API routes when schoolId changes.

### System Bot (INT-03)
- **D-07:** A system bot user is created per org during seedOrgDefaults (or on first messaging enable). Has a special `isBot: true` flag on User. Name: "Lionheart Bot", avatar: platform logo.
- **D-08:** Bot posts messages to relevant auto-channels when: ticket status changes (to the team's channel), event is approved (to the school's channel or a general channel), maintenance alert fires (to the maintenance team channel).
- **D-09:** Bot messages have a distinct visual style — different background color, "BOT" badge, no reply/react actions.
- **D-10:** Integration hooks are added to existing services: ticketService (onStatusChange), eventService (onApproval), maintenanceTicketService (onAlert). Each calls a `systemBotService.postToChannel()` function.

### Source Context Display (INT-04)
- **D-11:** Auto-channels show a source context banner in the channel header: "Team: IT Support" or "School: Linfield Christian" with a link back to the source entity's settings page.
- **D-12:** Channel model gets optional `sourceType` (String?) and `sourceId` (String?) fields. These are used to display context and link back. If null, channel is a regular user-created channel.

### Schema Change
- **D-13:** Add `sourceType` (String?) and `sourceId` (String?) to Channel model, and `isBot` (Boolean @default(false)) to User model. Push schema after adding fields.

### Claude's Discretion
- Bot avatar image (use existing platform logo or generate one)
- Exact bot message format for each event type (ticket, event, maintenance)
- Whether to create auto-channels retroactively for existing teams/schools on first enable
- How to handle team/school deletion (archive the auto-channel? keep it?)

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `.planning/REQUIREMENTS.md` — INT-01 through INT-04

### Prior Phase Code
- `src/lib/services/channelService.ts` — createChannel, addMember, removeMember
- `src/lib/services/messageService.ts` — sendMessage (for bot posts)
- `src/app/api/settings/teams/[id]/members/route.ts` — Team member management (hook point)
- `src/lib/services/ticketService.ts` — Ticket status change (hook point)
- `src/lib/services/eventService.ts` — Event approval (hook point)
- `src/lib/services/maintenanceTicketService.ts` — Maintenance alerts (hook point)
- `src/lib/services/organizationRegistrationService.ts` — seedOrgDefaults (bot user creation)
- `prisma/schema.prisma` — Channel model (add sourceType/sourceId), User model (add isBot)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- channelService.createChannel + addMember from Phase 24
- messageService.sendMessage from Phase 24
- seedOrgDefaults pattern from organizationRegistrationService.ts
- Existing team/school CRUD routes (hook points for sync)

### Integration Points
- `prisma/schema.prisma` — Add sourceType, sourceId to Channel; isBot to User
- `src/lib/db/index.ts` — No changes needed (Channel already org-scoped)
- Team member routes — Add auto-channel sync after member add/remove
- Service hooks — Add bot posting to ticket/event/maintenance services
- `src/components/messaging/ChannelHeader.tsx` — Add source context banner

</code_context>

<specifics>
## Specific Ideas

- Auto-channel creation should be idempotent — if channel already exists for that team/school, don't create a duplicate
- Bot messages should include a deep link back to the source entity (ticket, event, etc.)
- Source context banner should use the entity's color/icon if available

</specifics>

<deferred>
## Deferred Ideas

- FERPA audit logging for auto-channels (flagged in roadmap creation — defer to post-v4 compliance review)

</deferred>

---

*Phase: 29-auto-channels-system-bot-and-integrations*
*Context gathered: 2026-05-07 via auto-mode*
