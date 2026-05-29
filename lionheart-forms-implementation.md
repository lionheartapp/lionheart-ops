# Lionheart Forms System — Implementation Handoff

**Purpose:** Implement the contextual forms system described in `lionheart-forms-spec.md`, incorporating the prototype refinements proven out in `lionheart-forms-demo.html`.

**Baseline spec:** `uploads/lionheart-forms-spec.md`
**Working prototype:** `/Users/mkerley/Desktop/Lionheart/lionheart-forms-demo.html` (single-file React + Tailwind)

Read both before starting. The HTML demo is the source of truth for UX behavior; anywhere it conflicts with the spec, the demo wins (it was iterated on after the spec was written).

---

## What's New vs. the Original Spec

Three capabilities were added during prototyping and are now in scope:

1. **QR codes on ticket forms** — admins can generate a printable QR-code sheet per building/area/room that links to a sub-style landing page scoped to that location. A teacher scans the QR from their classroom wall, lands on a pre-filled form (location + category already set), and submits without logging in.

2. **Public form styles for event registration** — public-facing event forms support three layout presets (Minimal, Split + image, Hero banner), a configurable brand CTA color with preset swatches and a custom picker, an image-side toggle (Left/Right) for Split, and a page background color picker for Minimal. Every public form ships with a sensible default.

3. **Drag-and-drop field reordering** — replaces the up/down arrow pattern. Uses native HTML5 DnD with a mouse-down-on-handle arming pattern (so clicking into an expanded field's inputs doesn't accidentally start a drag) and before/after drop indicators.

---

## Data Model

### Prisma Schema Changes

```prisma
// Add to schema.prisma — all org-scoped, soft-delete where the parent is soft-delete

// ─── Shared form definition (one row per "form context") ───
model FormDefinition {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Exactly one of these is non-null — identifies what owns this form
  categoryKey    String?  // e.g. "hardware", "plumbing" — ticket category form
  eventId        String?  // event registration form
  event          Event?   @relation(fields: [eventId], references: [id])

  sections       FormSection[]
  fields         FormField[]

  // Public form styling (only meaningful for event forms)
  publicStyle    PublicFormStyle @default(MINIMAL)
  publicCtaColor String?  // hex, e.g. "#4f46e5"
  publicBgColor  String?  // hex — only used by MINIMAL
  publicImageUrl String?
  publicImageSide ImageSide @default(RIGHT)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, categoryKey])  // one ticket form per category per org
  @@index([organizationId, eventId])
}

enum PublicFormStyle {
  MINIMAL
  SPLIT
  HERO
}

enum ImageSide {
  LEFT
  RIGHT
}

model FormSection {
  id           String  @id @default(uuid())
  formId       String
  form         FormDefinition @relation(fields: [formId], references: [id], onDelete: Cascade)
  title        String
  sortOrder    Int
  fields       FormField[]
}

model FormField {
  id             String   @id @default(uuid())
  formId         String
  form           FormDefinition @relation(fields: [formId], references: [id], onDelete: Cascade)
  sectionId      String?
  section        FormSection? @relation(fields: [sectionId], references: [id], onDelete: SetNull)

  key            String     // stable slug used in customFields JSON, e.g. "device_type"
  label          String
  type           FormFieldType
  required       Boolean    @default(false)
  placeholder    String?
  helpText       String?
  options        String[]   @default([])  // for DROPDOWN / MULTI_SELECT

  // Checkbox-only: when this box is checked, escalate parent ticket to URGENT
  autoEscalate   Boolean    @default(false)

  // Conditional logic — one rule per field (spec: "Show this field if [fieldKey] equals [value]")
  condFieldKey   String?
  condEquals     String?

  sortOrder      Int

  @@index([formId])
}

enum FormFieldType {
  TEXT
  TEXTAREA
  NUMBER
  DATE
  EMAIL
  PHONE
  DROPDOWN
  MULTI_SELECT
  CHECKBOX
  FILE
  SIGNATURE
  ASSET_PICKER
  USER_PICKER
  LOCATION_PICKER
  GRADE_SELECTOR
}

// ─── QR code per printable location/scope ───
model FormQrCode {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // Scope — any subset may be set. Scanning applies these as pre-fills.
  categoryKey    String?  // "hardware" etc — pins category
  buildingId     String?
  areaId         String?
  roomId         String?

  token          String   @unique  // random slug in the URL: /f/qr/<token>
  label          String   // admin-facing, e.g. "Room 204 — IT"
  active         Boolean  @default(true)

  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?

  @@index([organizationId])
}
```

### Ticket Storage

Ticket responses continue as spec'd — JSON on `Ticket.customFields`. Add the column if not already present:

```prisma
model Ticket {
  // ... existing fields
  customFields   Json?   // { field_key: value, ... } — shape defined by category's FormDefinition
}
```

### Registration Storage

Registrations continue to use the existing normalized `RegistrationResponse` table. No change.

---

## API Routes

All routes follow the Lionheart boilerplate from `CLAUDE.md`: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext(orgId, …)`. Use `prisma` (org-scoped) inside, not `rawPrisma`.

### Admin — Form Definition CRUD

```
GET    /api/forms/category/[categoryKey]        Get or seed default for category
PUT    /api/forms/category/[categoryKey]        Update fields, styling, ordering
GET    /api/forms/event/[eventId]               Get or seed default for event
PUT    /api/forms/event/[eventId]               Update fields, styling, ordering
POST   /api/forms/[formId]/fields               Add field
PATCH  /api/forms/[formId]/fields/[fieldId]     Edit field
DELETE /api/forms/[formId]/fields/[fieldId]     Remove field
PATCH  /api/forms/[formId]/reorder              Body: { fieldIds: string[] } — bulk sort_order update
```

**Seeding on first GET.** When the client requests a form that doesn't exist yet, the handler upserts the default (per the category-default table in the spec, or the default four-section event registration) and returns it. No "create form" UX — admins only ever customize defaults.

Required permissions: `forms:manage` (new) — check the existing permission definitions in `src/lib/permissions.ts`, add this string, seed into `DEFAULT_ROLES` for `admin` and `super-admin`.

### Public / Unauthenticated

```
GET  /api/public/forms/event/[eventSlug]        Event registration form (styling + fields)
POST /api/public/registrations/[eventId]        Submit registration + (optional) payment
GET  /api/public/forms/qr/[token]               Resolve QR: returns { categoryKey, location, sub-landing URL payload }
POST /api/public/tickets/qr/[token]             Submit a ticket via QR — no auth required
```

Add the public prefix paths to the middleware allow-list in `src/middleware.ts` (alongside the existing entries listed in `CLAUDE.md`).

### QR Codes

```
POST   /api/forms/qr                            Create a QR — body: { categoryKey?, buildingId?, areaId?, roomId?, label }
GET    /api/forms/qr                            List QR codes for the org
PATCH  /api/forms/qr/[id]                       Toggle active, rename
DELETE /api/forms/qr/[id]                       Soft-disable (set active: false)
GET    /api/forms/qr/[id]/printable             HTML page with print stylesheet — used directly via print window
```

QR code image generation happens client-side with `qrcode-generator` (already proven in the demo). The server only persists the token → scope mapping.

### Validation

Every route body is validated with Zod before touching the DB. Use `FormFieldTypeZ = z.enum([...14 types])` and export a single `formFieldSchema` used by both the ticket and event routes.

---

## Component Architecture

### Shared primitives (new — under `src/components/forms/`)

- `FormFieldRenderer.tsx` — renders one field of any type. Consumes `FormField` + current value + onChange. Handles conditional visibility by reading the rest of the response object.
- `FormRenderer.tsx` — renders a whole form (or a section). Takes `fields` + `responses` state + `setResponses`.
- `FieldEditor.tsx` — admin-side editor card for a single field (label, type, required, placeholder, help text, options, conditional rule, auto-escalate).
- `SortableList.tsx` + `useSortable.ts` — drag-and-drop reorder primitive. HTML5 DnD, mouse-down-on-handle arming pattern, before/after drop indicator. (Port straight from the demo.)
- `DragHandle.tsx` — six-dot grab icon.

### Ticket category editor

`src/app/settings/it/routing/[categoryKey]/page.tsx` (and the equivalent for Maintenance) — embeds the inline form editor directly under the existing Specialist/Fallback/SLA config. Standard fields (title, description, location, priority, photos) render as a locked, read-only list above the customizable section.

### Event registration builder

`src/app/events/[eventId]/registration/page.tsx` — reuse the existing section-based builder UI; swap in the unified `FieldEditor` + `SortableList`. Add a "Public Form Style" panel that controls `publicStyle`, `publicCtaColor`, `publicBgColor`, `publicImageUrl`, `publicImageSide`. The panel's preview should mirror the "Public Form Styles" tab in the demo.

### Substitute landing page

`src/app/it/sub/page.tsx` (?token=…) — on category selection, fetches the category's `FormDefinition` and renders via `FormRenderer`. No more hardcoded fields.

### Public event page

`src/app/r/[eventSlug]/page.tsx` (or wherever public event pages live) — reads `FormDefinition.publicStyle` and renders the appropriate layout wrapper around `FormRenderer`. Layouts:

- **MINIMAL** — centered max-w-md white card on the configured `bgColor`.
- **SPLIT** — max-w-5xl grid, image panel on `publicImageSide`, form in the other half.
- **HERO** — max-w-3xl, 260px image banner on top, form below.

CTA button color applied via inline `style={{ backgroundColor: publicCtaColor }}` with an automatic text-color contrast check (luminance-based — see `readableText()` in the demo).

### QR printable page

`src/app/settings/it/qr-codes/page.tsx` — list/create UI with "Print sheet" action that opens a new window rendering the printable layout with `@media print` styles hiding non-QR elements. One QR per card, label underneath, footer note "Scan to submit a [category] ticket for [location]."

---

## UX Conventions (non-negotiable — from CLAUDE.md + demo)

- Cards: `bg-white border border-gray-200 rounded-xl p-6`.
- Accent cards: `bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200`.
- All clickable elements get `cursor-pointer` and `transition-colors duration-200`.
- Skeleton loading (`animate-pulse`) during fetches, matching final layout shape.
- No empty states requiring selection — if an admin lands on the category page, the default form is already seeded and rendered.
- Drag handle: dotted six-dot icon, `text-gray-300` default, `text-gray-600` on hover, `cursor: grab` → `grabbing` while held.
- Drop indicator: 3px indigo bar (`bg-primary-500`) above or below the target card, based on pointer Y relative to the card's vertical midpoint.
- Dragged card: 40% opacity.
- Auto-escalate badge on checkbox fields: `text-orange-700 bg-orange-50`.
- Required badge: `text-red-600 bg-red-50`.
- Conditional badge: `text-purple-700 bg-purple-50`.

---

## Implementation Phases

Match the phased plan in the spec, with these additions:

### Phase A — Unified Field Library + Renderer
- `FormFieldType` enum, `FormField` / `FormSection` / `FormDefinition` models in Prisma.
- Shared `FormRenderer` + `FormFieldRenderer` components supporting all 14 types.
- `SortableList` + `useSortable` + `DragHandle` primitives (port from demo).
- Zod schemas.

### Phase B — Ticket Category Forms
- Replace the existing fixed 6-field toggle block with the inline `FieldEditor` list.
- Seed default forms per category using the table in the original spec (Hardware, Software, Account/Password, Network, etc.).
- Wire ticket submission to render from `FormDefinition` and store responses as JSON in `Ticket.customFields`.
- Update the sub teacher landing page to fetch + render category forms from the same source.

### Phase C — Registration Form Upgrade
- Add the new field types (Asset Picker, Location Picker, Grade Selector) to the existing registration builder using the unified `FieldEditor`.
- Migrate the section-based builder to use `SortableList` per section.
- Keep existing FERPA lock behavior and payment integration untouched.

### Phase D — QR Codes (new)
- `FormQrCode` model + CRUD routes.
- Admin QR-codes settings page with create dialog (pick category + optional location scope + label).
- Printable sheet view with `@media print` stylesheet.
- Public `/f/qr/[token]` route that resolves the token and redirects to a pre-filled sub-style ticket submit page.

### Phase E — Public Form Styles (new)
- Extend `FormDefinition` with the five public-style columns.
- Add the style control panel to the registration builder.
- Implement `/r/[eventSlug]` public render with the three layout wrappers.
- Minimal-layout background color applies via inline `style` on the page wrapper.
- CTA text color picked automatically via `readableText()` luminance check.

### Phase F — Form Analytics (stretch, unchanged from spec)

---

## Open Questions / Decisions Needed

1. **Permission granularity.** Should `forms:manage` be one permission covering both ticket-category and event forms, or split into `tickets:forms:manage` and `events:forms:manage`? The demo assumes one; confirm before seeding.

2. **QR tokens — rotation?** Should tokens expire or rotate on admin action, or be stable for the life of the QR? Stable is simpler; rotation is safer if a QR gets leaked outside the intended audience. Recommend: stable by default with an admin "Rotate token" action that invalidates the old URL.

3. **Public form slug.** Is the public URL `/r/[eventSlug]` already in use, or does this need a new route? Confirm the canonical public event URL before wiring.

4. **Migration for existing ticket custom fields.** If any categories already have data using the old 6-field toggle, we need a backfill that maps those toggles to the new `FormDefinition` shape. Scope that during Phase B kickoff.

5. **Mobile drag-and-drop.** The demo uses HTML5 DnD (desktop-first). On touch devices this doesn't work. Acceptable for admin UI (assumed desktop), but confirm — if mobile admin is required, swap to `@dnd-kit` or similar.

---

## Out of Scope (unchanged from spec)

- Standalone "Forms" page or library browser.
- Calculated fields, formulas, repeating groups.
- Payment fields on ticket forms (event registrations only).
- Embeddable forms on external sites — public forms only render on the Lionheart domain or via magic links / QR tokens.
- Multi-page ticket submission.

---

## Quick Reference — Lionheart-isms the implementer should already know

- Use `prisma` (org-scoped), not `rawPrisma`, inside route handlers — always wrap DB work in `runWithOrgContext(orgId, …)`.
- `assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)` before any admin mutation.
- `clearPermissionCache(userId)` after any role change.
- Zod-validate every body; return `fail('VALIDATION_ERROR', …)` on failure.
- Public routes must be added to the middleware allow-list.
- No religious/worship language anywhere in placeholders or sample data.
- Design uses the indigo "primary" palette, `rounded-xl`, `cursor-pointer`, `transition-colors duration-200`.

---

**Deliverable checklist before closing any phase:** Prisma migration created and applied (`db:push` locally, proper migration file before remote), Zod schemas exported, permissions seeded, route handler pattern followed, components placed under `src/components/forms/`, smoke test pass (`npm run smoke:all`), memory file at `~/.claude/projects/-Users-mkerley-Desktop-Lionheart/memory/` updated with new patterns established.
