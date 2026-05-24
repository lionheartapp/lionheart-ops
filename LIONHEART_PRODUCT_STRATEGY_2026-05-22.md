# Lionheart Product Strategy

Date: 2026-05-22

This is my opinionated read after looking through the code, product docs, pricing docs, marketing notes, and the live-site audit.

Short version:

Lionheart is already much more than a school ops app. It is trying to become the operating system for the non-classroom work of a K-12 school.

What it should become is simpler to say:

Lionheart should be the place a school opens every morning to see what needs attention, who owns it, and what happens next.

## What Lionheart Is Today

Lionheart is a pre-launch K-12 operations platform with a very large product surface.

It already includes these major products:

1. Identity, schools, campuses, buildings, rooms, teams, roles, and permissions.
2. Calendar and planning.
3. Event operations: approvals, tasks, templates, registration, check-in, surveys, docs, budget, and day-of workflows.
4. Maintenance: work orders, assets, preventive maintenance, compliance, knowledge base, and board reports.
5. IT operations: tickets, devices, students, loaners, deployment, provisioning, MDM, roster sync, eRate, content filters, and security incidents.
6. Forms: system forms, custom forms, submissions, QR/public workflows, approvals, and form-backed tickets/orders.
7. Messaging: staff channels, DMs, search, presence, and operational chat.
8. Athletics: teams, schedules, rosters, stats, brackets, public pages, and conferences.
9. Platform admin: billing, tenant modules, support, impersonation, and multi-org control.
10. Leo AI: a permission-aware tool layer that can read and act across modules.

That is not "a ticketing app."

That is also not "an events app."

It is a school operations graph.

The strongest part of the product is the shared data model. A school, room, user, team, calendar, event, ticket, device, form, and message can all point at the same operational reality.

That is the moat.

## What The Code Says

The product intent doc already says the right thing:

Lionheart should replace the 5 to 10 disconnected tools a school glues together to run IT, facilities, events, athletics, and communication.

See [PRODUCT_INTENT.md](/Users/mkerley/Desktop/Linfield%20Test/PRODUCT_INTENT.md:7).

The north star is also right:

Make running a school feel like operating one product.

See [PRODUCT_INTENT.md](/Users/mkerley/Desktop/Linfield%20Test/PRODUCT_INTENT.md:17).

The current code mostly supports that vision.

The mobile tab bar already understands that mobile should be a daily-work surface, not a shrunken admin app. It gives everyone Dashboard, Calendar, Messages, one role-based action tab, and More.

See [MobileTabBar.tsx](/Users/mkerley/Desktop/Linfield%20Test/src/components/mobile/MobileTabBar.tsx:77).

The AI tool registry is also strategically important. Leo is not just a chat box. It filters tools by permission and assigns risk tiers before actions run.

See [src/lib/services/ai/tools/_registry.ts](/Users/mkerley/Desktop/Linfield%20Test/src/lib/services/ai/tools/_registry.ts:66).

That means Lionheart can become an AI-assisted operations layer without ignoring school permissions or safety.

The dashboard shows the same thing, but also the risk. It imports and coordinates many domains at once: calendar, events, maintenance, forms, weather, planning, tasks, notifications, and permissions.

See [dashboard/page.tsx](/Users/mkerley/Desktop/Linfield%20Test/src/app/(app)/dashboard/page.tsx:22).

That makes the dashboard the natural center of the product. It also makes it easy for the dashboard to become too busy.

## My Plain-English Diagnosis

Lionheart has the right raw ingredients.

The risk is that it can look like "a lot of modules" instead of "one calm place to run the school."

That distinction matters.

Schools do not buy modules.

They buy relief.

They buy:

- "I know what is happening today."
- "I know what is blocked."
- "I know who owns it."
- "I know parents and staff got the right update."
- "I can prove we did the required work."
- "I do not need another spreadsheet."

Lionheart should make those feelings obvious within 30 seconds.

## What Lionheart Should Be

Lionheart should become:

The K-12 operations command center for schools that are tired of running the day from calendars, inboxes, spreadsheets, and disconnected ticket systems.

Another version:

Lionheart is the daily operating system for school operations. It connects calendars, requests, approvals, facilities, IT, forms, communication, and AI into one place where staff can see the day, fix problems, and keep everyone aligned.

The core promise should be:

Know what needs attention before it becomes a problem.

That is stronger than "all-in-one platform."

## The Real Product Architecture

The product should be framed in five layers.

1. School Graph

Organizations, schools, campuses, buildings, rooms, users, teams, roles, permissions, calendars.

This is the foundation.

2. Work Engine

Tasks, tickets, approvals, routing, notifications, audit trails, status changes.

This is how work moves.

3. Operational Objects

Events, work orders, IT tickets, devices, assets, forms, registrations, messages, schedules.

These are the things schools manage.

4. Intelligence Layer

Leo reads the graph, notices conflicts, suggests next steps, and performs safe actions.

This is the daily differentiator.

5. Public Layer

Public event pages, registrations, athletics pages, forms, QR codes, magic links.

This is how parents, students, substitutes, and community users touch the system without needing full accounts.

## What Should Be Core

The core paid product should focus on the daily operating loop.

Core:

- Dashboard / Today view
- Unified calendar
- Requests and tickets
- Event planning and approvals
- Maintenance work orders
- IT tickets
- Forms
- Messaging notifications
- Leo summaries and conflict detection
- Multi-school context
- Reporting / audit trails

These are connected. They make each other more valuable.

## What Should Be Add-On

These should stay powerful, but they should not dominate the first story:

- Athletics
- Registration and payments
- IT fleet manager
- Security and compliance
- Premium support
- Advanced AI diagnostics
- Conference/league management

They are valuable. But they should be positioned as expansion paths, not the main explanation.

If you lead with every module, the product feels huge.

If you lead with the daily operating loop, the modules make sense.

## The Product Wedge

The wedge should be:

Calendar plus requests plus approvals plus Leo.

That is the part that can feel magical.

Example:

A principal opens Lionheart on Monday morning.

Lionheart shows:

- Thursday gym conflict.
- A/V approval waiting on the spring concert.
- Roof inspection due in 9 days.
- 18 missing field trip forms.
- Three IT tickets blocking classrooms.
- One parent registration payment failed.

Leo says what needs attention and offers safe actions.

That is the story.

Everything else supports that story.

## The Website Should Say This

The current marketing site undersells the product and also risks sounding generic.

The homepage should not say "manage events, IT, facilities, forms, messaging, and more" as the main idea.

It should say something closer to:

Run the school day from one calm operating view.

Then prove it with real school scenarios:

- Morning assembly moved to the gym.
- Wi-Fi outage in east wing.
- Field trip forms due tomorrow.
- Room leak assigned to maintenance.
- Volleyball game conflicts with parent night.
- Board report needs IT and facilities numbers.

That will feel less AI-generated because it is specific.

The product is strongest when the copy sounds like it was written by someone who has stood in a school office at 7:42 AM.

## The UX Should Move Toward "Today"

The app should make Dashboard and Calendar feel like one mental model.

Today should answer:

- What is happening?
- What changed?
- What is blocked?
- What needs my approval?
- What is assigned to me?
- What did Leo notice?

Then every module should feel like a drill-down from Today.

Do not make users think:

"Which module has this?"

Make them think:

"This needs attention. I can act from here."

## What To Tighten First

1. Make the Dashboard the true daily command center.

It should be calmer. Fewer equal-weight widgets. More ranked attention.

Top of page:

- Today
- Needs attention
- My work
- Upcoming

Leo should surface concrete observations, not generic AI copy.

2. Make Calendar the product spine.

The calendar should not just show events. It should show operational pressure:

- Room conflicts
- Approval blockers
- PM/compliance due dates
- Event setup tasks
- Athletics overlays
- Public registration deadlines

3. Make Approvals universal.

Right now approvals are mostly event facilities/A/V approvals. The product wants approvals everywhere: forms, events, maintenance, IT exceptions, registrations, budget, publishing.

One unified approvals queue would make the platform feel more like one product.

4. Simplify navigation.

The sidebar is already role-aware, but it still risks feeling like many products. Keep top-level navigation close to:

- Dashboard
- Calendar
- Work
- Messages
- Forms
- Reports
- Settings

Then use role/context to expose IT, Maintenance, Events, Athletics inside Work or as contextual hubs.

5. Make Leo an operations analyst.

Do not position Leo as "ask me anything."

Position it as:

- Finds conflicts.
- Drafts updates.
- Summarizes blockers.
- Suggests owners.
- Builds reports.
- Creates safe actions with confirmation.

The permission/risk-tier code already supports this direction.

6. Pick three golden journeys.

Before adding more breadth, make these excellent:

- Principal Monday morning
- Event planned end-to-end
- IT director weekly operations review

Those are the sales demos.

Those are also the QA scripts.

## What Not To Do

Do not become a generic school portal.

Do not become an SIS.

Do not become an LMS.

Do not become a website builder.

Do not sell "AI" as the product.

Do not let every module invent its own layout, empty states, buttons, tables, and form styling.

Do not ship a homepage that looks like it was prompted from "modern SaaS landing page."

The whole product wins or loses on trust.

Trust comes from calm, specificity, and consistency.

## Biggest Strategic Risk

The biggest risk is not that Lionheart lacks features.

The biggest risk is that it has too many features before the main story is obvious.

If a buyer sees ten modules, they compare each module to the best single-purpose tool.

That is a bad fight.

If a buyer sees one school operations command center, they compare Lionheart to the mess they live in today.

That is the right fight.

## My Recommended Now / Next / Later

### Now

Fix trust and sharpen the story.

- Fix current typecheck failures.
- Update the live homepage metadata and server-rendered homepage content.
- Replace generic marketing copy with school-day specifics.
- Make Dashboard/Calendar/Approvals the core demo path.
- Reduce visual and copy clutter in the homepage.
- Audit the first-run experience for a principal, IT director, and maintenance lead.
- Make sure public forms and registration flows feel polished.

### Next

Make the product feel unified.

- Create a true "Today" model that ranks attention across modules.
- Unify approval concepts across events, forms, maintenance, IT, and registration.
- Make Leo produce daily operational briefs.
- Standardize page headers, empty states, skeletons, tables, drawers, and forms.
- Tighten mobile around daily actions only.
- Build the board-report and compliance story around real data.

### Later

Expand the moat.

- Deeper district rollups.
- More integrations.
- Advanced analytics.
- Configurable workflows.
- Broader athletics/conference tools.
- More parent/public surfaces.
- More AI actions, with strong audit and permission controls.

## Best Positioning

Use this as the internal positioning:

Lionheart is the operations command center for K-12 schools. It connects the daily work of events, facilities, IT, forms, approvals, communication, and reporting so staff can run the day from one place instead of stitching together calendars, inboxes, spreadsheets, and point tools.

Use this as the sharper homepage idea:

Run the school day before it runs you.

Support it with:

One view for calendars, requests, approvals, facilities, IT, forms, and the work Leo thinks you should see next.

## Final Take

Lionheart is a very real product. The code proves it.

It has depth in places most SaaS landing pages only pretend to have.

But the product needs discipline now.

The next step is not "add more."

The next step is to make the whole thing feel inevitable:

A school opens Lionheart every morning because it is the fastest way to know what is happening, what is blocked, and what to do next.

