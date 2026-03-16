# Phase 22: AI, Budget, Notifications, and External Integrations - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can manage event budgets with line-item detail, configure automated notification timelines, use AI to generate event projects/forms/schedules/groups/summaries from natural language, save events as templates with AI-enhanced reuse, and sync events with Planning Center, Google Calendar, and Twilio SMS. Covers requirements BUD-01 through BUD-03, COM-03, AI-01 through AI-11, INT-01 through INT-03.

</domain>

<decisions>
## Implementation Decisions

### Budget UX & tracking
- **Preset + custom categories** — Start with preset categories (venue, transportation, food, supplies, insurance, staffing) that staff can rename, delete, or add custom ones to
- **Quick-add expense entry** — Simple form: amount, category, vendor, date, description, optional receipt photo upload. Low friction — receipts are encouraged but not required
- **Auto + manual revenue** — Registration fee revenue auto-populates from Stripe payment data (Phase 20). Staff manually adds other revenue: sponsorships, fundraising, donations, grants
- **Detailed spreadsheet-style report** — Full line-item table with sorting, filtering, subtotals per category, budgeted vs actual columns. Per-participant cost analysis (total spend / registered count). Data-dense accounting view, not dashboard cards

### Notification orchestration
- **Visual timeline builder** — Horizontal timeline with event date anchored, notification triggers placed as pins before/after. Drag to position, click to configure. Gantt chart lite aesthetic
- **Three trigger types** — Date-based (e.g., "14 days before event"), condition-based (e.g., "if registration not complete 7 days before"), and action-triggered (e.g., "when someone registers", "when a group is assigned")
- **AI auto-draft with editable staff approval** — When a notification is created, AI auto-generates message content based on event context. Staff sees it in an editable preview, can modify the text, and must click "Approve" before it's queued. Nothing sends without human approval
- **Auto-adjust on reschedule** — When an event is rescheduled, all pending notifications automatically recalculate send dates based on new event dates. Relative offsets preserved ("14 days before" stays 14 days before new date). Staff gets a summary of what moved

### AI feature interaction model
- **Chat-style wizard for event creation (AI-01)** — Staff types a natural language description ("3-day camp at Big Bear, 150 kids, June 15-17"). AI fills all fields (title, dates, docs, tasks, budget range) and presents a pre-filled EventProject for review. Staff edits before confirming. Conversational follow-ups to refine
- **Generate-then-edit for forms, schedules, groups (AI-02, AI-03, AI-05)** — AI generates a complete form/schedule/group assignment. Output loads directly into the existing editor (form builder, schedule tab, groups tab). Staff edits freely. AI output is a starting point, not locked
- **Scheduling + logistics conflict detection (AI-04)** — Room/venue double-booking, staff scheduling conflicts, transportation overlaps, audience overlap (same grade has two events). Practical logistics conflicts only — no weather or testing schedule intelligence
- **Budget estimation from history (AI-06)** — AI suggests budget ranges based on historical event data and current event parameters. Feeds into budget preset categories with estimated amounts
- **AI communication drafting (AI-07)** — AI drafts messages with full event context for the notification orchestration system. Uses same Gemini service
- **AI status summaries (AI-08)** — AI generates Overview tab summaries: what's done, what's at risk, what needs attention. Async generation pattern (two-phase fetch like Phase 19 dashboard)
- **AI feedback analysis (AI-09)** — AI analyzes post-event survey responses and surfaces actionable themes. Summary on Overview tab after event completes
- **Save-as-template from any event (AI-10)** — "Save as Template" button on any EventProject. Captures structure (schedule, form, groups, budget categories, notification timeline) but strips dates and participant data. "Create from Template" as an event creation path
- **AI-enhanced template reuse (AI-11)** — When creating from template, AI auto-updates dates relative to new event date, adjusts budget estimates based on current year's costs, and surfaces lessons learned from the source event's feedback

### External integrations
- **Planning Center: full sync, org-level auth (INT-01)** — Admin connects PCO once in Settings (OAuth). Syncs Services (worship schedules, team assignments), People (names, contact info, groups), and Check-ins (attendance records). Two-way for people, one-way push for check-ins
- **Google Calendar: one-way push, per-user OAuth (INT-02)** — Each staff member connects their own Google account via OAuth. Lionheart pushes events to their personal Google Calendar. No changes flow back from Google
- **Twilio SMS: reminders + day-of (INT-03)** — SMS for deadline reminders (registration closing, documents due) AND day-of updates (bus arriving, event delayed, pickup location changed). Org-level Twilio setup in Settings. SMS as opt-in channel alongside email for notifications

### Claude's Discretion
- Exact Prisma schema design for BudgetLine, BudgetCategory, NotificationRule, EventTemplate models
- Visual timeline builder component architecture
- Gemini prompt engineering for all AI features
- Planning Center API pagination and rate limiting strategy
- Google Calendar API scoping and token refresh handling
- Twilio message queuing and delivery tracking
- Conflict detection algorithm (how to query overlapping events efficiently)
- Auto-assign logic for AI group suggestions
- Template diffing logic for AI-enhanced reuse

</decisions>

<specifics>
## Specific Ideas

- Budget report should be spreadsheet-style and data-dense — coordinators want to see everything at a glance, not cards
- Notification timeline should be visual (Gantt-lite), not a boring list of rules
- AI event creation should feel like talking to an assistant, not filling out a form — chat-style wizard
- Google Calendar is per-user (each staff connects their own), Planning Center is org-level (admin connects once)
- SMS is not for everything — reminders and day-of urgent updates only, to keep costs reasonable

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GeminiService` (`src/lib/services/ai/gemini.service.ts`): Gemini 2.0 Flash client with event parsing and description generation — extend for all AI-01 through AI-11 features
- `AI assistant infrastructure` (`src/lib/services/ai/`): Tool definitions, context assembly, conversation service, action handlers — chat-style wizard can leverage this
- `notificationService.ts`: Bulk notification creation with type preferences and pause support — orchestration layer builds on top
- `emailService.ts` + `registrationEmailService.ts`: Resend-backed email delivery — notification orchestration uses as delivery channel
- `EventBudgetTab.tsx`: Placeholder stub ready to replace with full budget UI
- `FormBuilder` + `RegistrationForm`: Complete form builder — AI-02 generates data that feeds into existing builder
- `EventGroupService` + group assignment UI: Phase 21 DnD groups — AI-03 generates assignments that populate existing UI
- `Supabase Storage` + `storageService.ts`: File uploads for receipt photos
- `googleAdminService.ts`: Existing Google API integration pattern (admin directory) — reference for Google Calendar OAuth flow

### Established Patterns
- Two-phase AI fetch: `?skipAI=true` for immediate display, then full AI scoring as second query (Phase 19 dashboard)
- EventProject tabbed sections — Budget tab is stub, Comms tab exists with announcements
- Org-scoped models with `runWithOrgContext` pattern for all new models
- Public API routes resolve orgId from shareSlug lookup (Phase 20)
- TanStack Query for data fetching with optimistic updates
- Framer Motion animations with `fadeInUp`, `staggerContainer` patterns

### Integration Points
- `EventProjectTabs.tsx`: Budget tab stub to replace, Comms tab to extend with notification timeline
- `EventProject` model: Needs relations to BudgetLine, NotificationRule, EventTemplate
- `Settings` page: New "Integrations" tab for PCO org-level auth, Twilio config; Google Calendar in user profile
- `Event creation paths`: Chat-style AI wizard as a fourth entry path alongside planning season, series, and direct request
- `Stripe webhook` + `paymentService`: Revenue auto-population pulls from existing payment records

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-ai-budget-notifications-and-external-integrations*
*Context gathered: 2026-03-15*
