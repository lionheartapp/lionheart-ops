# Phase 23: Schema, Permissions, and RLS Foundation - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

All messaging data models (8 Prisma models), org-scoped client registration, RLS policies for org + channel isolation, messaging permission seeds into default roles, and the messagingEnabled feature gate on Organization. This is the foundation — no API routes, no UI, no Realtime.

</domain>

<decisions>
## Implementation Decisions

### Permission Granularity
- **D-01:** Keep the 6 permissions from REQUIREMENTS.md: channels:create, channels:manage, channels:moderate, messages:delete:any, dms:send, integrations:manage. No extras for now — expandable later.
- **D-02:** Open by default — all roles can create channels and send DMs. Only super-admin and admin get channels:moderate, messages:delete:any, and integrations:manage. Viewers get read-only access (no create/send permissions).

### RLS Policy Approach
- **D-03:** Both layers — keep Prisma org-scoped extension AND add RLS policies on all messaging tables. Belt and suspenders.
- **D-04:** RLS checks both org isolation AND channel membership. A user can only read messages from channels they are a member of, enforced at the database level. This is critical for Phase 25 (Realtime) where the browser connects directly to Supabase.

### messagingEnabled Gating
- **D-05:** Hidden completely when off — no sidebar item, API routes return error, zero trace in UI.
- **D-06:** Default value tied to billing plan — free/trial orgs get messagingEnabled=false, paid orgs get messagingEnabled=true. This makes messaging a paid feature / upgrade incentive.

### Schema Design
- **D-07:** DMs are channels — Channel model has a `type` field (PUBLIC, PRIVATE, DM, GROUP_DM). One unified model, one set of APIs, one search index. Matches Slack/Discord internal pattern.
- **D-08:** Thread replies use parentId on Message — a reply is a regular Message with parentId pointing to the original. Denormalized replyCount on parent message. One table, one query pattern.
- **D-09:** Per-user reaction rows — MessageReaction table with userId + messageId + emoji. Supports "who reacted" display, duplicate prevention, and undo.
- **D-10:** Denormalized unread counter on ChannelMember maintained by database trigger. Sidebar badge reads are cheap number lookups, not COUNT(*) queries.

### Claude's Discretion
- Exact RLS policy SQL syntax and trigger implementation details
- Column types and index strategy beyond what's specified in requirements (tsvector + GIN)
- Migration file structure and ordering
- How the messagingEnabled default interacts with the existing trial/billing code (Stripe integration)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Full v4.0 requirements (SCHEMA-01 through SCHEMA-06 are this phase)
- `.planning/ROADMAP.md` §Phase 23 — Success criteria and dependency chain

### Existing Code (modify these)
- `prisma/schema.prisma` — Add 8 messaging models here
- `src/lib/db/index.ts` — Register messaging models in orgScopedModels and softDeleteModels Sets
- `src/lib/permissions.ts` — Add PERMISSIONS constants and update DEFAULT_ROLES

### Patterns to Follow
- `src/lib/org-context.ts` — AsyncLocalStorage pattern for org propagation
- `src/lib/services/organizationRegistrationService.ts` — seedOrgDefaults pattern for permission seeding

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orgScopedModels` Set in `src/lib/db/index.ts` — add all 8 messaging models here for automatic org-scoping
- `softDeleteModels` Set in `src/lib/db/index.ts` — add Channel, Message, and any other soft-deleteable messaging models
- `PERMISSIONS` object in `src/lib/permissions.ts` — established pattern for adding new permission constants
- `DEFAULT_ROLES` in `src/lib/permissions.ts` — established pattern for mapping permissions to roles
- `seedOrgDefaults()` in `organizationRegistrationService.ts` — handles permission/role seeding on org creation

### Established Patterns
- Prisma client extension auto-injects organizationId on create and filters on read
- Soft-delete via deletedAt timestamp, transparent to callers
- Permission format: `resource:action` or `resource:action:scope`
- Organization model already has feature flags (aiEnabled, mfaRequired) — messagingEnabled follows the same pattern

### Integration Points
- `prisma/schema.prisma` — new models added here
- `src/lib/db/index.ts` — register models in both Sets
- `src/lib/permissions.ts` — add constants and role mappings
- Supabase dashboard — RLS policies created via migration SQL
- Database triggers — unread counter and tsvector population

</code_context>

<specifics>
## Specific Ideas

- Channel type enum: PUBLIC, PRIVATE, DM, GROUP_DM — unified model, not separate tables
- messagingEnabled as a billing-plan-gated feature, not a manual admin toggle (though admins can override)
- Unread counter trigger fires on Message INSERT, decrements on channel read (lastReadAt update)
- RLS must be testable with two different org JWTs as stated in SCHEMA-02

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-schema-permissions-and-rls-foundation*
*Context gathered: 2026-05-07*
