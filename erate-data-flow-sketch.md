# E-rate Data Flow — Architecture Sketch

How a school goes from "entered their BEN" to "fully synced E-rate history" inside Lionheart, with a nightly job keeping it fresh. Aimed at the existing Lionheart stack (Next.js 15 + Prisma + Supabase + org-scoped Prisma extension).

---

## 1. The pipeline at 30k feet

```
[Signup w/ BEN]
      │
      ▼
[Resolve entity]  ── USAC Open Data ──► confirm BEN exists, pull profile
      │
      ▼
[Initial backfill]  ── 10 FYs ────────► forms, FRNs, commitments, disbursements
      │                                  vendor info (SPINs), Item 21 line items
      ▼
[Reconcile + classify] ──────────────► group rows into FundingYears,
                                       compute audit-readiness gaps
      │
      ▼
[Done — UI shows timeline]
      │
      ├─► [Nightly cron]  ── delta pull ──► upsert changed rows
      │
      └─► [Email forwarding]  ── erate-{slug}@inbound.lionheart.app
                                 parse USAC notifications, attach to FRNs
```

Two flows: **initial backfill** (one-shot, kicked off at signup) and **nightly delta** (cron, picks up new commitments, disbursements, status changes). Both share the same upsert path so we never have two write codepaths.

---

## 2. USAC Open Data — what it is, how to call it

USAC publishes datasets at `opendata.usac.org` on a Socrata backend. Public, no auth, rate-limited but generous. Update cadence is roughly weekly for most datasets, daily for disbursements during invoice season.

### Datasets we care about

| Dataset | What it is | Natural key |
|---|---|---|
| `e-rate-form-470` | Every Form 470 ever posted | `form_470_application_number` (9 digits) |
| `e-rate-form-471-basic-information` | Application header per applicant per FY | `form_471_application_number` |
| `e-rate-form-471-frn-basic-information` | Each FRN inside a 471 | `frn_number` |
| `e-rate-funding-commitments` | FCDL decisions per FRN | `frn_number` (1:1) |
| `e-rate-disbursements` | BEAR/SPI payments | `(frn_number, invoice_date, amount)` |
| `e-rate-form-486` | Service start confirmation | `form_486_id` |
| `e-rate-item-21-attachments` | Line-item product/service detail per FRN | `(frn_number, line_item_number)` |
| `service-provider-annual-cert-spin` | Vendor info | `spin_number` |

Exact dataset IDs (the Socrata `xxxx-xxxx` slugs) need to be verified against the catalog — they shift occasionally. Ship a `USAC_DATASETS` constants module so the IDs aren't sprinkled across the codebase.

### Query shape

```ts
// src/lib/services/erate/usac-client.ts
const BASE = 'https://opendata.usac.org/resource'

interface SocrataParams {
  $where?: string        // SoQL filter
  $limit?: number        // default 1000, max 50000
  $offset?: number       // pagination
  $order?: string        // e.g. 'funding_year DESC'
  $select?: string       // column projection
}

async function querySocrata<T>(
  datasetId: string,
  params: SocrataParams
): Promise<T[]> {
  const url = new URL(`${BASE}/${datasetId}.json`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { Accept: 'application/json' }
    // Optional: 'X-App-Token': process.env.SOCRATA_APP_TOKEN
    // (lifts rate limits — register a free token at opendata.usac.org)
  })
  if (!res.ok) {
    throw new Error(`Socrata ${datasetId} failed: ${res.status}`)
  }
  return res.json() as Promise<T[]>
}

// Example: pull every FRN for a BEN, last 10 FYs
const frns = await querySocrata<RawFrn>(USAC_DATASETS.frn471, {
  $where: `billed_entity_number = '${ben}' AND funding_year >= 2017`,
  $limit: 50000,
  $order: 'funding_year DESC'
})
```

Note the SoQL injection risk — BEN should be validated as digits-only before interpolation, never user-typed at this point.

### Response shape (real-ish)

A funding commitment row looks roughly like:

```json
{
  "frn_number": "2410123456",
  "form_471_application_number": "241099876",
  "billed_entity_number": "16012345",
  "billed_entity_name": "LINFIELD CHRISTIAN SCHOOL",
  "funding_year": "2024",
  "service_type": "Internet Access",
  "service_category": "Category 1",
  "spin_number": "143009876",
  "service_provider_name": "SPECTRUM BUSINESS",
  "discount_rate": "80",
  "fcc_form_471_certified_date": "2024-03-02T00:00:00.000",
  "wave_number": "12",
  "commitment_status": "Funded",
  "committed_amount": "32000.00",
  "disbursed_amount": "32000.00",
  "last_change_date": "2024-09-15T00:00:00.000"
}
```

`last_change_date` is the killer field — that's what makes nightly delta sync efficient.

---

## 3. Prisma models

Slot in next to existing Lionheart models. All org-scoped through `ERateEntity`. Use the existing soft-delete pattern.

```prisma
// prisma/schema.prisma

model ERateEntity {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])

  ben             String   // Billed Entity Number
  fccRegNumber    String?
  epcNickname     String?
  entityName      String
  entityType      String?  // School, District, Library, Consortium

  lastSyncedAt    DateTime?
  lastSyncCursor  String?  // ISO timestamp for delta queries

  fundingYears    ERateFundingYear[]
  forms470        ERateForm470[]
  forms471        ERateForm471[]
  frns            ERateFRN[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@unique([organizationId, ben])
  @@index([organizationId])
}

model ERateFundingYear {
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String
  entity          ERateEntity @relation(fields: [entityId], references: [id])

  fy              Int
  status          String   // 'awaiting' | 'invoicing' | 'complete'
  totalCommitted  Decimal  @db.Decimal(12, 2) @default(0)
  totalDisbursed  Decimal  @db.Decimal(12, 2) @default(0)
  c1Committed     Decimal  @db.Decimal(12, 2) @default(0)
  c2Committed     Decimal  @db.Decimal(12, 2) @default(0)
  discountRate    Int?

  // Audit-readiness flags computed from related document presence
  hasContracts    Boolean  @default(false)
  hasBids         Boolean  @default(false)
  hasBoardApproval Boolean @default(false)
  hasCipaAttest   Boolean  @default(false)
  hasCat2Inventory Boolean @default(false)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([entityId, fy])
  @@index([organizationId])
}

model ERateForm470 {
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String
  entity          ERateEntity @relation(fields: [entityId], references: [id])

  applicationNumber  String  // 9 digits, USAC's natural key
  fy              Int
  postedDate      DateTime?
  certifiedDate   DateTime?
  allowableContractDate DateTime?
  status          String   // 'Posted' | 'Certified' | 'Cancelled'
  servicesRequested Json   // array of {category, type}

  rawPayload      Json     // entire Socrata row, kept for replay/debugging
  lastSeenAt      DateTime
  sourceLastChangedAt DateTime?

  @@unique([applicationNumber])
  @@index([entityId])
  @@index([organizationId])
}

model ERateForm471 {
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String

  applicationNumber String  // natural key
  fy              Int
  certifiedDate   DateTime?
  status          String

  frns            ERateFRN[]
  rawPayload      Json
  lastSeenAt      DateTime
  sourceLastChangedAt DateTime?

  @@unique([applicationNumber])
  @@index([entityId])
  @@index([organizationId])
}

model ERateFRN {
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String
  form471Id       String?
  form471         ERateForm471? @relation(fields: [form471Id], references: [id])

  frnNumber       String   // natural key, e.g. "2410123456"
  fy              Int
  category        String   // 'C1' | 'C2'
  serviceType     String
  spinNumber      String?
  vendorName      String?
  discountRate    Int?
  preDiscountAmount Decimal? @db.Decimal(12, 2)
  committedAmount Decimal  @db.Decimal(12, 2) @default(0)
  disbursedAmount Decimal  @db.Decimal(12, 2) @default(0)
  commitmentStatus String  // 'Pending' | 'Funded' | 'Denied' | 'Cancelled'
  waveNumber      Int?
  fcdlIssuedDate  DateTime?

  disbursements   ERateDisbursement[]
  documents       ERateDocument[]
  rawPayload      Json
  lastSeenAt      DateTime
  sourceLastChangedAt DateTime?

  @@unique([frnNumber])
  @@index([entityId, fy])
  @@index([organizationId])
}

model ERateDisbursement {
  id              String   @id @default(uuid())
  organizationId  String
  frnId           String
  frn             ERateFRN @relation(fields: [frnId], references: [id])

  invoiceMode     String   // 'BEAR' | 'SPI'
  invoiceDate     DateTime
  amount          Decimal  @db.Decimal(12, 2)
  serviceMonth    String?  // 'YYYY-MM'

  rawPayload      Json
  // Composite natural key (no single ID in source)
  @@unique([frnId, invoiceDate, amount, invoiceMode])
  @@index([organizationId])
}

model ERateDocument {
  // The user-uploaded supporting docs from the prototype's Step 2
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String
  frnId           String?
  fundingYearId   String?

  filename        String
  storagePath     String   // Supabase storage key
  mimeType        String
  sizeBytes       Int

  docType         String   // 'Form 470' | 'Form 471' | 'Vendor Bid' | etc.
  classifiedConfidence String  // 'high' | 'medium' | 'low'
  classifiedFy    Int?

  acceptedByUserId String?
  acceptedAt      DateTime?

  retainUntil     DateTime  // FCC 10-year rule
  uploadedAt      DateTime  @default(now())
  deletedAt       DateTime?

  @@index([organizationId])
  @@index([frnId])
  @@index([fundingYearId])
}

model ERateSyncRun {
  id              String   @id @default(uuid())
  organizationId  String
  entityId        String

  kind            String   // 'initial' | 'delta' | 'manual'
  startedAt       DateTime @default(now())
  finishedAt      DateTime?
  status          String   // 'running' | 'success' | 'partial' | 'failed'

  rowsFetched     Int @default(0)
  rowsUpserted    Int @default(0)
  rowsUnchanged   Int @default(0)
  errors          Json?

  cursorBefore    String?
  cursorAfter     String?

  @@index([entityId, startedAt])
  @@index([organizationId])
}
```

**Why org-scope every model with `organizationId`** even though they descend from `ERateEntity`: the existing Prisma extension auto-injects `organizationId` on read/write inside `runWithOrgContext`. Following the established pattern means existing route handlers Just Work. Cost is one extra column per row, denormalized but cheap.

---

## 4. The sync worker

### Service layer

```ts
// src/lib/services/erate/sync.service.ts
import { rawPrisma } from '@/lib/db'
import { querySocrata, USAC_DATASETS } from './usac-client'

interface SyncContext {
  organizationId: string
  entityId: string
  ben: string
  kind: 'initial' | 'delta' | 'manual'
  /** ISO timestamp — only pull rows newer than this. Null = full pull. */
  since: string | null
}

export async function runSync(ctx: SyncContext): Promise<SyncRunResult> {
  const run = await rawPrisma.eRateSyncRun.create({
    data: {
      organizationId: ctx.organizationId,
      entityId: ctx.entityId,
      kind: ctx.kind,
      status: 'running',
      cursorBefore: ctx.since
    }
  })

  let rowsFetched = 0
  let rowsUpserted = 0
  let rowsUnchanged = 0
  const errors: SyncError[] = []
  const cursorAfter = new Date().toISOString()

  try {
    // Fan out to each dataset. Order matters: parents before children.
    const f470Result = await sync470s(ctx, run.id)
    const f471Result = await sync471s(ctx, run.id)
    const frnResult = await syncFRNs(ctx, run.id)
    const commitResult = await syncCommitments(ctx, run.id)
    const disburseResult = await syncDisbursements(ctx, run.id)
    const f486Result = await sync486s(ctx, run.id)

    rowsFetched = sumFetched([f470Result, f471Result, frnResult, commitResult, disburseResult, f486Result])
    rowsUpserted = sumUpserted([f470Result, f471Result, frnResult, commitResult, disburseResult, f486Result])
    rowsUnchanged = rowsFetched - rowsUpserted

    // Recompute the FundingYear roll-ups from canonical FRN data
    await reconcileFundingYears(ctx)

    await rawPrisma.eRateSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: errors.length === 0 ? 'success' : 'partial',
        rowsFetched,
        rowsUpserted,
        rowsUnchanged,
        cursorAfter,
        errors: errors.length > 0 ? errors : undefined
      }
    })

    await rawPrisma.eRateEntity.update({
      where: { id: ctx.entityId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncCursor: cursorAfter
      }
    })

    return { runId: run.id, rowsFetched, rowsUpserted, rowsUnchanged, errors }
  } catch (error: unknown) {
    await rawPrisma.eRateSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        errors: [{ stage: 'top', message: getErrorMessage(error) }]
      }
    })
    throw error
  }
}
```

### One example dataset sync — FRNs

```ts
async function syncFRNs(ctx: SyncContext, runId: string): Promise<DatasetResult> {
  const filter = [
    `billed_entity_number = '${ctx.ben}'`,
    ctx.since ? `last_change_date > '${ctx.since}'` : null
  ].filter(Boolean).join(' AND ')

  let offset = 0
  const pageSize = 1000
  let totalFetched = 0
  let totalUpserted = 0

  while (true) {
    const rows = await querySocrata<RawFrn>(USAC_DATASETS.frn471, {
      $where: filter,
      $limit: pageSize,
      $offset: offset,
      $order: 'last_change_date ASC'
    })
    if (rows.length === 0) break

    totalFetched += rows.length

    // Batch upsert. rawPrisma.$transaction keeps it atomic per-page.
    const ops = rows.map((row) =>
      rawPrisma.eRateFRN.upsert({
        where: { frnNumber: row.frn_number },
        create: mapFrnCreate(ctx, row),
        update: mapFrnUpdate(row)
      })
    )
    await rawPrisma.$transaction(ops)
    totalUpserted += rows.length

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { fetched: totalFetched, upserted: totalUpserted }
}

function mapFrnCreate(ctx: SyncContext, row: RawFrn) {
  return {
    organizationId: ctx.organizationId,
    entityId: ctx.entityId,
    frnNumber: row.frn_number,
    fy: parseInt(row.funding_year, 10),
    category: row.service_category === 'Category 1' ? 'C1' : 'C2',
    serviceType: row.service_type,
    spinNumber: row.spin_number,
    vendorName: row.service_provider_name,
    discountRate: parseInt(row.discount_rate, 10),
    committedAmount: row.committed_amount,
    disbursedAmount: row.disbursed_amount,
    commitmentStatus: row.commitment_status,
    rawPayload: row,
    lastSeenAt: new Date(),
    sourceLastChangedAt: row.last_change_date ? new Date(row.last_change_date) : null
  }
}

function mapFrnUpdate(row: RawFrn) {
  // Same shape minus the keys that don't change after creation.
  return {
    committedAmount: row.committed_amount,
    disbursedAmount: row.disbursed_amount,
    commitmentStatus: row.commitment_status,
    vendorName: row.service_provider_name,
    discountRate: parseInt(row.discount_rate, 10),
    rawPayload: row,
    lastSeenAt: new Date(),
    sourceLastChangedAt: row.last_change_date ? new Date(row.last_change_date) : null
  }
}
```

### Reconciliation — funding year rollups

```ts
async function reconcileFundingYears(ctx: SyncContext) {
  const frns = await rawPrisma.eRateFRN.findMany({
    where: { entityId: ctx.entityId },
    select: { fy: true, category: true, committedAmount: true, disbursedAmount: true, commitmentStatus: true }
  })

  const byYear = new Map<number, FundingYearRollup>()
  for (const frn of frns) {
    const r = byYear.get(frn.fy) ?? blankRollup(frn.fy)
    r.totalCommitted = r.totalCommitted.plus(frn.committedAmount)
    r.totalDisbursed = r.totalDisbursed.plus(frn.disbursedAmount)
    if (frn.category === 'C1') r.c1Committed = r.c1Committed.plus(frn.committedAmount)
    if (frn.category === 'C2') r.c2Committed = r.c2Committed.plus(frn.committedAmount)
    r.statuses.add(frn.commitmentStatus)
    byYear.set(frn.fy, r)
  }

  for (const [fy, rollup] of byYear) {
    await rawPrisma.eRateFundingYear.upsert({
      where: { entityId_fy: { entityId: ctx.entityId, fy } },
      create: {
        organizationId: ctx.organizationId,
        entityId: ctx.entityId,
        fy,
        status: deriveYearStatus(rollup),
        totalCommitted: rollup.totalCommitted,
        totalDisbursed: rollup.totalDisbursed,
        c1Committed: rollup.c1Committed,
        c2Committed: rollup.c2Committed
      },
      update: {
        status: deriveYearStatus(rollup),
        totalCommitted: rollup.totalCommitted,
        totalDisbursed: rollup.totalDisbursed,
        c1Committed: rollup.c1Committed,
        c2Committed: rollup.c2Committed
      }
    })
  }
}

function deriveYearStatus(r: FundingYearRollup): 'awaiting' | 'invoicing' | 'complete' {
  if (r.statuses.has('Pending')) return 'awaiting'
  if (r.totalDisbursed.lt(r.totalCommitted)) return 'invoicing'
  return 'complete'
}
```

---

## 5. De-dup strategy

The whole flow is built on **upserts keyed on USAC's natural identifiers**. Replay-safety is the goal — running the sync twice with the same data should be a no-op.

| Entity | Natural key | Why |
|---|---|---|
| Form 470 | `applicationNumber` (9 digits) | USAC-issued, never changes |
| Form 471 | `applicationNumber` | Same |
| FRN | `frnNumber` (10 digits) | The atomic unit of E-rate funding |
| Form 486 | `form_486_id` | USAC issues |
| Commitment | FRN (1:1 relationship in our schema) | Folded into FRN row to avoid second join |
| Disbursement | `(frnId, invoiceDate, amount, invoiceMode)` | No source ID; composite is stable enough |
| Vendor | `spinNumber` | Could be a global ref table — same SPIN serves many BENs |

**Delta cursor**: `entity.lastSyncCursor` is the ISO timestamp of the previous run's start. Next run filters `last_change_date > cursor`. We deliberately overlap (use start time, not finish time) so in-flight rows aren't missed.

**Drift detection**: The `rawPayload` JSON column lets us replay or audit. If USAC silently changes a field (it happens), we can diff old vs new and surface that as a notification.

---

## 6. Where it slots into Lionheart

```
src/
  app/
    api/
      erate/
        sync/
          route.ts            POST /api/erate/sync   — manual trigger (admin only)
        entity/
          route.ts            GET/POST — manage entity (BEN, profile)
        frns/
          route.ts            GET — list FRNs for current org
        funding-years/
          route.ts            GET — timeline data for the year-cards UI
        documents/
          route.ts            GET/POST — uploaded docs
          [id]/route.ts       PATCH — accept/edit classification
      cron/
        erate-sync/
          route.ts            POST — Vercel Cron, fans out per entity
  lib/
    services/
      erate/
        usac-client.ts        Socrata wrapper
        sync.service.ts       Orchestrator
        sync-470.ts           One per dataset
        sync-471.ts
        sync-frns.ts
        sync-commitments.ts
        sync-disbursements.ts
        sync-486.ts
        reconcile.ts          Roll-ups + audit-readiness flags
        classify.service.ts   The same classifier from the prototype, server-side
        retention.service.ts  Computes retainUntil, surfaces expiring docs
```

### Route handler example

```ts
// src/app/api/erate/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { runSync } from '@/lib/services/erate/sync.service'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ERATE_SYNC)

    return await runWithOrgContext(orgId, async () => {
      const entity = await prisma.eRateEntity.findFirst()
      if (!entity) {
        return NextResponse.json(
          fail('NOT_FOUND', 'Connect a BEN before syncing'),
          { status: 404 }
        )
      }

      const result = await runSync({
        organizationId: orgId,
        entityId: entity.id,
        ben: entity.ben,
        kind: 'manual',
        since: entity.lastSyncCursor
      })

      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Sync failed'), { status: 500 })
  }
}
```

### The cron entry

```ts
// src/app/api/cron/erate-sync/route.ts
import { rawPrisma } from '@/lib/db'
import { runSync } from '@/lib/services/erate/sync.service'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Pull every entity that hasn't synced in the last 18 hours
  const cutoff = new Date(Date.now() - 18 * 60 * 60 * 1000)
  const entities = await rawPrisma.eRateEntity.findMany({
    where: {
      deletedAt: null,
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: cutoff } }
      ]
    },
    select: { id: true, organizationId: true, ben: true, lastSyncCursor: true },
    take: 500  // process in chunks; cron runs hourly
  })

  const results = await Promise.allSettled(
    entities.map((e) =>
      runSync({
        organizationId: e.organizationId,
        entityId: e.id,
        ben: e.ben,
        kind: 'delta',
        since: e.lastSyncCursor
      })
    )
  )

  const summary = {
    total: entities.length,
    succeeded: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length
  }
  return Response.json(summary)
}
```

Vercel Cron config in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/erate-sync", "schedule": "17 */1 * * *" }
  ]
}
```

(Top of every hour + 17 min — staggered off the hour to dodge platform spikes.)

---

## 7. The signup flow — from BEN entry to populated dashboard

```
1. User completes signup (existing organizationRegistrationService.createOrganization)
2. User redirected to /onboarding/erate
3. User types BEN → POST /api/erate/entity
   {
     ben: "16012345"
   }
   ──► Validates BEN format (8 digits, regex)
       Calls querySocrata to confirm BEN exists in Form 471 dataset
       Creates ERateEntity record
       Enqueues initial sync (don't block the request)
       Returns { entity, syncRunId }

4. Client polls GET /api/erate/sync/{runId} for progress
   ──► During this poll, the prototype's "10 years populating" animation runs
       FundingYears appear as soon as reconcile() finishes
       Background sync continues filling in detail (FRNs, commitments, disbursements)

5. Sync finishes → user lands on populated timeline
6. Optional: prompt to upload supporting docs OR skip to dashboard
   (per the earlier "make Step 2 skippable" recommendation)
```

For the initial sync, **don't run it in the request thread**. Two options:

- **Inngest / Trigger.dev / QStash** — proper job queue, retries, observability. Probably worth the dependency once you have >50 schools.
- **Fire-and-forget Promise** + status polling — fine for MVP, breaks if the serverless function times out (10s on Vercel Hobby, 60s on Pro).

For MVP, **fire-and-forget with status polling** is fine because the bulk of the work is fetching from a fast public API and batched upserting — should finish well under 60s for 10 years of one BEN.

---

## 8. Failure modes & gotchas

**USAC dataset ID drift.** Socrata occasionally re-publishes datasets with new IDs. Centralize in `USAC_DATASETS` constant + add a smoke test that checks every ID returns 200 OK with at least one row.

**Rate limiting.** Anonymous Socrata calls cap around 1000/hour per IP. With many orgs syncing concurrently from the same Vercel egress, you'll hit it. Register a free Socrata app token (env: `SOCRATA_APP_TOKEN`), pass it as the `X-App-Token` header — that lifts the cap dramatically.

**FY 2017+ only.** Open Data only goes back ~10 years. Older history is genuinely lost from this source. If a customer needs deeper history (rare — FCC retention only requires 10), they'd have to pull from EPC manually or accept the gap.

**The 28-day Form 470 window.** Open Data shows the 470 was posted but doesn't tell you "the 28-day quiet period ends on this date." Compute it client-side: `postedDate + 28 days`. Surface as a deadline.

**Disbursement double-counting.** USAC re-issues corrected disbursement rows occasionally. The composite `(frn, date, amount, mode)` key handles most cases but not amount-corrections to the same invoice. Watch for rows where summing disbursements > committed — that's the canary.

**Multi-BEN entities.** Districts often have one BEN for the district plus one per school. Schema supports it (one Org → many ERateEntity). The signup flow needs to handle "discover related BENs" — Open Data Form 471 has a `child_entities` array that exposes this.

**Nightly cron at scale.** The fan-out pattern (`Promise.allSettled` over 500 entities per run) works for hundreds. Past ~2k entities you want a real queue — Vercel function execution time and concurrency become the bottleneck.

**Soft-delete + retention.** When a user deletes an `ERateDocument`, we soft-delete and keep until `retainUntil` passes. The cron also needs a sweep that hard-deletes rows past their retention date — give that its own scheduled task with its own audit log.

**Backfill cost.** First sync for a 10-year district can pull ~2-5k rows across all datasets. Each is a small upsert. Whole thing should land in 15-40 seconds wall clock. Don't bother streaming progress for the first run — show the prototype's animated timeline and let it be a delightful 30 seconds, not a progress bar to obsess over.

---

## 9. What's NOT in this sketch

Things to design separately, after this lands:

- **Email-forwarding ingest** (`erate-{slug}@inbound.lionheart.app`) — needs Postmark/SendGrid inbound + parsing logic.
- **Cloud-storage scanner** (Drive/OneDrive/Box) — needs OAuth flow per org + reuse of the classifier.
- **Vendor portal scrapers** — security review required before going down this road.
- **Audit-readiness scoring** — the math is light (count missing docs per FY, weight by audit frequency) but the UX of how it's surfaced needs its own design pass.
- **Alerts and deadlines** — once we have FY status, generating Form 471 window / 486 due / BEAR deadline reminders is a separate notification service.
- **EPC bridge** (browser extension or otherwise) — defer until customer signal.
