# Lionheart & Platform — Technical Audit Report

**Role:** Senior Full-Stack Engineer / Software Architect  
**Scope:** Theme engine, state/data integrity, multi-tenant security, AI integration debt, React performance.  
**For each finding:** file path, technical risk, and concrete code fix.

---

## 1. Theme Engine & CSS Variables

### 1.1 Root variables — correct (no change)

**File:** `src/index.css`

**Status:** `:root` correctly uses Vercel-style light palette: `--bg-base: 255 255 255`, `--bg-card: 250 250 250`. `.dark` overrides are scoped. Body uses `rgb(var(--bg-base))` and `rgb(var(--text-primary))`.

### 1.2 Component-level styles not using CSS variables (Medium — theme consistency)

**File:** `src/index.css`

**Risk:** `.glass` and `.glass-card` use Tailwind classes (`bg-white/70`, `border-zinc-200`, etc.) instead of CSS variables. Theme switching works only via `.dark`; future themes (e.g. high-contrast, custom brand) would require duplicating rules. Light-mode-first is satisfied; systemic theme consistency is not.

**Fix:** Use variables for backgrounds/borders where possible so a single variable set drives both default and dark:

```css
/* Glass: variable-driven for systemic theme switching */
.glass {
  background-color: rgb(var(--bg-base) / 0.7);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgb(var(--border));
}
.dark .glass {
  background-color: rgb(var(--bg-base) / 0.8);
  border-color: rgb(63 63 70 / 0.5);
}

.glass-card {
  background-color: rgb(var(--bg-card) / 0.9);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgb(var(--border));
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05);
}
.dark .glass-card {
  background-color: rgb(var(--bg-card) / 0.9);
  border-color: rgb(63 63 70 / 0.5);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2);
}
```

Keep Tailwind utilities for spacing/shadows if desired; the important part is background and border using `var(--bg-base)`, `var(--bg-card)`, `var(--border)`.

### 1.3 Hardcoded hex in form overrides (Low)

**File:** `src/index.css` (e.g. `form-builder-light`, `split-form-panel`)

**Risk:** Rules like `background-color: rgb(255 255 255) !important` bypass the variable system. For strict light-mode-first and future themes, prefer variables.

**Fix:** Where a “forced light” panel is intentional, use the variable so it stays consistent:

```css
.split-form-panel {
  background-color: rgb(var(--bg-card)) !important;
}
.form-builder-light .form-builder-palette .form-builder-search,
.form-preview-light input,
/* etc. */
{
  background-color: rgb(var(--bg-card)) !important;
  border-color: rgb(var(--border)) !important;
}
```

(Ensure `:root` defines `--bg-card` as above; already 250 250 250.)

---

## 2. State Management & Data Integrity

### 2.1 Static mock data used instead of API (High — data integrity)

**Files:**  
- `src/components/TicketingTable.jsx` — uses in-file `mockSales` for “Ticketing & Sales Hub”; no fetch.  
- `src/data/supportTicketsData.js` — exports `INITIAL_SUPPORT_REQUESTS`; dashboard correctly loads from `GET /api/tickets` and does not use this as source of truth. Legacy export only; filter helpers use it if passed.  
- `src/App.jsx` — initial state uses `INITIAL_EVENTS`, `INITIAL_USERS`, `INITIAL_FORMS`, etc.; these are overwritten by API in `useEffect`. Risk is brief placeholder state, not wrong persisted data.

**Technical risk:** **Stale / wrong data:** TicketingTable always shows mock sales; users may believe it’s real. No backend for “ticket sales” yet, so this is a product gap as well as technical debt.

**Fix (TicketingTable):** Either wire to a real API when available, or clearly treat as placeholder and fetch when the feature exists:

```jsx
// src/components/TicketingTable.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Ticket } from 'lucide-react'
import { platformFetch } from '../services/platformApi'

const PLACEHOLDER_SALES = [
  { id: 1, event: 'Spring Gala 2025', buyer: 'J. Smith', qty: 2, amount: 40, date: 'Feb 8, 2025' },
  // ...
]

export default function TicketingTable() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [usePlaceholder, setUsePlaceholder] = useState(false)

  useEffect(() => {
    let cancelled = false
    platformFetch('/api/events/ticket-sales') // or whatever endpoint you add
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data)) setSales(data)
        else setUsePlaceholder(true)
      })
      .catch(() => setUsePlaceholder(true))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const rows = usePlaceholder || sales.length === 0 ? PLACEHOLDER_SALES : sales
  // ... render rows; if (usePlaceholder) show a small "Sample data" badge
}
```

If no API exists yet, at minimum add a visible “Sample data” label so users don’t treat it as real.

### 2.2 EventCreatorModal / SmartEventModal — API integration and payload vs schema (Medium)

**Files:** `src/App.jsx` (onSave handlers), `src/app/api/events/route.ts`, `platform/prisma/schema.prisma` (Event model)

**Status:** Both modals call `platformPost('/api/events', { name, description, date, startTime, endTime, chairsRequested, tablesRequested, submittedById })`. Payload matches the API and Event model for those fields.

**Gap:** Event model has `roomId` (optional). The modals send `payload.location` (room name) for local state but do **not** send `roomId` to the API. So created events are stored with `roomId: null`. GET /api/events returns `room` from relation; calendar shows `e.room?.name`. So room is never set on create.

**Technical risk:** **Schema/API mismatch:** Backend and Prisma support room; frontend does not persist room on create, so calendar events lack room linkage and routing (e.g. `getRoutedToIds(roomId)`) cannot run for these events.

**Fix:** Resolve location to roomId before POST (e.g. from `/api/rooms` list) and send it:

```javascript
// In App.jsx onSave for both modals, before platformPost:
let roomId = payload.roomId
if (!roomId && payload.location && roomsFromApi.length) {
  const room = roomsFromApi.find(
    (r) => r.name?.toLowerCase() === payload.location?.toLowerCase()
  )
  if (room) roomId = room.id
}
await platformPost('/api/events', {
  name: payload.name,
  description: payload.description || undefined,
  date: payload.date,
  startTime: payload.time || '00:00',
  endTime: payload.endTime || undefined,
  roomId: roomId || undefined,  // add this
  chairsRequested: ...,
  tablesRequested: ...,
  submittedById: effectiveUser?.id || undefined,
})
```

Ensure `roomsFromApi` is loaded (e.g. from existing `/api/rooms` or `/api/campus` data) and passed into the modal or the parent that builds the payload.

---

## 3. Multi-Tenant Security & Isolation

### 3.1 orgContext and Prisma extension (OK)

**Files:** `platform/src/lib/orgContext.ts`, `platform/src/lib/prisma.ts`

**Status:**  
- `getOrgIdFromRequest`: Bearer (preferred) or `x-org-id`; no org → `withOrg` throws.  
- `runWithOrg` validates org exists and runs callback in `orgStorage.run(orgId, fn)`.  
- Prisma extension adds `organizationId` to `where` and `data` for tenant models when `orgStorage.getStore()` is set.  
- Tenant model list: user, building, ticket, event, expense, budget, maintenanceTip, knowledgeBaseEntry, inventoryItem, waterLog, waterAssetConfig, waterAsset, form, auditLog. Room is scoped via `building.organizationId` in routes that need it.

No change required for isolation logic.

### 3.2 API routes that intentionally skip withOrg (OK)

**Files:**  
- `src/app/api/auth/*`, `src/app/api/user/me/route.ts`, `src/app/api/billing/webhook/route.ts`  
- `src/app/api/setup/*` (token or invite context)  
- `src/app/api/public/org-branding/route.ts` (public by subdomain/slug; no tenant token)

These correctly do not use `withOrg`; they resolve identity/org by token, body, or slug. Not leaky.

### 3.3 Error path returning mock data (Medium — security / correctness)

**Files:**  
- `src/app/api/search/route.ts` — on catch (e.g. “Organization ID is required” or “Invalid organization”) returns `getMockSearchData(qLower)` instead of 401 + empty or error.  
- `src/app/api/room/[roomId]/route.ts` — on catch returns mock room object keyed by `roomId`.

**Technical risk:** **Misleading response / data leak:** Caller may believe they received real org-scoped data when the failure was due to missing or invalid org. Also, mock data is not tenant-scoped and could be confusing in multi-tenant use.

**Fix:** Return proper HTTP and empty or error payload on auth/org failure; do not return mock data.

```ts
// src/app/api/search/route.ts
} catch (err) {
  if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
    return NextResponse.json(
      { error: err.message, rooms: [], teachers: [], tickets: [] },
      { status: 401, headers: corsHeaders }
    )
  }
  console.error('Search error:', err)
  return NextResponse.json(
    { error: 'Search failed', rooms: [], teachers: [], tickets: [] },
    { status: 500, headers: corsHeaders }
  )
}
```

```ts
// src/app/api/room/[roomId]/route.ts
} catch (err) {
  if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
  console.error('Room fetch error:', err)
  return NextResponse.json({ error: 'Room not found' }, { status: 404 })
}
```

Remove the mock fallback so clients never receive fake data on error.

---

## 4. AI Integration Technical Debt

### 4.1 withRateLimitRetry — main thread (OK)

**File:** `src/services/gemini.js`

**Status:** `await new Promise((r) => setTimeout(r, delayMs))` runs in an async context; it yields and does not block the main UI thread. Backoff (15s, 30s, 60s) and max retries are reasonable.

**Optional improvement:** To avoid the UI feeling stuck during long backoff, consider moving the retry loop to a small helper that could be cancelled (e.g. AbortController) so the component can show “Rate limited; retrying in Xs” and allow cancel. Not required for correctness.

### 4.2 extractEventFieldsWithGemini — JSON parsing safety (Low)

**File:** `src/services/gemini.js`

**Status:** Entire extraction is in `try/catch`; on any error it returns `{}`. So malformed AI output does not crash the component.

**Risk:** AI sometimes returns trailing text (e.g. “Here is the JSON: {...} Sorry for the delay”). `JSON.parse(jsonStr)` would throw; catch returns `{}`, so we safely degrade but lose all fields. No crash.

**Fix (optional):** More defensive parsing to tolerate trailing content:

```javascript
function safeParseEventJson(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return null
  const trimmed = jsonStr.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}') + 1
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end))
  } catch {
    return null
  }
}

// In extractEventFieldsWithGemini, replace:
// const parsed = JSON.parse(jsonStr)
const parsed = safeParseEventJson(jsonStr)
if (!parsed || typeof parsed !== 'object') return {}
```

This reduces the chance of losing valid JSON when the model adds a sentence before or after.

---

## 5. React Performance & Refactoring

### 5.1 God component — App.jsx (~1,155 lines) (High — performance and maintainability)

**File:** `src/App.jsx`

**Technical risk:** **Performance bottleneck and re-renders:** Single component holds 40+ state values and all tab content; any state change can re-render the whole tree. Hard to reason about and test.

**Suggested refactor:**

1. **Extract tab content into separate route-level or lazy components**  
   - e.g. `DashboardTab`, `EventsTab`, `FacilitiesTab`, `ITSupportTab`, `FormsTab`, `InventoryTab`, `WaterTab`, `SettingsTab`.  
   - Each receives only the props it needs (e.g. `events`, `setEvents`, `supportRequests`, `setSupportRequests`, `currentUser`, `effectiveUser`).

2. **Lift shared state into a small context or reducer**  
   - e.g. `AppStateContext` with `{ user, events, supportRequests, … }` and setters, or `useReducer` for a single state slice.  
   - Keeps App.jsx as a thin shell: layout (Sidebar + TopBar), route/tab switch, and context provider.

3. **Memoize heavy children**  
   - Wrap tab content in `React.memo` and pass stable callbacks (e.g. `useCallback` for `onSave`, `updateTicket`).  
   - Ensures only the active tab and components that use changed state re-render.

Example structure:

```jsx
// App.jsx (slim)
const TabContent = React.memo(function TabContent({ activeTab, ...rest }) {
  switch (activeTab) {
    case 'dashboard': return <DashboardTab {...rest} />
    case 'events': return <EventsTab {...rest} />
    case 'facilities': return <FacilitiesTab {...rest} />
    // ...
    default: return <DashboardTab {...rest} />
  }
})

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const state = useAppState() // custom hook or context with events, supportRequests, user, etc.
  return (
    <AppStateProvider value={state}>
      <div className="...">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} ... />
        <main>
          <TabContent activeTab={activeTab} ... />
        </main>
      </div>
      {/* Modals that need state */}
    </AppStateProvider>
  )
}
```

### 5.2 God component — FormBuilder.jsx (~2,059 lines) (High)

**File:** `src/components/FormBuilder.jsx`

**Technical risk:** Same as above: large single component, many local states, hard to maintain and easy to trigger broad re-renders.

**Suggested refactor:**

1. **Split by UI region:**  
   - `FormBuilderToolbar.jsx` (top actions, title, save).  
   - `FormBuilderPalette.jsx` (field types, drag sources).  
   - `FormBuilderCanvas.jsx` (drop zone, list of field cards).  
   - `FormBuilderFieldSettings.jsx` (right panel for selected field props).  
   - `FormBuilderPreview.jsx` (preview mode).

2. **Extract field-type config and rendering**  
   - One small module (e.g. `formFieldTypes.js`) for type metadata (label, icon, defaultProps).  
   - Per-type preview/edit components (e.g. `FieldText`, `FieldDropdown`) used by both canvas and preview.

3. **Memoize list items**  
   - For the list of form fields, use `React.memo` on each row/card and pass a stable `onEdit`/`onRemove` keyed by field id to avoid list thrashing.

4. **Consider a reducer for form state**  
   - Single `formState` (title, description, fields array) with actions: `ADD_FIELD`, `UPDATE_FIELD`, `REMOVE_FIELD`, `REORDER`.  
   - Simplifies undo/redo and keeps FormBuilder main component small.

---

## Summary Table

| #   | Area              | File(s)                    | Risk                         | Severity | Fix summary |
|-----|-------------------|----------------------------|------------------------------|----------|-------------|
| 1.2 | Theme             | src/index.css              | .glass not variable-driven   | Medium   | Use --bg-base/--border in .glass/.glass-card |
| 1.3 | Theme             | src/index.css              | Hardcoded hex in form panels | Low      | Use var(--bg-card), var(--border) |
| 2.1 | Data integrity    | TicketingTable.jsx         | Always mock sales           | High     | Fetch from API or show “Sample data” |
| 2.2 | Event payload     | App.jsx, events API        | roomId never sent           | Medium   | Resolve location→roomId, send roomId in POST |
| 3.3 | Multi-tenant      | search/route.ts, room/route | Mock on error               | Medium   | Return 401/500 + empty or error, no mock |
| 4.2 | AI                | gemini.js                  | Strict JSON parse            | Low      | safeParseEventJson (slice first { to last }) |
| 5.1 | Performance       | App.jsx                    | God component                | High     | Extract tabs, context/reducer, memo |
| 5.2 | Performance       | FormBuilder.jsx             | God component                | High     | Split regions, field types, reducer |

Implementing the fixes above will align the codebase with a variable-driven light-mode-first theme, correct data and schema usage, strict multi-tenant error behavior, safer AI parsing, and more maintainable, performant React components.
