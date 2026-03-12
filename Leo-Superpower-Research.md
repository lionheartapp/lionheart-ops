# Making Leo Super Powerful: Research & Architecture Plan

## Executive Summary

Leo is currently a **read-heavy, single-action assistant** — great at analytics, search, and drafting one thing at a time. To make Leo "super powerful," we need two upgrades:

1. **Full CRUD** — Leo can create, read, update, and delete anything in the system
2. **Autonomous Workflows** — Leo can chain multiple actions into intelligent sequences ("set up a new school year," "onboard a new teacher," "prepare campus for an event")

This document covers what exists today, what's missing, the architectural changes needed, and a concrete implementation roadmap.

---

## Part 1: Where Leo Stands Today

### Current Tool Count: 18

| Category | Tools | Can Create? | Can Update? | Can Delete? |
|----------|-------|-------------|-------------|-------------|
| Maintenance Tickets | 5 | Draft only | Status only | No |
| IT Tickets | 1 | Draft only | No | No |
| Events | 1 | Draft only | No | No |
| Analytics | 2 | — | — | — |
| Search & Lookup | 5 | — | — | — |
| Availability | 3 | — | — | — |
| Weather | 1 | — | — | — |

### How the Tool Loop Works

Leo already has a **multi-turn iterative loop** — Gemini can call tools, see results, and call more tools, up to 8 iterations. This is the foundation for autonomous workflows. The loop works like this:

```
User message → Gemini thinks → calls tool(s) → sees results → thinks again → calls more tools → ... → final text response
```

The critical limitation: **every write operation stops the loop** and emits a confirmation card to the UI. The user must click "Confirm" before anything actually happens, and after confirmation the loop doesn't automatically resume.

---

## Part 2: Full CRUD — What's Missing

### Services That Exist but Have No Leo Tool

This is the gap analysis — every service in the platform that Leo can't touch today.

#### Maintenance Domain (Highest Priority)
- **Claim ticket** — user claims a ticket for themselves
- **Full assignment** — assign to any user (current tool is limited)
- **Add comments** — no tool to add or read ticket comments
- **Add attachments/photos** — no tool for completion photos or file attachments
- **Delete/archive tickets** — no removal capability
- **Preventive maintenance scheduling** — entire PM system is invisible to Leo

#### IT Domain
- **Read IT tickets** — Leo can create them but can't read them back
- **IT ticket status transitions** — no workflow movement
- **IT ticket comments** — no add or read
- **Device assignment** — can't assign/unassign devices to students
- **Device repair logging** — can view history but can't create repair records
- **Loaner checkout/checkin** — analytics exist but no transactional tools
- **Bulk device import** — can't import fleet data

#### Event Domain
- **Update events** — can draft new ones but can't modify existing
- **Cancel events** — no cancellation tool
- **Approval workflow** — can't approve, reject, or submit events
- **Attendee management** — can't add or remove attendees
- **Resource requests** — model exists but no Leo tool

#### Inventory Domain
- **Full CRUD** — can check stock but can't create, update, or delete items
- **Checkout/checkin** — no transactional tools
- **AV equipment management** — entire subsystem is invisible to Leo
- **Low-stock alert management** — can't set thresholds

#### Campus & Facilities Domain
- **Building CRUD** — can lookup but not create, edit, or delete
- **Area management** — completely invisible
- **Room CRUD** — can lookup but not create, edit, or delete

#### User & Organization Domain
- **User management** — can't invite, update, or deactivate users
- **Team membership** — can't add or remove users from teams
- **Role changes** — can't change user roles
- **Student management** — entire student service has zero Leo tools

#### Communication & Notifications
- **Send notifications** — platform has a notification service but Leo can't trigger it
- **Send emails** — email service exists but not exposed to Leo

#### Reporting & Compliance
- **Board reports** — services exist for both IT and general board reports
- **Academic calendar** — full calendar service, no Leo access
- **Compliance tracking** — full service, not exposed
- **Data export** — can't export tickets, events, or any data

### Proposed New Tools (46 tools to reach full CRUD)

#### Maintenance (6 new)
1. `claim_maintenance_ticket` — claim for current user
2. `add_ticket_comment` — add comment to any ticket
3. `list_ticket_comments` — read comments on a ticket
4. `update_maintenance_ticket` — edit title, description, category, priority, location
5. `delete_maintenance_ticket` — soft-delete (archive)
6. `create_pm_schedule` — schedule preventive maintenance

#### IT (7 new)
7. `list_it_tickets` — read IT tickets with filters
8. `get_it_ticket_details` — detailed single ticket view
9. `update_it_ticket_status` — move through workflow states
10. `add_it_ticket_comment` — comment on IT tickets
11. `assign_device` — assign device to student/staff
12. `log_device_repair` — create repair record
13. `checkout_loaner` / `checkin_loaner` — loaner management

#### Events (5 new)
14. `update_event` — modify existing event details
15. `cancel_event` — cancel with reason
16. `submit_event_for_approval` — push draft to approval chain
17. `approve_event` / `reject_event` — approval actions
18. `manage_event_attendees` — add/remove attendees

#### Inventory (5 new)
19. `create_inventory_item` — add new item to inventory
20. `update_inventory_item` — edit item details
21. `delete_inventory_item` — soft-delete
22. `checkout_inventory` — check out items (create transaction)
23. `checkin_inventory` — return items

#### Campus (6 new)
24. `create_building` — add building to campus
25. `update_building` — edit building details
26. `delete_building` — soft-delete
27. `create_room` — add room to building/area
28. `update_room` — edit room details
29. `delete_room` — soft-delete

#### Users & Teams (6 new)
30. `invite_user` — send invite to new org member
31. `update_user` — edit user profile/role
32. `deactivate_user` — soft-delete user
33. `add_user_to_team` — team membership
34. `remove_user_from_team` — team membership
35. `change_user_role` — role assignment

#### Students (3 new)
36. `list_students` — search/filter students
37. `create_student` — add new student
38. `update_student` — edit student details

#### Communication (2 new)
39. `send_notification` — push notification to user(s)
40. `send_email` — send email via Resend

#### Reporting (4 new)
41. `generate_board_report` — create board report
42. `view_academic_calendar` — read calendar entries
43. `export_data` — export tickets/events/inventory as CSV
44. `view_audit_log` — read recent changes

#### Analytics Expansion (2 new)
45. `query_custom_analytics` — flexible query builder for any domain
46. `compare_periods` — period-over-period comparison

---

## Part 3: Autonomous Workflows — Architecture

### The Core Problem

Today, Leo's loop **stops at every write operation** to ask for confirmation. For autonomous workflows, we need Leo to be able to chain multiple operations — but we also need to keep users in control.

### Design Pattern: "Plan → Approve → Execute"

The best pattern for Leo is inspired by how modern AI agents work. Instead of confirming each step individually, Leo should:

1. **Plan** — analyze the request, figure out all the steps needed
2. **Present the plan** — show the user a summary of everything Leo will do
3. **Execute on approval** — run all steps in sequence after one confirmation

This is the "maker-checker" pattern from enterprise software, adapted for AI.

#### Example: "Onboard a new teacher"

```
User: "Onboard Sarah Johnson as a 3rd grade teacher at Lincoln Elementary"

Leo thinks → builds a plan:
  1. Create user account (sarah.johnson@school.org, role: member)
  2. Add to "Teachers" team
  3. Assign to Lincoln Elementary school
  4. Assign to Room 204 (3rd grade classroom)
  5. Create teacher schedule template
  6. Send welcome email with password setup link

Leo presents:
  "Here's my plan for onboarding Sarah Johnson:
   [Plan Card with all 6 steps listed]
   [Approve All] [Edit Plan] [Cancel]"

User clicks [Approve All]

Leo executes all 6 steps sequentially, reporting progress:
  ✅ Created user account
  ✅ Added to Teachers team
  ✅ Assigned to Lincoln Elementary
  ✅ Assigned to Room 204
  ✅ Created schedule template
  ✅ Sent welcome email
  "Sarah is all set! She'll receive a welcome email shortly."
```

### Architecture Changes Required

#### 1. Workflow Engine (New: `assistant-workflows.ts`)

A new module that defines reusable workflow templates:

```typescript
interface WorkflowStep {
  tool: string           // which tool to call
  params: Record<string, any>  // parameters (can reference prior step results)
  label: string          // human-readable description
  rollback?: string      // tool to call if this step fails (optional)
  dependsOn?: string[]   // step IDs this depends on
}

interface WorkflowPlan {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  approvalRequired: boolean  // always true for destructive ops
  estimatedDuration: string
}
```

Leo can either use a **predefined workflow template** or **dynamically compose** a plan from available tools.

#### 2. Batch Confirmation (New SSE Event: `workflow_plan`)

Instead of one confirmation per tool call, emit a single `workflow_plan` event containing all steps. The UI renders a plan card with:
- Numbered list of all steps
- Expected outcomes
- "Approve All" / "Edit" / "Cancel" buttons
- Risk level indicator (low/medium/high based on destructive operations)

#### 3. Workflow Executor (New: `/api/ai/assistant/execute-workflow`)

A new endpoint that:
- Receives the approved plan
- Executes steps sequentially inside a database transaction (where possible)
- Streams progress updates via SSE (`step_complete`, `step_failed`, `workflow_done`)
- Supports rollback if a step fails mid-workflow
- Reports final summary to Gemini conversation for context continuity

#### 4. Gemini System Prompt Updates

Add workflow awareness to Leo's system prompt:

```
When a user request involves multiple related actions, create a WORKFLOW PLAN
instead of executing tools one by one. Use the plan_workflow tool to propose
all steps at once. The user will approve or modify the plan before execution.

Available workflow templates:
- onboard_teacher: Create user → assign team → assign school → assign room → create schedule → send email
- prepare_event: Check room → create event → request resources → notify attendees → create setup ticket
- new_school_year: Archive old events → reset schedules → create calendar → assign rooms → notify staff
- campus_setup: Create building → create areas → create rooms → assign equipment
- bulk_ticket_resolution: Find tickets by criteria → update statuses → add comments → notify reporters
```

#### 5. Context Persistence

For workflows that span multiple confirmations or long conversations:
- Store workflow state in a `WorkflowExecution` table (or in-memory for MVP)
- Allow Leo to reference prior workflow results ("the teacher I just onboarded")
- Increase conversation context limit from 20 to 40 turns for workflow sessions

### Risk Tiers for Autonomous Actions

Not all actions need the same level of approval:

| Tier | Actions | Approval |
|------|---------|----------|
| **Green (Auto)** | Read, search, analytics, check availability | No confirmation needed |
| **Yellow (Notify)** | Create draft, add comment, send notification | Execute immediately, notify user |
| **Orange (Confirm)** | Create records, update status, assign users | Single confirmation |
| **Red (Plan)** | Multi-step workflows, delete, role changes, bulk ops | Full plan approval |

This tiered approach lets Leo move fast on low-risk actions while keeping humans in the loop for anything significant.

---

## Part 4: Gemini Capabilities That Enable This

### What Gemini 2.0 Flash Already Supports

Leo is well-positioned because Gemini 2.0's function-calling is mature:

- **Multi-turn tool loops** — already implemented (max 8 iterations)
- **Parallel function calls** — Gemini can request multiple tools in a single turn
- **Structured output** — can return JSON workflow plans
- **Thinking/reasoning** — Gemini 2.5+ models have internal "thinking" that improves tool selection
- **Large context** — can hold conversation + tool results for complex workflows

### Recommended Model Upgrade Path

For more complex autonomous workflows, consider:
- **Gemini 2.5 Flash** — better reasoning for plan generation, similar speed/cost to 2.0
- **Gemini 2.5 Pro** — for the most complex workflows that need deep reasoning (use selectively via model routing)

### Parallel Tool Execution

Gemini can request multiple tools in a single turn. Leo's chat route already handles this — when Gemini returns multiple `functionCall` parts, they could be executed in parallel rather than sequentially. This is a quick win for performance.

---

## Part 5: Suggested Workflow Templates

Here are the highest-value autonomous workflows for a school operations platform:

### 1. Teacher Onboarding
**Trigger:** "Onboard [name] as a [grade] teacher at [school]"
**Steps:** Create user → assign role → add to Teachers team → assign to school → assign classroom → create schedule → send welcome email

### 2. Event Preparation
**Trigger:** "Prepare for [event name] on [date] in [location]"
**Steps:** Check room availability → create event → request AV equipment → request facilities setup → create maintenance ticket for room prep → notify attendees → create setup checklist

### 3. New School Year Setup
**Trigger:** "Set up [year] school year"
**Steps:** Archive previous year's events → reset teacher schedules → create academic calendar → verify room assignments → create welcome-back event → generate status report

### 4. Campus Expansion
**Trigger:** "Add [building] with [N] rooms to campus"
**Steps:** Create building → create areas → create rooms with capacities → assign default equipment → update campus map → notify facilities team

### 5. Incident Response
**Trigger:** "We have a [type] emergency in [location]"
**Steps:** Create URGENT ticket → auto-assign to on-call technician → notify building occupants → check for affected events → create follow-up inspection ticket → notify administration

### 6. Bulk Ticket Management
**Trigger:** "Close all completed maintenance tickets from last month"
**Steps:** Query tickets by criteria → generate summary → update statuses → add closing comments → notify reporters → generate completion report

### 7. End-of-Day Report
**Trigger:** "Give me the end-of-day summary"
**Steps:** Query today's ticket activity → query event changes → check overdue tickets → check tomorrow's events → check low inventory → compile and present report

### 8. Staff Role Change
**Trigger:** "Promote [user] to admin"
**Steps:** Look up user → change role → clear permission cache → update team memberships if needed → send notification → log change

---

## Part 6: Implementation Roadmap

### Phase 1: Full CRUD Tools (2-3 weeks)
Add the 46 new tools, organized by domain. Each tool follows the existing pattern: permission check → draft with confirmation → execute on confirm.

**Priority order:**
1. Maintenance full CRUD (most used)
2. Event full CRUD (second most used)
3. User/team management (admin workflows)
4. Campus CRUD (setup workflows)
5. Inventory CRUD
6. IT full CRUD
7. Student management
8. Communication tools
9. Reporting/export tools

### Phase 2: Risk-Tiered Confirmation (1 week)
Implement the Green/Yellow/Orange/Red tier system so low-risk actions don't require confirmation. This alone makes Leo feel dramatically more capable.

### Phase 3: Workflow Planner (2 weeks)
- Add `plan_workflow` tool that Gemini can call to propose multi-step plans
- Build `WorkflowPlan` UI component (plan card with approve/edit/cancel)
- Build workflow executor endpoint with progress streaming
- Add 3-4 predefined workflow templates

### Phase 4: Dynamic Workflow Composition (2 weeks)
- Let Gemini dynamically compose workflows from available tools
- Add rollback support for failed mid-workflow steps
- Increase context window for workflow sessions
- Add workflow history (user can see past workflows and re-run them)

### Phase 5: Intelligence Upgrades (Ongoing)
- Upgrade to Gemini 2.5 Flash for better reasoning
- Add model routing (use 2.5 Pro for complex plans, Flash for simple actions)
- Add learning from workflow outcomes (which plans succeed/fail)
- Add proactive suggestions ("I notice 15 tickets are overdue — want me to create a bulk update plan?")

---

## Part 7: Key Architectural Decisions

### Decision 1: Workflow State — Database vs. In-Memory

**Recommendation: Start in-memory, migrate to database.**

For MVP, workflow plans can live in the SSE session. For production, add a `WorkflowExecution` table to track plans, approvals, step completion, and rollbacks. This also enables workflow history and re-running past workflows.

### Decision 2: Transaction Boundaries

**Recommendation: Per-step transactions with compensating actions.**

Wrapping an entire workflow in one database transaction is fragile (long-held locks, timeout risk). Instead, each step commits independently, and failed steps trigger compensating actions (e.g., if "assign to team" fails after "create user" succeeded, the user still exists but Leo reports the partial failure and suggests a fix).

### Decision 3: Confirmation UX

**Recommendation: Batch plan approval with step-level detail.**

Show all steps in one card. Let users approve all, edit individual steps, or cancel. After approval, stream step-by-step progress. This is the sweet spot between "confirm everything individually" (too slow) and "just do it all" (too risky).

### Decision 4: Permission Escalation

**Recommendation: Leo inherits the requesting user's permissions, never escalates.**

If a workflow includes a step the user doesn't have permission for, Leo should flag it in the plan: "Step 4 requires admin permissions — you'll need an admin to approve this step." Never silently skip or escalate.

---

## Sources

- [Google Gemini Tools & Agents Documentation](https://ai.google.dev/gemini-api/docs/tools)
- [Google Gemini Function Calling Guide](https://ai.google.dev/gemini-api/docs/function-calling)
- [Microsoft AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Agentic AI Workflow Patterns for Enterprises (Dextra Labs)](https://dextralabs.com/blog/ai-agentic-workflow-patterns-for-enterprises/)
- [LLM Orchestration Frameworks 2026 (AI Multiple)](https://research.aimultiple.com/llm-orchestration/)
- [Practical Guide for Production-Grade Agentic AI (arXiv)](https://arxiv.org/html/2512.08769v1)
- [Google ADK Multi-Agent Patterns (Google Developers Blog)](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [Evaluating AI Agents at Amazon (AWS Blog)](https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/)
