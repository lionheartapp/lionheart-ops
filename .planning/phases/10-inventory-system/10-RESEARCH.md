# Phase 10: Inventory System - Research

**Researched:** 2026-03-10
**Domain:** Inventory management — CRUD, checkout/checkin transactions, reorder alerts, UI
**Confidence:** HIGH (all findings verified against existing codebase)

---

## Summary

Phase 10 builds the inventory management system that lets school staff track physical stock — supplies, equipment, media — with quantity-aware checkout/checkin and reorder threshold alerting. The `InventoryItem` model already exists in the schema (org-scoped, soft-delete) but is minimal: it has `name`, `quantityOnHand`, `reorderThreshold`, and no `category` or `sku` fields. The existing `GET /api/inventory` route has no auth and no permission check — it is essentially a stub.

The largest schema gap is the missing `InventoryTransaction` model. Checkout/checkin events must be persisted as immutable transaction rows (like `ITLoanerCheckout` or `MaintenanceLaborEntry`) rather than mutable state fields, to satisfy INV-04 (full transaction log). Quantity updates must be atomic — a checkout that decrements `quantityOnHand` and records the transaction must succeed or fail together.

Alert delivery for INV-05 uses the existing `notificationService` + `Notification` model pattern. No new notification infrastructure is needed. The alert fires inline at checkout time (when quantity drops below threshold) targeting users with `INVENTORY_UPDATE` permission, mirroring how `maintenanceNotificationService` notifies users with the `MAINTENANCE_READ_ALL` permission.

**Primary recommendation:** Extend `InventoryItem` with `category` and `sku` fields, add `InventoryTransaction` model, migrate the stub API to the full CRUD + checkout/checkin + alert pattern, then build the UI page. Use sequential awaits (not `$transaction`) inside `runWithOrgContext` per the CLAUDE.md pitfall warning.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-01 | Admin can create, update, and delete inventory items with name, category, SKU, and quantity | `InventoryItem` model exists but missing `category` and `sku` — schema extension needed; CRUD via standard route pattern |
| INV-02 | Staff can check out an inventory item; system records who, when, and expected return | New `InventoryTransaction` model needed; `checkedOutById` (userId), `checkedOutAt`, `dueDate` fields; quantity decrement must be atomic with transaction creation |
| INV-03 | Staff can check in a returned inventory item; system updates available quantity | Same `InventoryTransaction` model — `checkedInAt` + `checkedInById` fields stamped on existing open row; quantity increments |
| INV-04 | Admin can view full transaction history (checkout/checkin log) for any inventory item | `GET /api/inventory/[id]/transactions` — returns all `InventoryTransaction` rows for an item, ordered by `createdAt` desc |
| INV-05 | System alerts admin when item quantity falls below configured reorder threshold | After checkout, compare new quantity to `reorderThreshold`; if below, fire `createBulkNotifications` to users with `INVENTORY_UPDATE` permission — fire-and-forget, never throws |
| INV-06 | Admin can view and manage inventory through a dedicated UI page with search and filters | New `/inventory` page in the app with TanStack Query data fetching, search, category filter, stock level filter, and a transaction history drawer |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | v5.22 | ORM + schema | Project ORM — all DB changes go here |
| Zod | current | Input validation | All route inputs validated before DB touch |
| `@/lib/db` (`prisma`) | — | Org-scoped client | Auto-injects `organizationId`, soft-delete aware |
| `@/lib/sanitize` | — | XSS prevention | `stripAllHtml` transform on all string inputs |
| TanStack Query | current | Client data fetching | Established UI pattern (see athletics, calendar pages) |
| Tailwind CSS | current | Styling | Project standard — glassmorphism utility classes in globals.css |
| Framer Motion | current | Animations | `src/lib/animations.ts` shared variants already defined |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `notificationService` | internal | In-app alert delivery | INV-05 reorder threshold alerts |
| `rawPrisma` | internal | Unscoped DB access | Finding admins/users for bulk notification targets |
| `@/lib/api-response` (`ok`/`fail`) | internal | Response envelope | All route handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential awaits | `$transaction` | CLAUDE.md explicitly warns: org-scoped client + `$transaction` behaves unexpectedly — use sequential awaits inside `runWithOrgContext` |
| Fire-and-forget notifications | Blocking await | Notification failures must not fail inventory operations — mirrors `maintenanceNotificationService` pattern |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Structure
```
prisma/
  schema.prisma          # extend InventoryItem, add InventoryTransaction model

src/
  app/
    api/
      inventory/
        route.ts                        # GET (list) + POST (create) — replace stub
        [id]/
          route.ts                      # GET, PUT, DELETE for single item
          transactions/
            route.ts                    # GET transaction log for item
          checkout/
            route.ts                    # POST checkout action
          checkin/
            route.ts                    # POST checkin action (requires transactionId)

  lib/
    services/
      inventoryService.ts               # Zod schemas, CRUD helpers, checkout/checkin logic, alert dispatch

  app/
    inventory/
      page.tsx                          # Main inventory management UI
```

### Pattern 1: Schema Extension

The existing `InventoryItem` model needs two fields. Add to `prisma/schema.prisma`:

```prisma
// Source: existing InventoryItem model at line 549 of schema.prisma

model InventoryItem {
  id               String        @id @default(cuid())
  organizationId   String
  name             String
  category         String?       // e.g. "Office Supplies", "AV Equipment", "Custodial"
  sku              String?       // Stock-keeping unit — optional free text
  quantityOnHand   Int           @default(0)
  reorderThreshold Int           @default(0)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?
  organization     Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  transactions     InventoryTransaction[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@index([organizationId, deletedAt])
  @@index([organizationId, category])   // NEW — for category filter
}

model InventoryTransaction {
  id               String        @id @default(cuid())
  organizationId   String
  itemId           String
  type             InventoryTransactionType  // CHECKOUT | CHECKIN | ADJUSTMENT
  quantity         Int           // positive for CHECKIN, negative for CHECKOUT, signed for ADJUSTMENT
  checkedOutById   String?       // userId of person who checked out
  checkedInById    String?       // userId of person who checked in
  dueDate          DateTime?     // expected return (CHECKOUT only)
  checkedOutAt     DateTime?
  checkedInAt      DateTime?
  notes            String?
  createdAt        DateTime      @default(now())

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  item         InventoryItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  checkedOutBy User?         @relation("InventoryCheckedOutBy", fields: [checkedOutById], references: [id], onDelete: SetNull)
  checkedInBy  User?         @relation("InventoryCheckedInBy", fields: [checkedInById], references: [id], onDelete: SetNull)

  @@index([organizationId, itemId])
  @@index([organizationId, itemId, createdAt(sort: Desc)])
  @@index([itemId, checkedInAt])   // find open checkouts (checkedInAt IS NULL)
}

enum InventoryTransactionType {
  CHECKOUT
  CHECKIN
  ADJUSTMENT
}
```

**Also add** `InventoryTransaction` to `Organization` relation list in schema, and `User` relation list (two named relations: `InventoryCheckedOutBy`, `InventoryCheckedInBy`).

**Also add** `InventoryTransaction` to `orgScopedModels` in `src/lib/db/index.ts` — it is an org-scoped model.

### Pattern 2: Checkout/Checkin Atomic Update

Do NOT use `$transaction` with org-scoped client (CLAUDE.md pitfall). Use sequential awaits with a guard:

```typescript
// Source: CLAUDE.md conventions + ITLoanerCheckout pattern in schema

// CHECKOUT: decrement quantity, create transaction row
export async function checkoutItem(
  orgId: string,
  itemId: string,
  input: CheckoutInput,
  actorUserId: string
) {
  return await runWithOrgContext(orgId, async () => {
    // 1. Fetch item
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId } })
    if (!item) throw new Error('NOT_FOUND')
    if (item.quantityOnHand < input.quantity) throw new Error('INSUFFICIENT_STOCK')

    // 2. Decrement quantity
    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: { decrement: input.quantity } },
    })

    // 3. Create transaction row
    await prisma.inventoryTransaction.create({
      data: {
        itemId,
        type: 'CHECKOUT',
        quantity: -input.quantity,
        checkedOutById: actorUserId,
        checkedOutAt: new Date(),
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
      },
    })

    // 4. Fire reorder alert — fire-and-forget, never throws
    if (updated.quantityOnHand < updated.reorderThreshold) {
      void notifyLowStock(orgId, item.name, updated.quantityOnHand, itemId)
    }

    return updated
  })
}
```

### Pattern 3: Permission Constants

Two new inventory action permissions are needed — checkout and checkin. The existing `INVENTORY_READ/CREATE/UPDATE/DELETE` set covers CRUD. Add to `src/lib/permissions.ts`:

```typescript
// Source: existing PERMISSIONS object in src/lib/permissions.ts
INVENTORY_CHECKOUT: 'inventory:checkout',  // staff can check out items
INVENTORY_CHECKIN: 'inventory:checkin',    // staff can check in returned items
```

Assign:
- `INVENTORY_CHECKOUT` + `INVENTORY_CHECKIN` → `admin`, `member` roles (staff can check out/in)
- `INVENTORY_READ` already in `viewer`, `admin`, `member` — no change needed
- `INVENTORY_CREATE/UPDATE/DELETE` — admin only (already assigned)

Also add these two new permissions to `seedOrgDefaults` (they are upserted into the global `Permission` table on org creation).

### Pattern 4: Reorder Alert Delivery

Mirrors `maintenanceNotificationService.ts` exactly. Uses `rawPrisma` to find notification targets (bypasses org scope), then `createBulkNotifications` from `notificationService`:

```typescript
// Source: maintenanceNotificationService.ts lines 72-90 — getUsersWithPermission pattern

async function notifyLowStock(orgId: string, itemName: string, currentQty: number, itemId: string) {
  try {
    // Find all users with INVENTORY_UPDATE permission in this org
    const admins = await getUsersWithPermission(orgId, PERMISSIONS.INVENTORY_UPDATE)
    if (admins.length === 0) return

    await createBulkNotifications(
      admins.map((u) => ({
        userId: u.id,
        type: 'inventory_low_stock' as NotificationType,
        title: `Low stock: ${itemName}`,
        body: `Only ${currentQty} unit(s) remaining — below reorder threshold`,
        linkUrl: `/inventory?itemId=${itemId}`,
      }))
    )
  } catch (err) {
    console.error('Failed to send low-stock notification:', err)
  }
}
```

Note: `'inventory_low_stock'` must be added to the `NotificationType` union in `notificationService.ts`.

### Pattern 5: Route Handler Shape

Every route follows the canonical boilerplate. For the list route (replacing the stub):

```typescript
// Source: CLAUDE.md API Route Pattern + existing src/app/api/inventory/route.ts

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const category = searchParams.get('category') ?? undefined
      const search = searchParams.get('search') ?? undefined

      const items = await prisma.inventoryItem.findMany({
        where: {
          ...(category ? { category } : {}),
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(ok(items))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
```

### Pattern 6: UI Page Structure

The inventory page lives at `/inventory` (top-level app route, no `[tenant]` wrapper needed — see `/maintenance`, `/athletics` which follow the same convention). The page is a Client Component using TanStack Query.

```typescript
// Follows athletics/maintenance page conventions:
// - 'use client'
// - useQuery for item list
// - search/filter bar at top
// - table or card grid (glassmorphism: ui-glass-table)
// - DetailDrawer (existing component) for transaction history
// - Skeleton loading (animate-pulse) during fetch
// - Empty state: centered icon + message (no "click to load" patterns)
```

### Anti-Patterns to Avoid

- **Using `$transaction` on org-scoped client** — CLAUDE.md explicitly calls this out. Use sequential awaits inside `runWithOrgContext` instead.
- **Hard-deleting transactions** — `InventoryTransaction` should NOT be in `softDeleteModels`. Transaction rows are immutable audit records; they should never be deleted.
- **Mutable checkout state on `InventoryItem`** — Do NOT add a `checkedOutBy` field to the item. Checkout state comes from `InventoryTransaction` rows where `checkedInAt IS NULL`.
- **Blocking on notification delivery** — The reorder alert must be fire-and-forget (`void notifyLowStock(...)`). Never `await` it in the checkout handler.
- **Using `rawPrisma` in route handlers for inventory queries** — `InventoryItem` is org-scoped; always use `prisma` inside `runWithOrgContext`.
- **Missing auth on the existing stub** — The current `GET /api/inventory/route.ts` has no `getUserContext` or `assertCan` call. The replacement must add both.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org scoping on queries | Manual `where: { organizationId }` | `prisma` inside `runWithOrgContext` | Auto-injected by db extension — hand-rolling can miss updates to extension logic |
| In-app notification delivery | Custom notification model/API | `createBulkNotifications` from `notificationService` | Already built, already wired to `NotificationBell`, already polled every 30s |
| Finding users for alert targets | Raw query | `getUsersWithPermission(orgId, permission)` from `maintenanceNotificationService` | Pattern established and working |
| XSS prevention on string inputs | Custom regex | `stripAllHtml` from `@/lib/sanitize` | Established project sanitizer (AUTH-06 compliance) |
| Response envelope | `{ success: true, data }` | `ok(data)` / `fail(code, msg)` from `@/lib/api-response` | Consistent shape across 281 routes |

**Key insight:** This codebase has rich internal infrastructure. Nearly every cross-cutting concern (org-scoping, soft-delete, notifications, sanitization, response shape) is already solved. The inventory system's job is to wire these together, not rebuild them.

---

## Common Pitfalls

### Pitfall 1: Missing `InventoryTransaction` in `orgScopedModels`
**What goes wrong:** Transaction rows are created without `organizationId`, causing multi-tenant data leaks where any org can read another org's transactions.
**Why it happens:** New models must be manually added to the `orgScopedModels` Set in `src/lib/db/index.ts`.
**How to avoid:** Immediately after adding the model to schema, add `'InventoryTransaction'` to `orgScopedModels`. Also add it to the `Organization` relations list in `schema.prisma`.
**Warning signs:** Transactions returning across orgs, or `organizationId` field missing from created rows.

### Pitfall 2: Race Condition on Quantity Decrement
**What goes wrong:** Two concurrent checkouts both read `quantityOnHand = 1`, both pass the sufficiency check, both decrement — resulting in `quantityOnHand = -1`.
**Why it happens:** Read-then-write without locking.
**How to avoid:** Use Prisma's `decrement` atomic update (`data: { quantityOnHand: { decrement: n } }`) rather than reading the value and writing it back. Then verify the result: if `updated.quantityOnHand < 0`, increment back and return a 409 error. Alternatively, use a Postgres-level check constraint on `quantityOnHand >= 0` via schema migration.
**Warning signs:** Negative `quantityOnHand` values appearing in the database.

### Pitfall 3: Stub Route Has No Auth
**What goes wrong:** The existing `GET /api/inventory/route.ts` bypasses authentication entirely — it calls `getOrgIdFromRequest` but not `getUserContext` or `assertCan`. Replacing it incompletely leaves a public read endpoint.
**Why it happens:** The stub was written before the auth hardening phase.
**How to avoid:** The replacement must add both `getUserContext(req)` and `await assertCan(ctx.userId, PERMISSIONS.INVENTORY_READ)` before the `runWithOrgContext` call.
**Warning signs:** Inventory data readable without a valid JWT.

### Pitfall 4: `$transaction` with Org-Scoped Client
**What goes wrong:** Interactive transactions behave unexpectedly with the extended Prisma client — org context may not propagate correctly inside the transaction callback.
**Why it happens:** Prisma's client extensions interact with interactive transactions in non-obvious ways.
**How to avoid:** Use sequential awaits inside `runWithOrgContext`. The quantity decrement + transaction creation sequence is safe without a DB-level transaction for this use case (worst case: quantity decremented but transaction row missing — detectable via audit). If stronger guarantees are needed, use `rawPrisma.$transaction([...])` with explicit `organizationId` in each operation.
**Warning signs:** Org context errors inside transaction callbacks, or data missing `organizationId`.

### Pitfall 5: Checkin Requires Open Transaction Lookup
**What goes wrong:** Checkin route receives the `itemId` and increments quantity but fails to stamp `checkedInAt` on the correct transaction row because the lookup logic is wrong.
**Why it happens:** Multiple open checkouts for the same item are possible. Checkin must reference a specific transaction (`transactionId` in request body, or the most recent open checkout if caller doesn't specify).
**How to avoid:** Checkin endpoint accepts `transactionId` (required). It verifies the transaction belongs to the item and to the org, then stamps `checkedInAt` + `checkedInById` and increments `quantityOnHand`.

### Pitfall 6: New Permissions Not Seeded
**What goes wrong:** `INVENTORY_CHECKOUT` and `INVENTORY_CHECKIN` constants are added to `permissions.ts` but not added to `DEFAULT_ROLES` permission arrays. Existing orgs never get the new permissions because `seedOrgDefaults` uses `upsert` on the `Permission` table — only new orgs get them seeded.
**Why it happens:** Adding to `PERMISSIONS` constant alone is not enough; roles must explicitly list each permission.
**How to avoid:** Add the two new permissions to `DEFAULT_ROLES.ADMIN.permissions` and `DEFAULT_ROLES.MEMBER.permissions` arrays. For existing orgs, include a note in the plan that a backfill script or manual `seedOrgDefaults` call may be needed.

---

## Code Examples

Verified patterns from the codebase:

### Atomic Quantity Decrement (Prisma)
```typescript
// Source: Prisma docs pattern (verified HIGH confidence — standard Prisma atomic update)
const updated = await prisma.inventoryItem.update({
  where: { id: itemId },
  data: { quantityOnHand: { decrement: quantity } },
})
// Guard against negative result:
if (updated.quantityOnHand < 0) {
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { quantityOnHand: { increment: quantity } }, // rollback
  })
  throw new Error('INSUFFICIENT_STOCK')
}
```

### Transaction Log Query
```typescript
// Source: pattern from MaintenanceLaborEntry / ITLoanerCheckout list queries
const transactions = await prisma.inventoryTransaction.findMany({
  where: { itemId },
  orderBy: { createdAt: 'desc' },
  include: {
    checkedOutBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    checkedInBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
  },
})
```

### Route Params Pattern (Next.js 15 App Router)
```typescript
// Source: src/app/api/settings/users/[id]/route.ts line 11-14
type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params  // params is a Promise in Next.js 15
  // ...
}
```

### Find Open Checkouts for an Item
```typescript
// Source: ITLoanerCheckout pattern in schema (checkedInAt IS NULL = still out)
const openCheckouts = await prisma.inventoryTransaction.findMany({
  where: {
    itemId,
    type: 'CHECKOUT',
    checkedInAt: null,
  },
  orderBy: { checkedOutAt: 'desc' },
})
```

### Reorder Threshold Alert (Fire-and-Forget)
```typescript
// Source: maintenanceNotificationService.ts fire-and-forget pattern
// In the route handler AFTER successful checkout:
if (updatedItem.quantityOnHand < updatedItem.reorderThreshold) {
  void notifyLowStock(orgId, updatedItem.name, updatedItem.quantityOnHand, updatedItem.id)
}
// Do NOT await — alert delivery must never block the checkout response
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Stub `GET /api/inventory` (no auth, no filters) | Full CRUD with auth, Zod validation, search/filter | Full replacement — stub is not usable as-is |
| `InventoryItem` has only name + quantity | Add `category`, `sku`; relate to `InventoryTransaction` | Schema migration via `db:push` |
| No checkout/checkin support | `InventoryTransaction` model with type enum | New model, new API routes |
| No reorder alerts | Fire-and-forget notification at checkout time | Uses existing `notificationService` |
| No UI | `/inventory` page with TanStack Query | New page, reuses existing patterns |

**Deprecated/outdated:**
- Existing `GET /api/inventory/route.ts`: Entire file is a stub that must be replaced. No reusable logic.

---

## Open Questions

1. **Should `InventoryTransaction` be org-scoped with its own `organizationId`, or inherit it only through `itemId → InventoryItem → organizationId`?**
   - What we know: Every other transaction/activity model in this codebase that belongs to an org (e.g., `ITLoanerCheckout`, `MaintenanceLaborEntry`) carries its own `organizationId` field. This allows the `orgScopedModels` extension to scope reads automatically without join traversal.
   - Recommendation: Add `organizationId` directly to `InventoryTransaction` and add it to `orgScopedModels`. Follow the established pattern.

2. **Should the checkin endpoint accept `transactionId` or look up the most recent open checkout?**
   - What we know: Multiple open checkouts for the same item are possible. `ITLoanerCheckout` is looked up by device + borrower.
   - Recommendation: Accept `transactionId` in the POST body. This makes the operation deterministic and matches how `ITLoanerCheckout` checkin works (device ID + explicit lookup).

3. **Should the sidebar gain an Inventory nav item?**
   - What we know: Inventory is not currently in `Sidebar.tsx`. It is a distinct module (not a sub-module of Maintenance).
   - Recommendation: Add "Inventory" nav item to sidebar in plan 10-03. Icon suggestion: `Archive` or `Package` from Lucide (consistent with existing sidebar icons).

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Smoke tests via `.mjs` scripts (existing pattern) |
| Config file | No Jest/Vitest config detected — project uses smoke scripts against live API |
| Quick run command | `npm run smoke:all` |
| Full suite command | `npm run smoke:all` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Create/update/delete item with category, SKU, quantity | smoke | `node scripts/smoke-inventory.mjs` | ❌ Wave 0 |
| INV-02 | Checkout records actor, time, due date; quantity decrements | smoke | `node scripts/smoke-inventory.mjs` | ❌ Wave 0 |
| INV-03 | Checkin stamps checkedInAt; quantity increments | smoke | `node scripts/smoke-inventory.mjs` | ❌ Wave 0 |
| INV-04 | Transaction log returns all events with actor + timestamp | smoke | `node scripts/smoke-inventory.mjs` | ❌ Wave 0 |
| INV-05 | Reorder alert fires when quantity < threshold | manual-only | Manual: check NotificationBell after checkout below threshold | N/A |
| INV-06 | UI page renders search/filter/transaction drawer | manual-only | Manual: visual inspection in browser | N/A |

### Sampling Rate
- **Per plan completion:** `npm run smoke:all` (existing suite) to verify no regressions
- **After plan 10-01:** `node scripts/smoke-inventory.mjs` (new smoke script)
- **Phase gate:** All smoke tests green + manual UI verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-inventory.mjs` — covers INV-01, INV-02, INV-03, INV-04

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — Verified: existing `InventoryItem` model (lines 549-563), `ITLoanerCheckout` model (lines 2954+), `Notification` model, `AuditLog` model
- `src/lib/db/index.ts` — Verified: `orgScopedModels` Set, `softDeleteModels` Set, extension behavior for create/update/delete
- `src/lib/permissions.ts` — Verified: existing `INVENTORY_READ/CREATE/UPDATE/DELETE` constants, role assignments
- `src/lib/services/notificationService.ts` — Verified: `createBulkNotifications`, `NotificationType` union
- `src/lib/services/maintenanceNotificationService.ts` — Verified: `getUsersWithPermission` pattern, fire-and-forget convention
- `CLAUDE.md` — Verified: API route boilerplate, `$transaction` pitfall, org context pattern, response envelope

### Secondary (MEDIUM confidence)
- `src/app/api/settings/users/[id]/route.ts` — Next.js 15 `params: Promise<{id}>` pattern confirmed
- `src/lib/services/maintenanceAssetService.ts` — Service layer structure reference (Zod schemas + CRUD helpers)
- `src/app/api/inventory/route.ts` — Confirmed stub: no auth, no filters, replace entirely

### Tertiary (LOW confidence)
- Race condition mitigation via Prisma atomic `decrement` + post-check rollback — standard Prisma pattern but not validated against project-specific behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified against package.json and imports
- Architecture: HIGH — all patterns verified from existing codebase files
- Pitfalls: HIGH — org-scope miss, `$transaction` warning, stub auth gap all confirmed from CLAUDE.md and code inspection

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable stack — no fast-moving dependencies)
