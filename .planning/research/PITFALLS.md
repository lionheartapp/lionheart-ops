# Pitfalls Research

**Domain:** K-12 School Event Planning — Adding to Existing Multi-Tenant SaaS
**Researched:** 2026-03-14
**Confidence:** HIGH (multi-tenant security, Stripe webhooks, data model migration, FERPA/COPPA), MEDIUM (PWA conflict resolution, notification scheduler), HIGH (magic link security, PDF generation constraints)

---

## Critical Pitfalls

### Pitfall 1: Public Pages Break Multi-Tenant Isolation

**What goes wrong:**
When the first public-facing pages are added to an entirely staff-facing SaaS platform, every API call on those pages executes without an authenticated `organizationId` in the JWT. The existing `runWithOrgContext` pattern was built assuming an authenticated user always provides org context. Public event pages must resolve org from a URL slug — if that resolution is not explicitly enforced at the API layer, a crafted request can fetch another org's event data by supplying a different `organizationId` in the query string or skipping org validation entirely.

A secondary form: cache poisoning. If any response is cached at the CDN or Next.js layer without tenant-keyed cache keys, Org A's branded event page can be served to a visitor navigating to Org B's URL.

**Why it happens:**
The existing `getOrgIdFromRequest` reads from the `x-org-id` header injected by middleware from the JWT. On public routes that bypass middleware, that header is absent. Developers add a special case ("get org from slug") but forget to apply it consistently across every public API endpoint. Background jobs, exports, and search/autocomplete endpoints are the most common places the fix is missing.

**How to avoid:**
- Create a separate `getPublicOrgId(req, slug)` utility that resolves org exclusively from the verified URL slug, never from a client-supplied header or query param.
- Public API routes must be in a separate namespace (`/api/public/[slug]/...`) with its own middleware that enforces slug-to-org resolution before any handler runs.
- Never trust an `organizationId` value that arrives from the client on a public route — always derive it server-side from the slug.
- Cache keys for any public-facing rendered content must include the org slug as a prefix.
- Audit: call a public event API with a different org's slug — it must 404 or return only that org's data.

**Warning signs:**
- Any public API route that calls `getOrgIdFromRequest` (designed for authenticated routes) instead of a slug-based resolver.
- Any Next.js `fetch` with `{ cache: 'force-cache' }` on a public event endpoint without a tenant-keyed cache key.
- A search or autocomplete endpoint on the public page that does not filter by `orgId` at the DB layer.

**Phase to address:**
Phase — Public Pages & Registration (first phase that introduces public routes). Must be the foundational constraint before any public endpoint is written.

---

### Pitfall 2: Stripe Webhook Double-Processing

**What goes wrong:**
Stripe retries webhook delivery for up to 72 hours whenever an endpoint returns a non-2xx response (including timeouts). If the handler is not idempotent, a network hiccup during DB write causes Stripe to retry, and the registration is processed twice: the participant gets two confirmation emails, the event shows double-counted revenue, and refund logic breaks because it sees a different payment amount than expected.

The partial-capture change (Stripe 2025-03-31 changelog) also means partially canceling a PaymentIntent no longer creates a `Refund` object — any code that detects refunds by watching for `charge.refunded` events on partial captures will silently miss these cases.

**Why it happens:**
Developers implement the happy path first and handle retries later. The Stripe webhook handler processes the event inline (DB write + email send) without checking whether the `event.id` was already processed.

**How to avoid:**
- Persist `stripeEventId` on the `EventRegistration` record (or a dedicated `StripeWebhookEvent` log table). Before processing, check if `event.id` already exists. If yes, return 200 immediately.
- Keep webhook handlers under 5 seconds. For anything slower (PDF generation, email with attachments), enqueue a job and return 200 immediately.
- Implement a `payment_intent.amount_capturable_updated` handler alongside `payment_intent.succeeded` to handle deposits and partial captures correctly.
- Test retry behavior locally using Stripe CLI: `stripe trigger payment_intent.succeeded` twice with the same event ID.
- Never modify registration status based on client-side confirmation — always wait for the webhook.

**Warning signs:**
- Webhook handler that does DB writes AND sends emails inline without idempotency check.
- Missing handler for `payment_intent.payment_failed` (participant remains in pending state forever).
- Registration count in the dashboard differs from Stripe payment count by any non-zero amount.

**Phase to address:**
Phase — Payments & Budget. Must be built before registration goes live with real transactions.

---

### Pitfall 3: Form Builder Complexity Spiral

**What goes wrong:**
A form builder starts as "drag fields onto a canvas." Feature requests arrive quickly: conditional logic ("show dietary field only if attending dinner"), calculated fields, multi-page flows, branching based on payment amount, signature blocks that embed inside forms. Each addition multiplies complexity: the JSON schema must express the condition, the renderer must evaluate it, the submission processor must handle partially-filled conditional sections, and the PDF generator must skip hidden fields. Within two phases the form builder is consuming 40% of all development time.

**Why it happens:**
Each feature seems small in isolation. "Just add a visibility condition" is one afternoon of work — until it interacts with validation, multi-page state, server-side submission reprocessing, and the AI form generator that now needs to output conditions.

**How to avoid:**
- Define the form schema as a versioned, immutable document (JSON blob stored in the DB). Never mutate a published form — create a new version.
- Enforce a hard scope boundary: v3.0 form builder supports ONLY the field types listed in PROJECT.md (common fields, custom fields, payment, signature). Conditional logic is explicitly out of scope until post-v3.
- When a request for conditional logic appears, route it to Jotform/Google Forms integration (already listed as the escape valve in PROJECT.md).
- The form schema renderer and the form schema editor must be separate modules. The renderer must be self-contained enough to run in both the public page context and the printable PDF context.

**Warning signs:**
- Any ticket that says "just add a condition to the form field."
- Form schema growing beyond the originally scoped field types in the first phase.
- Form renderer and form editor sharing mutable state.

**Phase to address:**
Phase — Registration & Forms. Scope must be locked before design begins.

---

### Pitfall 4: Data Model Migration Breaks Existing Calendar Queries

**What goes wrong:**
The current system has `CalendarEvent` records powering the Calendar view. The new `EventProject` model is a richer hub. If the migration strategy is "rename/extend CalendarEvent," every existing query that does `prisma.calendarEvent.findMany(...)` either breaks or silently returns incomplete data. If the strategy is "new table, migrate data," the old queries keep working but the Calendar now shows stale data from the old table.

This platform uses `db:push` (no migration file history on remote). A `db:push:remote` that renames a column drops and recreates it — any data in that column is gone.

**Why it happens:**
The "expand and contract" migration pattern is not automatic knowledge. Developers change the schema, run `db:push`, and discover at demo time that months of calendar events disappeared.

**How to avoid:**
- Adopt the expand-and-contract pattern explicitly:
  1. Add new `EventProject` table alongside `CalendarEvent` (expand).
  2. Dual-write: all writes go to both tables.
  3. Read from `EventProject`, fall back to `CalendarEvent` for older records.
  4. After full verification, deprecate `CalendarEvent` reads (contract).
- Before any `db:push:remote`, run `prisma migrate diff` to preview the SQL and check for destructive operations (`DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN TYPE`).
- Create a DB backup (Supabase point-in-time recovery snapshot) before every production schema change.
- Write a smoke test that queries the Calendar view and asserts at least N events are returned — run this after every migration.

**Warning signs:**
- Any schema change that renames or removes a field on `CalendarEvent` or `Event` without a backfill step.
- `db:push:remote` run without first running `prisma migrate diff`.
- Calendar view showing zero events after a schema update.

**Phase to address:**
Phase — Event Foundation (first phase). The bridge strategy must be decided before any schema work begins.

---

### Pitfall 5: Student Medical Data Without FERPA/COPPA Guardrails

**What goes wrong:**
The registration form collects medical information (allergies, medications, EpiPen, emergency contacts). This data is stored in the same `EventRegistration` JSON blob as name and grade level. Staff members with `events:read` permission can see it. The event is later archived but the blob is never purged. A parent requests data deletion — the platform has no mechanism to honor it.

The 2024 COPPA amendment (effective 2025) shifted children's online privacy from opt-out to an opt-in consent framework, requiring explicit parental approval before collecting data from children under 13.

**Why it happens:**
Medical fields are treated as "just more form fields." The difference between directory information (name, photo) and protected health/education records (medical conditions, emergency contacts tied to a student identity) is not enforced architecturally.

**How to avoid:**
- Store sensitive registration fields (medical, emergency contacts, medications) in a separate `RegistrationSensitiveData` table with its own access control — not in the main registration JSON blob.
- Require a distinct permission (`events:medical:read`) to access the sensitive table. Default `events:read` must NOT grant access.
- Implement a data retention policy: sensitive data is hard-deleted N days after the event ends (configurable per org, default 90 days). A scheduled job enforces this.
- For participants under 13: collect explicit parental consent checkbox with timestamp and IP, stored with the registration, before showing any form fields that collect personal data.
- Photo uploads: require an explicit "I have consent to photograph this participant" acknowledgment per registration, stored and auditable.
- Audit log every access to the sensitive data table (who, when, what field).

**Warning signs:**
- Medical fields stored as keys inside the same JSON column as non-sensitive fields.
- Any `events:read` permission check that also returns medical data.
- No data retention job scheduled for the `RegistrationSensitiveData` table.
- Photo upload that does not gate on age of participant.

**Phase to address:**
Phase — Registration & Forms (when medical fields are first collected). Cannot be retrofitted after the fact without a migration.

---

### Pitfall 6: Magic Link Abuse and Token Reuse

**What goes wrong:**
Parents access event pages and their participant dashboard via magic links (no Lionheart account required). An attacker enumerates email addresses and floods the magic link endpoint with requests, causing email delivery cost explosions and inbox spam for real parents. Separately, a magic link token is forwarded in a group chat — anyone with the link can access the participant's registration data, including the medical summary.

**Why it happens:**
Magic link systems are built for the happy path (parent clicks their own link) without modeling the adversarial path. The token is long-lived because convenience is prioritized, and there is no mechanism to invalidate a forwarded token.

**How to avoid:**
- Rate limit the magic link request endpoint aggressively: max 3 requests per email per hour, max 20 requests per IP per hour.
- Magic link tokens must be single-use: mark as `used` immediately on first access. Subsequent clicks redirect to "this link has expired, request a new one."
- Token expiry: 48 hours maximum. For day-of access (QR scan), issue a fresh short-lived token (4 hours) from the long-lived registration token.
- Do not embed the magic link token directly in a QR code printed on a wristband — use a separate check-in token that proves attendance without granting account access.
- Log all magic link sends with IP and user-agent for abuse detection.
- Display a "Not you? Secure this link" banner on first use to alert parents their link was accessed.

**Warning signs:**
- Magic link tokens that never expire or are reused.
- No rate limiting on the `/api/auth/magic-link` endpoint.
- QR code on wristband encodes the same token as the parent's email link.
- No audit log of magic link access events.

**Phase to address:**
Phase — Public Pages & Registration (when magic links are first issued). Security cannot be bolted on after release.

---

### Pitfall 7: PWA Offline Conflict Resolution Causes Data Loss

**What goes wrong:**
A staff member opens the check-in roster offline on their phone. Another staff member checks in the same participant from a different device. When the offline device syncs, last-write-wins overwrites the online check-in with an older "not checked in" status — the participant appears unchecked-in at the medical tent when they are actually on the bus.

A subtler version: an offline incident log entry is created for a participant. By the time the device syncs, the participant's group assignment has changed. The incident is now linked to the wrong group.

**Why it happens:**
Offline-first is built for read-heavy use cases (rosters, medical summaries). The check-in write path is added later without rethinking the conflict model. Last-write-wins is implemented because it is simple — the consequences are only understood after a real event when a medical emergency reveals the data was stale.

**How to avoid:**
- Use an append-only event log model for check-ins and incidents — never update a record, only add events. The authoritative state is derived from the event log, not from a mutable status field.
- Each offline action gets a client-generated UUID and a client-side timestamp. On sync, the server merges by applying events in client-timestamp order, detecting conflicts (same participant checked in by two devices) and flagging them for staff review rather than silently resolving.
- The IndexedDB queue must include a `syncStatus` flag (`pending | synced | conflict`). The UI must display a "3 unsynced actions" badge so staff know sync is needed.
- Offline incidents must capture a snapshot of the participant's group at the time of the incident, not a foreign key that can change.

**Warning signs:**
- Check-in status stored as a mutable boolean on the registration record.
- Offline queue that silently discards items on network error rather than retaining them.
- No conflict indicator in the sync UI.
- Incident records that reference group by ID without snapshotting group name/data.

**Phase to address:**
Phase — Day-Of Tools & PWA. The offline data model must be designed before the sync mechanism is built.

---

### Pitfall 8: QR Code Scanning Failures at Day-Of Scale

**What goes wrong:**
QR codes are designed and tested in a bright office on a 4K monitor. On the day of the event, they are printed at 1.5 inches on thermal paper with low contrast, scanned in sunlight by a phone with a cracked screen by a volunteer who has never used the app. Scan failure rate hits 30%. Lines form. Staff fall back to paper, defeating the system.

A second failure: the check-in app requires a network request to validate each scan. The school gym has poor WiFi. Each scan takes 4 seconds. The line for 200 students entering camp takes 13 minutes.

**Why it happens:**
QR code systems are tested in ideal conditions. Scale and environment testing is skipped. Offline validation is not built because "we'll have WiFi at the event."

**How to avoid:**
- QR codes must be at minimum 2cm × 2cm when printed. Generate them at high error correction level (H or Q) to survive partial damage and low-contrast printing.
- The check-in scanner must work fully offline: the entire participant roster (encrypted) is preloaded into IndexedDB when the device comes online. Scans validate against the local cache and sync to server in the background.
- Build a "manual lookup by name" fallback directly into the scanner UI — if the QR cannot be read, type the first 3 letters of the last name.
- Always test QR scanning on a physically printed label in outdoor lighting before any event goes live.
- Validation response time target: under 200ms. Any server round-trip architecture fails this target on spotty WiFi.

**Warning signs:**
- Check-in scan requires a live API call to validate.
- QR code size not specified in the registration confirmation email template.
- No fallback search in the scanner UI.
- Scanner tested only in-browser, never on a physical printed code.

**Phase to address:**
Phase — Day-Of Tools & PWA. Offline roster preload is a prerequisite for the check-in feature.

---

### Pitfall 9: Real-Time Collaboration Race Conditions on Shared State

**What goes wrong:**
Two coordinators open the group assignment view simultaneously. One drags a student to Bus 3; at the same moment, the other drags the same student to Bus 4. Both send a PATCH to the server. The server processes them sequentially — the student ends up on Bus 4, but Coordinator 1's screen still shows Bus 3. The bus manifest is printed from Coordinator 1's stale view. The student is on the wrong bus list.

A subtler version: presence indicators show both coordinators are "in the document," but the SSE connection drops silently (no heartbeat detection). Coordinator 2's cursor disappears but their edits still arrive, causing phantom updates from a "disconnected" user.

**Why it happens:**
Optimistic UI updates make both coordinators see their action succeed immediately. The server does not enforce last-write detection or send a corrective event back to the losing client. SSE connections drop without the client knowing because no heartbeat ping is implemented.

**How to avoid:**
- Use optimistic locking on group assignment records: include a `version` field, increment on every write. Reject writes where the client's `version` does not match the DB `version` and return the current state. The client UI must handle a 409 Conflict gracefully — "Assignment changed, reload view" rather than silently overwriting.
- SSE connections must send a heartbeat comment (`:\n\n`) every 15 seconds. The client must detect heartbeat absence within 30 seconds and reconnect automatically.
- Presence indicators must be driven exclusively by the server — a user is "present" only if their SSE connection is active. Never compute presence from a last-seen timestamp alone.
- For day-of group assignment (highest stakes), disable concurrent editing for the same group: show a "Coordinator 2 is editing this bus" lock indicator rather than allowing simultaneous edits.

**Warning signs:**
- Optimistic UI updates that do not handle server rejection.
- No `version` or `updatedAt` field on group assignment records.
- SSE connection with no heartbeat/ping mechanism.
- Presence driven by a stale timestamp rather than active connection state.

**Phase to address:**
Phase — Real-Time & Collaboration. Must be designed before the group assignment UI is built.

---

### Pitfall 10: PDF Generation Blocks Serverless Functions

**What goes wrong:**
Bus manifests and medical summaries are generated server-side using Puppeteer (headless Chrome). Puppeteer requires a Chromium binary that exceeds Vercel's serverless function size limit (50MB compressed). The function crashes on deployment. The team switches to `@sparticuz/chromium-min` — it works, but cold starts take 8–12 seconds and generating a 50-page camp roster causes the function to time out at 10 seconds.

An alternative failure: `@react-pdf/renderer` is chosen and renders synchronously in the request handler, blocking the Node.js event loop for 3–4 seconds per document, causing all other concurrent requests to queue behind it.

**Why it happens:**
PDF generation is treated as a simple "generate and return" operation. The serverless constraint and memory profile are not considered until the feature is nearly complete.

**How to avoid:**
- Never generate PDFs synchronously in a serverless route handler. Always use a queue + async pattern: request triggers a background job, the job generates the PDF and uploads it to Supabase Storage, and the client polls or receives a webhook when ready.
- For Next.js/Vercel: use Vercel background functions or an external queue (BullMQ via a dedicated worker process, or Supabase Edge Functions) for PDF work.
- Choose `@react-pdf/renderer` (no binary dependency, works in Node.js) over Puppeteer for structured documents (manifests, rosters). Use Puppeteer only if pixel-perfect HTML rendering is required.
- Cache generated PDFs in Supabase Storage with a content-hash key. Regenerate only when the underlying data changes.
- Test PDF generation with the largest realistic dataset (500-participant camp roster) before shipping the feature.

**Warning signs:**
- PDF generation happening in a Next.js API route with a synchronous return.
- Puppeteer in `dependencies` without a serverless-compatible Chromium solution.
- No caching strategy for generated PDFs.
- PDF generation not tested with more than 10 participants.

**Phase to address:**
Phase — Documents & Printables. Architecture decision (queue vs. inline) must be made before any PDF code is written.

---

### Pitfall 11: Navigation Restructuring Breaks Bookmarks and Muscle Memory

**What goes wrong:**
The sidebar is restructured so Events is primary and Calendar/Planning are nested beneath it. Existing staff who use the platform daily have bookmarked `/calendar`, `/planning`, and `/tickets`. After the restructure, those URLs redirect to new paths or 404. Staff submit support requests. Administrators who trained their teams on the old navigation must retrain everyone. Adoption of the new events system slows because users are disoriented by the changed interface.

**Why it happens:**
Navigation restructuring is treated as a "rename and move" operation. Old URLs are removed without a redirect plan. The change ships in a sprint without a communication plan.

**How to avoid:**
- Create permanent 301 redirects for every URL that changes. Maintain these redirects indefinitely.
- Do not ship navigation restructuring in the same sprint as feature additions — ship it as a standalone change so the diff is reviewable and reversible.
- Announce the change 2 weeks before shipping with a screenshot comparison (before/after) in the in-app changelog.
- For the first 60 days after the change, show a "Looking for Planning? It's now under Events" tooltip at the old nav position.
- Audit all internal links and any external documentation that references old URLs before shipping.

**Warning signs:**
- Old navigation paths removed without redirect rules.
- No changelog entry for the navigation change.
- Navigation restructure shipped in the same PR as new feature code.

**Phase to address:**
Phase — Event Foundation (navigation restructure happens here). Plan redirects before the PR is merged.

---

### Pitfall 12: Notification Orchestration Spam and Scheduler Drift

**What goes wrong:**
The notification system sends automated reminders: 2 weeks before the event, 1 week before, 3 days before, day-of morning. A coordinator reschedules the event by 2 days. The scheduler does not recalculate — it fires all four notifications within 6 hours of the new event date. Parents receive 4 emails in one morning. The school's Resend sender reputation is damaged.

A second failure: the condition-based trigger ("send reminder if payment not received") checks payment status once and enqueues a job. Between enqueue and execution, the parent pays. The "payment overdue" email is sent anyway because the job does not re-check conditions at execution time.

**Why it happens:**
Notification jobs are enqueued at schedule-creation time rather than being evaluated at execution time. Rescheduling the event invalidates the enqueued jobs but nothing cancels them.

**How to avoid:**
- Store notification schedules as relative offsets (`-14 days`, `-7 days`, `-3 days`) not absolute timestamps. Compute the fire time at execution, not at schedule creation.
- When an event's date/time changes, cancel all pending notification jobs for that event and re-evaluate the schedule. Use a cancellation token or job group ID.
- Condition-based triggers must re-evaluate the condition at the moment of execution, not at enqueue time. The job payload contains the condition; the job runner re-checks it live.
- Implement a per-participant, per-event notification deduplication key: never send the same notification type to the same participant twice within 24 hours.
- Log every notification send with event ID, participant ID, notification type, and timestamp. Surface this log in the event communication tab so coordinators can see what was sent.

**Warning signs:**
- Notification jobs storing absolute fire timestamps that are not updated when the event is rescheduled.
- No cancellation mechanism for pending notification jobs.
- Condition-based jobs that do not re-evaluate the condition at execution.
- No deduplication on notification sends.

**Phase to address:**
Phase — Communication & Notifications. The scheduler architecture must be decided before any notification types are implemented.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store all registration fields in one JSON blob | Faster initial schema | Medical/sensitive data indistinguishable from non-sensitive; can't enforce field-level access control; can't run targeted purges | Never for medical fields; acceptable for non-sensitive custom fields |
| Hardcode "org from JWT" on all API routes | Reuses existing pattern | Public routes have no JWT; silently returns empty or 500 instead of the correct public data | Never once public routes exist |
| Generate PDFs synchronously in the route handler | Simpler code, instant download | Times out on large rosters; blocks serverless event loop; breaks at ~50 participants | Only for documents with < 5 pages and < 10 participants |
| Magic links with 30-day expiry | Fewer "link expired" complaints | Forwarded links grant month-long access to participant medical summaries | Never for day-of access tokens; max 48h for registration links |
| Last-write-wins for offline sync | Simple to implement | Silent data loss when two devices edit the same check-in simultaneously | Acceptable only for non-critical fields (e.g., coordinator notes) |
| Enqueue notifications at schedule-creation time | Simple job queue | Rescheduled events fire all notifications in a burst | Never — always compute fire time at execution |
| Use same Stripe webhook endpoint for all event types | Less routing code | Missed events (e.g., `charge.dispute.created`) that don't fit the happy path | Never — register specific handlers per event type |
| Form schema stored as mutable object | Easier to edit | Published forms change retroactively; historical submissions become unreadable | Never — form schemas must be immutable after first submission |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Webhooks | Not verifying the `Stripe-Signature` header — trusting raw POST body | Always use `stripe.webhooks.constructEvent(body, sig, secret)` before touching the payload |
| Stripe Webhooks | Processing inline (DB write + email) in the webhook handler | Return 200 immediately, enqueue processing; keep handler under 5 seconds |
| Stripe Webhooks | Missing idempotency check — duplicate processing on Stripe retries | Persist `stripeEventId` and check before every handler execution |
| Stripe Partial Refunds | Detecting refunds only via `charge.refunded` events (misses partial cancellations since 2025-03-31) | Also handle `payment_intent.amount_capturable_updated` and `payment_intent.canceled` |
| Resend (Email) | Sending burst of notifications when event is rescheduled | Cancel pending jobs before re-enqueuing; deduplicate by participant+event+type |
| Twilio SMS | No opt-out tracking — participants who text STOP are re-enrolled on next event | Persist opt-out status per phone number; check before every send |
| Google Calendar Sync | Two-way sync without conflict detection — local edit + Google edit creates a double event | Use one-way push (Lionheart → Google) with explicit "disconnect" option; never auto-pull |
| Planning Center Check-Ins | Assuming Planning Center person IDs are stable — they can be merged or archived | Store a mapping table with `planningCenterId` and Lionheart `userId`; handle lookup failures gracefully |
| Supabase Storage | Storing medical PDFs in a public bucket for convenience | Always use private buckets with signed URLs; set URL expiry to 1 hour maximum for sensitive documents |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full participant roster per check-in scan | 200ms per scan at 10 participants; 4 seconds at 500 | Preload entire roster into IndexedDB on scanner open; scan validates locally | ~100 participants / poor WiFi |
| N+1 queries on event project page (8 sections, each fetches separately) | 800ms in dev; 6 seconds in prod with real data | Batch-load all sections in one API call using Prisma `include` or a purpose-built query | 20+ registrations |
| Generating PDFs on every print request without caching | 8-second load time for manifests; function timeouts | Cache PDFs in Supabase Storage keyed by content hash; regenerate only on data change | 50+ participants |
| SSE connections keeping DB connections open per user | Works fine at 5 concurrent users; DB connection pool exhausted at 50 | Use Supabase Realtime (existing infrastructure) instead of raw SSE with DB polling; or size connection pool explicitly | 30–50 concurrent editors |
| Searching participants without index on `lastName, organizationId` | Sub-100ms in dev; 3-second searches in prod | Add composite index `(organizationId, lastName)` on `EventRegistration` before going live | 500+ registrations per event |
| Sending all notifications immediately when org first uses the system | Fine for 1 org; Resend rate limit hit for multi-org bulk sends | Spread notification sends with a configurable delay; use Resend's batch send API | First large org with 500+ participants |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deriving `organizationId` from a client-supplied query param on public routes | Org A can access Org B's event data by changing a URL parameter | Always derive orgId server-side from the verified slug; never from client input |
| Storing medical/emergency contact data in the same JSON as non-sensitive registration fields | Medical data accessible to anyone with `events:read`; impossible to purge selectively | Separate `RegistrationSensitiveData` table with distinct permission (`events:medical:read`) |
| Magic link tokens that never expire | Forwarded links grant permanent access to participant data | Max 48-hour token expiry; single-use tokens for medical access |
| QR codes on wristbands encoding the registration auth token | Anyone who photographs a wristband gets account access | Use a separate, scope-limited check-in token; never expose auth credentials in physical media |
| Public event pages without rate limiting | Competitor or bot scrapes all events across all orgs | Rate limit public endpoints: 60 requests/minute per IP; CAPTCHA on form submissions |
| Collecting participant under-13 data without COPPA-compliant opt-in consent | FTC enforcement risk; parent can demand deletion; civil liability | Collect explicit opt-in consent with timestamp before any personal data field is shown; honor deletion requests |
| Supabase Storage PDFs in a public bucket | Anyone with a guessed or leaked URL downloads medical summaries permanently | All registration-related storage in private buckets with signed URLs (max 1 hour expiry) |
| Webhook endpoint without signature verification | Forged webhook triggers fraudulent check-in or payment confirmation | Always call `stripe.webhooks.constructEvent()` with the webhook signing secret before processing |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing a blank public event page until the parent "logs in" | Parents who received a school email bounce immediately thinking the link is broken | Show event title, date, and school branding before any auth; gate only the registration form, not the entire page |
| Requiring parents to create a Lionheart account | Parents associate friction with the school, not the platform; 40–60% drop-off at account creation | Magic link only — no account creation ever for parents |
| Form builder that looks different from the public form | Coordinator surprises: the form they designed looks different on mobile | Live preview in the form builder that matches the exact public rendering on mobile viewport |
| Group assignment UI that doesn't show capacity | Coordinator assigns 55 students to a bus that holds 50 | Show capacity and remaining slots prominently; warn (not block) when over capacity |
| Check-in scanner that goes to a "success" page after each scan | Volunteers scan and immediately lose their place in the queue | Return to scanning mode immediately after each scan with a brief animated confirmation |
| Sending the same notification twice when an event is rescheduled | Parents call the school office confused about conflicting dates | Cancel pending notifications before sending updated ones; include an explicit "UPDATED:" prefix on rescheduled event messages |
| PDF manifest with 8pt font on A4 paper | Volunteers can't read names in low light outdoors | Minimum 12pt font; test print before any large event |
| Showing all 8 EventProject sections immediately on first create | First-time planners overwhelmed by 8 empty sections | Collapse empty sections by default; expand as data is added; use progressive disclosure |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Public event page:** Often missing org-scoped isolation — verify that requesting `/events/[slug]` with a different org's event slug 404s rather than leaking data.
- [ ] **Registration form:** Often missing COPPA consent gate for under-13 participants — verify that a form with a date-of-birth field under age 13 triggers the consent flow.
- [ ] **Stripe integration:** Often missing idempotency — verify that replaying the same `payment_intent.succeeded` webhook twice does not create two registrations.
- [ ] **Magic links:** Often missing single-use enforcement — verify that clicking a magic link a second time does not grant access.
- [ ] **Offline PWA:** Often missing conflict UI — verify that syncing two conflicting offline check-ins shows a conflict badge, not a silent overwrite.
- [ ] **PDF generation:** Often missing async queue — verify that generating a 200-participant manifest does not time out the serverless request.
- [ ] **Notification orchestration:** Often missing rescheduling cancellation — verify that changing event date cancels pending notifications before re-enqueuing.
- [ ] **Medical data:** Often missing separate permission — verify that a user with `events:read` cannot access `RegistrationSensitiveData` through any API endpoint.
- [ ] **QR scanner:** Often untested offline — verify that the scanner works with airplane mode enabled after preloading the roster.
- [ ] **Navigation redirect:** Often missing old URL redirects — verify that `/calendar` and `/planning` redirect correctly after navigation restructure.
- [ ] **Group assignment:** Often missing optimistic lock rejection handling — verify that a 409 response from the server surfaces a visible conflict message to the user.
- [ ] **Data retention:** Often missing automated purge — verify that a scheduled job exists that hard-deletes `RegistrationSensitiveData` records past the retention window.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant data leak on public pages | HIGH | Immediate: disable public endpoints; audit access logs for the exposure window; notify affected orgs per FERPA breach timelines; patch isolation gap before re-enabling |
| Double-processed Stripe webhooks | MEDIUM | Query registrations created within the duplicate window; identify duplicates by `stripePaymentIntentId`; void duplicates; issue refunds; add idempotency retroactively |
| CalendarEvent data lost in schema migration | HIGH | Restore from Supabase point-in-time backup; apply migration again using expand-and-contract; validate with smoke test before re-deploying |
| Medical data exposed via underprivileged endpoint | HIGH | Audit access logs for who queried the endpoint; notify affected families; add `events:medical:read` guard; delete any cached/logged copies of the response |
| Magic link tokens forwarded and abused | MEDIUM | Invalidate all active tokens for affected participants; issue new tokens on next request; add single-use enforcement; notify participant of access event |
| Notification spam on event reschedule | LOW | Send a correction email acknowledging the duplicate; add "Please disregard previous messages" language; implement deduplication before next event cycle |
| PDF generation timing out in production | MEDIUM | Implement async queue immediately; return a "generating..." state to the UI; store generated PDF in Supabase Storage with a polling URL |
| PWA sync conflict with silent data loss | HIGH | Rebuild check-in status from server-side event log (append-only log is source of truth); display discrepancy report to event coordinators; add conflict UI retroactively |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Public pages break tenant isolation | Event Foundation + Public Pages (Phase 1 constraint) | Automated test: cross-org slug request returns 404 |
| Stripe webhook double-processing | Payments & Budget | Replay webhook test; duplicate registration count = 0 |
| Form builder complexity spiral | Registration & Forms | Scope checklist enforced before design begins |
| CalendarEvent migration data loss | Event Foundation | `prisma migrate diff` shows no destructive ops; smoke test asserts event count |
| Student medical data FERPA/COPPA | Registration & Forms | Separate table permission audit; under-13 consent gate in registration flow |
| Magic link abuse and token reuse | Public Pages & Registration | Rate limit smoke test; single-use token test |
| PWA offline conflict resolution | Day-Of Tools & PWA | Two-device conflict test; conflict badge visible in UI |
| QR scanning failure at scale | Day-Of Tools & PWA | Offline scan test with printed codes; manual lookup fallback present |
| Real-time collaboration race conditions | Real-Time & Collaboration | Concurrent edit test returns 409; UI shows conflict message |
| PDF generation blocks serverless | Documents & Printables | 200-participant PDF generation test succeeds async in < 30s |
| Navigation restructuring breaks bookmarks | Event Foundation | 301 redirect tests for all changed URLs; no 404s on old paths |
| Notification scheduler drift | Communication & Notifications | Reschedule event test; no duplicate notifications; condition re-evaluated at execution |

---

## Sources

- [Tenant Isolation in Multi-Tenant Systems — Security Boulevard](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/)
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS — Medium](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Multi-Tenant Security Cheat Sheet — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- [Stripe Webhook Best Practices — Stigg Blog](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Stripe Partial Capture Refund Change 2025-03-31 — Stripe Changelog](https://docs.stripe.com/changelog/basil/2025-03-31/remove-refund-from-partial-capture-and-payment-cancellation-flow)
- [Handling Payment Webhooks Reliably — Medium](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5)
- [FERPA Compliance Guide 2026 — UpGuard](https://www.upguard.com/blog/ferpa-compliance-guide)
- [FERPA & COPPA Compliance for School AI — SchoolAI](https://schoolai.com/blog/ensuring-ferpa-coppa-compliance-school-ai-infrastructure)
- [Protecting OTP & Magic Link Endpoints from Abuse — MojoAuth](https://mojoauth.com/blog/otp-magic-link-abuse-protection)
- [Magic Links Security Vulnerabilities — Vault Vision](https://vaultvision.com/blog/the-security-vulnerabilities-in-magic-links-authentication)
- [Offline-First Frontend Apps 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Data Synchronization in PWAs — GTC Systems](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/)
- [QR Code Check-In for School Events — Sched](https://sched.com/blog/qr-code-check-ins-at-school-events/)
- [Handling Race Conditions in Real-Time Apps — DEV Community](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8)
- [PDF Generation in Next.js Serverless — TechResolve](https://techresolve.blog/2025/12/25/anyone-generating-pdfs-server-side-in-next-js/)
- [Integrating PDF Generation into Node.js Backends — Joyfill](https://joyfill.io/blog/integrating-pdf-generation-into-node-js-backends-tips-gotchas)
- [Prisma Migration Strategies — Prisma Data Guide](https://www.prisma.io/dataguide/types/relational/migration-strategies)
- [Breaking Change Migrations Discussion — Prisma GitHub](https://github.com/prisma/prisma/discussions/7421)
- [Notification Fatigue — Courier Blog](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas)
- [Redesigning SaaS Without Upsetting Users — Divami](https://www.divami.com/blog/redesigning-saas-without-upsetting-current-users)
- [Form Builder: Build vs Buy — Joyfill](https://joyfill.io/blog/build-vs-buy-a-form-builder-for-saas-applications)

---
*Pitfalls research for: K-12 School Event Planning added to multi-tenant SaaS*
*Researched: 2026-03-14*
