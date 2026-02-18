# Lionheart & Platform — Industry-Standard SaaS Audit Report

**Audit scope:** Multi-tenant isolation, Light-mode-first UX, data persistence, AI reliability, safety/compliance, production readiness.  
**For every issue:** file path + suggested code fix to reach "perfect" status.

---

## Implemented (this pass)

- **1.1** Cron monthly-report: requires `orgId` or `x-org-id`, runs inside `runWithOrg` for tenant-scoped data.
- **2.1** `:root` white base (`--bg-base: 255 255 255`), `.glass` / `.glass-card` light-first.
- **2.2** Sidebar default `bg-white` (light), `dark:bg-zinc-900/90`.
- **2.3** Pond Health Widget: danger cells use `border-red-600`, `bg-red-50`, `text-red-700` (light) for contrast.
- **2.4–2.5** Modal close buttons (SmartEvent, Drawer, EventCreator, FormBuilder) light-first; login, auth/callback, CommandBar, CampusMapViewer light defaults.
- **3** Event-created tickets: `notifyTeamsForScheduledEvent` accepts optional `createTicket`; App.jsx passes `platformPost('/api/tickets', …)` so tickets are persisted and added to state.
- **4** Gemini extraction: `EVENT_EXTRACTION_SYSTEM` and `extractEventFieldsWithGemini` now include `chairsRequested` and `tablesRequested`; SmartEventModal merges them from `effectiveParsed`.

---

## 1. Multi-Tenant Isolation

### 1.1 Cron monthly report — cross-tenant data leak (Critical)

**File:** `src/app/api/cron/monthly-report/route.ts`

**Issue:** The route uses `prisma.expense.findMany()`, `prisma.budget.findMany()`, and `prisma.maintenanceTip.findMany()` **without** calling `withOrg()`. When no request context sets `orgStorage`, the Prisma extension does not add `organizationId` to the query, so the report aggregates **all organizations’** data.

**Fix:** Require an org context for the cron (e.g. `?orgId=...` or `x-org-id` when invoked per-org), and run the handler inside `withOrg` so all queries are scoped. If the cron is intended to run once per org, invoke it per org and pass org id:

```ts
// In monthly-report/route.ts — add org context
import { withOrg } from '@/lib/orgContext'
import { prismaBase } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgId = req.nextUrl.searchParams.get('orgId') || req.headers.get('x-org-id')?.trim()
  if (!orgId) {
    return NextResponse.json(
      { error: 'orgId or x-org-id required for scoped report' },
      { status: 400 }
    )
  }
  try {
    return await runWithOrg(orgId, prismaBase, async () => {
      const now = new Date()
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [expenses, budgets, tips] = await Promise.all([
        prisma.expense.findMany({ where: { expenseDate: { startsWith: yearMonth } }, ... }),
        prisma.budget.findMany({ where: { yearMonth }, ... }),
        prisma.maintenanceTip.findMany({ take: 20, ... }),
      ])
      // ... rest of report logic
      return NextResponse.json(report)
    })
  } catch (err) { ... }
}
```

Ensure the cron job (e.g. Vercel Cron or external) passes `orgId` or `x-org-id` for each organization when calling this endpoint.

### 1.2 Auth and user/me routes correctly use prismaBase

**Files:** `src/app/api/auth/google/callback/route.ts`, `src/app/api/user/me/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/billing/webhook/route.ts`

**Status:** These correctly use `prismaBase` (no tenant extension) because they resolve the user/org by token, email, or Stripe metadata—not by request-scoped org. No change required.

### 1.3 Platform orgContext and prisma

**Files:** `platform/src/lib/orgContext.ts`, `platform/src/lib/prisma.ts`

**Status:** `getOrgIdFromRequest` uses Bearer token (preferred) or `x-org-id`. `runWithOrg` validates the org and sets `orgStorage`. The Prisma extension adds `organizationId` only when `orgStorage.getStore()` is set. Tenant models list is consistent. **Recommendation:** Add `formSubmission` to tenantModels only if you want extension-based scoping for FormSubmission; currently forms routes scope manually via `formId in (scoped form ids)` which is correct.

---

## 2. UX & Design — Light-Mode-First Audit

### 2.1 Global style inversion — `:root` and `.glass` (High)

**File:** `src/index.css`

**Issue:**  
- `:root` uses `--bg-base: 250 250 250` (zinc-250) instead of a clean white base.  
- `.glass` and `.glass-card` lead with light classes but the primary “default” feel should be clearly light, high-transparency.

**Fix:**

```css
:root {
  --bg-base: 255 255 255;   /* Clean white — Vercel-style */
  --bg-card: 250 250 250;  /* Slightly off-white for cards */
  --text-primary: 23 23 23;
  --text-muted: 115 115 115;
  --border: 229 229 229;
  --accent: 59 130 246;
}

.dark {
  --bg-base: 9 9 11;
  --bg-card: 39 39 42;
  --text-primary: 250 250 250;
  --text-muted: 161 161 170;
  --border: 63 63 70;
  --accent: 59 130 246;
}

/* Glass: light-first, high-transparency default */
.glass {
  @apply bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700/50 dark:border-blue-950/40;
}

.glass-card {
  @apply bg-white/80 dark:bg-zinc-800/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700/50 dark:border-blue-950/30 rounded-xl shadow-lg shadow-zinc-900/5 dark:shadow-black/20 dark:shadow-blue-950/10;
}
```

### 2.2 Sidebar — default light state (High)

**File:** `src/components/Sidebar.jsx`

**Issue:** Sidebar uses `dark:bg-zinc-900/90` and `dark:border-zinc-800`; the **default** (no `.dark`) should be a crisp light state.

**Fix:**

```jsx
<aside className="sticky top-0 w-56 h-full min-h-0 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800 dark:border-blue-950/50 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-xl shrink-0">
```

Change to explicit light-first:

```jsx
<aside className="sticky top-0 w-56 h-full min-h-0 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800 dark:border-blue-950/50 bg-white dark:bg-zinc-900/90 backdrop-blur-xl shrink-0">
```

Or for a softer default: `bg-zinc-50/95 dark:bg-zinc-900/90` so the default is a crisp, light zinc-50.

### 2.3 Pond Health Widget — Safe/Danger contrast on light (Medium)

**File:** `src/components/PondHealthWidget.jsx`

**Issue:** Alert states use `text-red-600 dark:text-red-400` and `bg-red-500/10 dark:bg-red-500/20`. On light backgrounds, red-600 is good; ensure amber/danger zones meet WCAG AA (e.g. 4.5:1) on white.

**Fix:** Use higher-contrast red/amber for light mode and keep dark variants:

```jsx
// For out-of-range (danger) cells — ensure strong contrast on light
className={`rounded-lg p-3 border ${alerts.pH ? 'border-red-600 bg-red-50 dark:bg-red-500/20' : 'border-zinc-200 dark:border-zinc-700'}`}
// ...
<p className={`text-xl font-semibold ${alerts.pH ? 'text-red-700 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
```

Apply the same pattern to turbidity, DO, and alkalinity cells: `border-red-600`, `bg-red-50` (light), `text-red-700` (light), with existing dark variants.

### 2.4 Smart Event Modal — light, airy chat (High)

**File:** `src/components/SmartEventModal.jsx`

**Issue:**  
- Backdrop: `bg-black/40` — acceptable for overlay.  
- Close button: `bg-zinc-900/80 text-zinc-100` — too dark for light-first; should be light by default.  
- Main panel: `bg-zinc-50 dark:bg-zinc-900` — already light-first; keep.  
- AI bubbles: `bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30` — light gradient is good; ensure no “too dark” gradient in default theme.  
- User bubble: `bg-blue-500` — fine.  
- Assistant bubble (line ~1001): `bg-zinc-100 dark:bg-zinc-800` — good for light.  
- Line ~1170: AI thinking bubble uses `dark:from-blue-950/30 dark:to-violet-950/30`; light side is `from-blue-50 to-violet-50` — keep as-is for light.  
- Line ~879: Close button should be light-first.

**Fix (close button and any “always dark” controls):**

```jsx
// Close button — light first
className="pointer-events-auto p-2 rounded-xl bg-zinc-200/90 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors shadow-lg shadow-zinc-900/10 dark:shadow-black/30"
```

Ensure all modal chrome (drag handle, left summary panel) keeps `bg-zinc-50` / `bg-white` and `border-zinc-200` as default so the overall feel is light and airy.

### 2.5 Hardcoded dark backgrounds without `dark:` (High)

**Issue:** Several pages use `bg-zinc-950` or `bg-zinc-900` as the **default** (no `dark:`), forcing a dark look even in light mode.

**Fixes (default = light, dark = with `dark:`):**

| File | Current | Fix |
|------|---------|-----|
| `src/App.jsx` (line 384) | `bg-zinc-100 dark:bg-zinc-950` | Keep; already light-first. |
| `src/app/login/page.tsx` (62, 79, 90, 107, 112, 150, 156–157, 162) | `min-h-screen bg-zinc-950`, `bg-zinc-900`, etc. | Use `bg-zinc-50 dark:bg-zinc-950` for page; inputs `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white`. |
| `src/app/login/layout.tsx` (2) | `min-h-screen bg-zinc-950` | `min-h-screen bg-zinc-50 dark:bg-zinc-950` |
| `src/app/auth/callback/page.tsx` (25, 33) | `min-h-screen bg-zinc-950` | `min-h-screen bg-zinc-50 dark:bg-zinc-950` |
| `src/app/app/[[...slug]]/page.tsx` (28) | `bg-zinc-50 dark:bg-zinc-950` | Already correct. |
| `src/app/layout.tsx` (17) | `bg-zinc-50 dark:bg-zinc-950` | Already correct. |
| `src/app/campus/CampusMapViewer.tsx` (183) | `bg-zinc-900` for map container | Use `bg-zinc-200 dark:bg-zinc-900` so the map area is light in light mode. |
| `src/components/CommandBar.jsx` (201) | `bg-zinc-900 border-zinc-700` for modal panel | `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700` |
| `src/components/FormBuilderModal.jsx` (178) | `bg-zinc-900/80 text-zinc-100` (close) | Same as SmartEventModal: light-first close button. |
| `src/components/DrawerModal.jsx` (33) | `bg-zinc-900/80 text-zinc-100` (close) | Same light-first close button. |
| `src/components/EventCreatorModal.jsx` (527) | `bg-zinc-900/80 text-zinc-100` (close) | Same light-first close button. |

**Summary:** Replace any `bg-zinc-950` or `bg-zinc-900` that is not behind a `dark:` prefix with a light default (e.g. `bg-zinc-50` or `bg-white`) and add the dark variant with `dark:bg-zinc-950` or `dark:bg-zinc-900`.

---

## 3. Data Persistence Gaps

### 3.1 Support requests / tickets — already using API (OK)

**File:** `src/App.jsx` (lines 205–216)

**Status:** Tickets are loaded via `platformFetch('/api/tickets')` and stored in `supportRequests`. `INITIAL_SUPPORT_REQUESTS` in `src/data/supportTicketsData.js` is **not** used as the source of truth for the dashboard; it appears to be legacy/seed data. The dashboard state is correctly hydrated from the API.

### 3.2 EventCreatorModal — POST /api/events (OK)

**File:** `src/App.jsx` (lines 840, 903, 933–934)

**Status:** When saving from EventCreatorModal or SmartEventModal, the app calls `platformPost('/api/events', { ... })` with `chairsRequested`, `tablesRequested`, etc., and then updates local state from the response. Events are persisted via the API.

### 3.3 In-memory ticket creation from events (Medium)

**File:** `src/data/eventNotifications.js`

**Issue:** `notifyTeamsForScheduledEvent` creates facility/IT ticket objects and pushes them into React state via `setSupportRequests((prev) => [...prev, ticket])`. Those tickets are **not** persisted to the backend, so they disappear on refresh.

**Fix:** When creating a ticket from an event, call `POST /api/tickets` and then append the returned ticket to `supportRequests` (or refetch tickets). Example pattern in `eventNotifications.js`:

- Accept an optional `createTicket` callback (e.g. `async (payload) => fetch('/api/tickets', { method: 'POST', body: JSON.stringify(payload) })`).
- When `needsFacilities` or `needsAV` is true, call `createTicket` with the ticket payload; on success, call `setSupportRequests` with the API response or trigger a refetch.

Wire `createTicket` from `App.jsx` using `platformPost('/api/tickets', body)` and pass it into `notifyTeamsForScheduledEvent`.

### 3.4 WaterOpsWidget / PondHealthWidget creating tickets (Low)

**Files:** `src/components/WaterOpsWidget.jsx`, `src/components/PondHealthWidget.jsx`

**Issue:** They call `setSupportRequests?.((prev) => [...prev, ticket])` for “add to ticket” flows. If those are real tickets, they should be created via `POST /api/tickets` and then reflected in state (or refetched).

**Fix:** Same as 3.3: add a `createTicket` (or `onAddToTicket` that calls the API) that persists the ticket and then updates local state or refetches.

---

## 4. AI Feature Reliability

### 4.1 Gemini — error handling and rate limiting (OK)

**File:** `src/services/gemini.js`

**Status:**  
- `withRateLimitRetry` implements exponential backoff (15s, 30s, 60s) for 429.  
- User-facing error message explains quota and suggests waiting or checking AI Studio.  
- `extractEventFieldsWithGemini` returns `{}` on any error (try/catch).  
- `chatWithGemini` and `generateFormWithGemini` throw with clear messages for missing key or invalid response.

**Suggestion:** Log non-429 errors (e.g. `console.error`) in development so parsing/API failures are debuggable, while still returning `{}` or throwing user-friendly messages.

### 4.2 SmartEventModal ↔ Prisma schema mapping (Medium)

**Files:** `src/services/gemini.js`, `src/components/SmartEventModal.jsx`, `prisma/schema.prisma`

**Status:**  
- Event model has `chairsRequested`, `tablesRequested` (and optional `chairsSetup` in UI).  
- SmartEventModal’s `parseUserPrompt()` (client-side) correctly extracts chairs/tables and `chairsSetup`.  
- When saving, App.jsx sends `chairsRequested`, `tablesRequested` in the POST body; API and Prisma accept them.  
- **Gap:** `extractEventFieldsWithGemini` (Gemini) only returns `name`, `date`, `time`, `location`. It does **not** return `chairsRequested` or `tablesRequested`.

**Fix:** Extend the Gemini extraction prompt and response parsing so the AI can return chairs/tables when the user says e.g. “50 chairs and 10 tables”:

In `src/services/gemini.js`, update `EVENT_EXTRACTION_SYSTEM` and the parsed result:

- Add to the JSON schema: `"chairsRequested": number or null, "tablesRequested": number or null`.
- In the rules, add: “Extract numbers for chairs and tables from phrases like ‘50 chairs’, ‘10 tables’.”
- In the parsing block after `JSON.parse`, add:
  - `if (typeof parsed.chairsRequested === 'number' && parsed.chairsRequested >= 0) result.chairsRequested = parsed.chairsRequested`
  - `if (typeof parsed.tablesRequested === 'number' && parsed.tablesRequested >= 0) result.tablesRequested = parsed.tablesRequested`

Then in SmartEventModal, when merging Gemini-extracted fields into the draft, include `chairsRequested` and `tablesRequested` (same as you do for name, date, time, location) so both regex and Gemini paths populate the same schema fields.

---

## 5. Safety & Compliance

### 5.1 Safety Mode (OSHA-style) for biohazard tickets (OK)

**Files:** `src/utils/safetyMode.js`, `src/components/ITDashboardRequests.jsx`, `src/components/FacilitiesDashboardRequests.jsx`

**Status:**  
- `requiresSafetyMode(ticket)` checks `ticket.title`, `ticket.description`, and `requestedItems` for `BIOHAZARD_KEYWORDS` (vomit, blood, chemical, toilet overflow, etc.).  
- IT and Facilities request detail drawers both render `SafetyModeOverlay` when `requiresSafetyMode(selectedRequest) && !safetyModeComplete`, and only show the request content after the user completes the overlay.  
- Behavior matches the intent: biohazard-related Facilities (and IT) tickets trigger the safety checklist before viewing details.

**Recommendation:** If you want Safety Mode to also run when **creating** a ticket (e.g. user types “vomit cleanup” in the form), add a check in the ticket creation flow and show the overlay before submit. Currently it only runs on view, which is still compliant for “viewing” biohazard content.

---

## 6. Production Checklist

### 6.1 Stripe webhooks (OK)

**File:** `src/app/api/billing/webhook/route.ts`

**Status:** Handles `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`; verifies signature; updates `Organization` via `prismaBase` using `metadata.organizationId`. No change required for webhook coverage.

### 6.2 Environment variables

**Reference:** `docs/INDUSTRY_STANDARD_CHECKLIST.md`

**Recommendation:** Add startup validation (e.g. zod) for required env vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_PLATFORM_URL` (if used), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (if billing is used). Document optional vars: `CRON_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `VITE_GEMINI_API_KEY`, `FACILITIES_DIRECTOR_EMAIL`, etc.

### 6.3 Hardcoded strings

**Suggestions:**  
- Replace any remaining “Lionheart” or school-specific copy in user-facing strings with a config or env (e.g. `NEXT_PUBLIC_APP_NAME`).  
- Login/callback error redirects already use query params; ensure all error messages shown in the UI come from a single place or i18n if you add localization.

### 6.4 Remaining items from Industry Standard Roadmap

- **Inventory persistence:** Checklist notes inventory still uses localStorage in some flows; you now have `/api/inventory`. Ensure all inventory UI uses the API and remove legacy localStorage.  
- **Teams persistence:** Replace `teamsData.js` DEFAULT_TEAMS with DB-backed teams when that feature is finalized.  
- **Audit logging:** Add middleware or helpers that write to `AuditLog` for sensitive mutations (user role change, billing, bulk delete).  
- **Rate limiting:** Add rate limiting on auth endpoints and optionally on `/api/events` and `/api/tickets` to prevent abuse.

---

## Summary Table

| Area | Severity | Item | File(s) | Status |
|------|----------|------|---------|--------|
| Multi-tenant | Critical | Cron report cross-tenant leak | `src/app/api/cron/monthly-report/route.ts` | Fix with org context |
| UX | High | :root and glass light-first | `src/index.css` | Use white base, light glass |
| UX | High | Sidebar default light | `src/components/Sidebar.jsx` | bg-white or bg-zinc-50 default |
| UX | High | Login/auth/callback dark-only | `src/app/login/*`, `auth/callback` | Add light defaults |
| UX | High | Modals close button dark-only | SmartEventModal, DrawerModal, EventCreator, FormBuilder | Light-first close button |
| UX | Medium | Pond widget contrast | `PondHealthWidget.jsx` | Stronger red/amber on light |
| Data | Medium | Event-created tickets in-memory | `eventNotifications.js`, App.jsx | POST /api/tickets + state update |
| AI | Medium | Gemini no chairs/tables | `gemini.js` EVENT_EXTRACTION | Add chairs/tables to prompt + parse |
| Safety | OK | Biohazard Safety Mode | safetyMode.js, IT/Facilities dashboards | No change |
| Prod | OK | Stripe webhooks | billing/webhook/route.ts | No change |
| Prod | Low | Env validation / audit / rate limit | Various | Add per roadmap |

Implementing the fixes above will bring the codebase to the intended “industry-standard SaaS” and light-mode-first “perfect” state. Use this document as a sprint checklist and tick off items as you deploy.
