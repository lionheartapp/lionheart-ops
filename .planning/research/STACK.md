# Technology Stack — v3.0 Event Planning Features

**Project:** Lionheart — K-12 Event Planning Module
**Researched:** 2026-03-14
**Scope:** Additive only — what to install on top of the existing stack for v3.0 event planning features
**Confidence:** HIGH (verified against npm and official docs)

---

## Existing Stack (Already Installed — Do Not Re-research)

The following are confirmed in `package.json` and in active use. All new event planning code must use these consistently.

| Technology | Installed Version | Role in v3.0 |
|------------|------------------|--------------|
| Next.js | ^15.1.0 | Framework — public pages use App Router RSC, staff pages use client components |
| Prisma | ^5.22.0 | ORM — all new EventProject models use org-scoped pattern |
| @supabase/supabase-js | ^2.49.1 | DB + Storage (photos, documents) |
| React / React DOM | ^18.3.1 | UI |
| Tailwind CSS | ^3.4.15 | Styling — glassmorphism classes from globals.css |
| @tanstack/react-query | ^5.90.21 | All data fetching / mutation state |
| framer-motion | ^12.34.3 | Animations — use existing animation variants |
| zod | ^4.3.6 | All route input validation |
| date-fns | ^4.1.0 | Date math — use this, do NOT add dayjs or moment |
| rrule | ^2.8.1 | Recurrence rules — already installed for recurring series |
| lucide-react | ^0.564.0 | Icons |
| nodemailer + Resend | ^7.0.7 | Email — extend emailService.ts |
| @google/genai | ^1.40.0 | AI features — all AI via Gemini, no changes needed |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop — use for group assignment UI |
| @dnd-kit/sortable | ^10.0.0 | Sortable lists within groups |
| @dnd-kit/utilities | ^3.2.2 | DnD helpers |
| qrcode | ^1.5.4 | Server-side QR generation (SVG/PNG/DataURL) |
| html5-qrcode | ^2.3.8 | Camera QR scanning (dynamic import only) |
| @serwist/next | ^9.5.6 | PWA/service worker — extend for event offline support |
| serwist | ^9.5.6 | Workbox core |
| dexie | ^4.3.0 | IndexedDB offline storage — extend for offline rosters |
| dexie-react-hooks | ^4.2.0 | React hooks for dexie |
| stripe | ^20.4.1 | Stripe Node SDK — INSTALLED but missing client-side packages |
| recharts | ^3.7.0 | Charts — use for budget/analytics views |
| jspdf | ^4.2.0 | PDF — present but insufficient; see PDF strategy below |
| @sentry/nextjs | ^10.43.0 | Error tracking |
| pino | ^10.3.1 | Structured logging |

---

## New Libraries Required

### 1. Stripe Client-Side (Payment Forms)

**Install: `@stripe/stripe-js` + `@stripe/react-stripe-js`**
**Versions: `@stripe/stripe-js@8.9.0`, `@stripe/react-stripe-js@5.6.1`**
**Confidence: HIGH** — Verified via npm (published within the last week as of research date).

The server-side `stripe` Node SDK (v20.4.1) is already installed. These two packages add the **browser-side** pieces required for PCI-compliant card collection via Stripe Elements.

**Why these specific packages:**
- `@stripe/stripe-js` loads Stripe.js from `js.stripe.com` (required for PCI compliance — never bundle Stripe.js yourself)
- `@stripe/react-stripe-js` provides `<Elements>`, `<PaymentElement>`, and `useStripe()` / `useElements()` hooks
- `<PaymentElement>` handles 100+ payment methods, input validation, and error display — replaces any custom card input
- The PaymentIntent is created server-side in a Route Handler; clientSecret is passed to the `<Elements>` provider
- Card data **never touches Lionheart servers** — this is the PCI compliance guarantee

**Integration pattern:**
```typescript
// Server: POST /api/events/[eventId]/payment-intent
const paymentIntent = await stripe.paymentIntents.create({ amount, currency: 'usd', ... })
return ok({ clientSecret: paymentIntent.client_secret })

// Client: wrap registration form
<Elements stripe={loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)} options={{ clientSecret }}>
  <PaymentElement />
</Elements>
```

**Why NOT Stripe Checkout (redirect):** Redirect breaks the single-page registration flow. Elements keeps the parent within the school-branded public page throughout.

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

---

### 2. Signature Capture

**Install: `signature_pad`**
**Version: 5.1.3**
**Confidence: HIGH** — Verified via npm; canonical library; 5.1.3 published 3 months ago.

**Why signature_pad (not react-signature-canvas):**
- `react-signature-canvas` is a wrapper around `signature_pad` — use the source directly and write a thin React wrapper (100 lines). Avoids an extra dependency that is not actively maintained.
- `signature_pad` itself is the canonical implementation (by Szymon Nowak); version 5.x has full TypeScript support
- Bézier curve interpolation produces smooth signatures from both touch (mobile finger) and pointer (desktop) inputs
- `toDataURL()` exports PNG for storage in Supabase; `toSVG()` for embedding in PDFs
- Works in all modern browsers; handles both PointerEvent and TouchEvent automatically

**Build the wrapper once as `src/components/events/SignaturePad.tsx`:**
```typescript
'use client'
import SignaturePad from 'signature_pad'
// Mount on canvas ref, expose clear() and getDataURL() via useImperativeHandle
```

**Why NOT react-signature-canvas:** Last published 3+ years ago; wrapper adds no value over writing your own 80-line component.
**Why NOT HTML `<input type="text">` typed signatures:** Acceptable for desktop fallback, not for legal document signatures requiring a drawn mark. Use typed input as the desktop alternative in the UI, signature_pad for the drawn path.

```bash
npm install signature_pad
```

---

### 3. Multi-Step Form State Management

**Install: `zustand`**
**Version: 5.0.x** (current stable — verify at install time; v5 released late 2024)
**Confidence: HIGH** — Most-used client-side state management in Next.js ecosystem 2024-2026; well documented.

**Why Zustand for multi-step registration forms:**
- Multi-page registration forms span multiple components and steps; `useState` passed as props does not scale to 6-8 step forms
- Zustand's `persist` middleware saves form progress to `localStorage` — parents interrupted mid-registration can resume
- Smaller bundle than Redux (1.2kb); no boilerplate; compatible with React 18 concurrent features
- Already the de-facto standard for cross-component form state in Next.js 15 projects
- Does NOT replace TanStack Query — Zustand handles ephemeral local UI state; TanStack handles server state

**When to use Zustand in v3.0:**
- Registration form wizard state (steps 1-N, accumulated field values)
- Event group assignment drag state (who is unassigned, which group each participant is in)
- Day-of session state (current QR scan mode, active headcount group)

**react-hook-form handles individual step validation; Zustand holds accumulated data across steps.**

```bash
npm install zustand
```

---

### 4. Form Handling (Individual Steps and Standalone Forms)

**Install: `react-hook-form` + `@hookform/resolvers`**
**Version: react-hook-form@7.x (current stable), @hookform/resolvers@3.x**
**Confidence: HIGH** — Verified via npm releases; industry standard; 0-dependency core.

**Why react-hook-form:**
- Uncontrolled inputs — critical for mobile registration performance (re-renders per keystroke are death on mobile)
- Native Zod integration via `@hookform/resolvers` (Zod already in the project)
- Handles file inputs for photo uploads during registration
- Per-step validation with `trigger(['field1', 'field2'])` before advancing to next step
- The form builder's dynamic fields (custom fields added by admin) are cleanly handled via `register(fieldName)` with dynamic keys

**Why NOT Formik:** react-hook-form is the dominant choice in 2025 for performance-sensitive forms; Formik re-renders on every state change.

```bash
npm install react-hook-form @hookform/resolvers
```

---

### 5. PDF Generation (Bus Manifests, Rosters, Medical Summaries)

**Install: `@react-pdf/renderer`**
**Version: 4.3.2**
**Confidence: HIGH** — Verified via npm; 860k+ weekly downloads; 4.3.2 published ~2 months ago.

**Why @react-pdf/renderer (not existing jsPDF):**
- `jspdf` (already installed at v4.2.0) uses a low-level canvas/coordinate API — building a bus manifest layout with it is painful and produces fragile code
- `@react-pdf/renderer` uses JSX components (`<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>`) — same mental model as building a React page
- Renders server-side in Next.js Route Handlers without a headless browser — clean Vercel deployment
- Required output: bus manifests, cabin rosters, medical summaries, emergency contact sheets — all structured table-like documents that fit the component model perfectly
- PDF is generated as a `Buffer` in a Route Handler, returned with `Content-Type: application/pdf`

**Keep jsPDF installed** — it is used elsewhere (confirmed in package.json). Do not remove it. Add @react-pdf/renderer for event document generation only.

**Why NOT Puppeteer:** ~300MB binary kills Vercel cold starts; jsPDF canvas rendering produces images not searchable text; @react-pdf/renderer produces real PDF with selectable text.

**Critical Next.js note:** When used in client components (PDF preview), must be imported with `dynamic(..., { ssr: false })`. In API route handlers, import directly.

```bash
npm install @react-pdf/renderer
```

---

### 6. SMS Notifications via Twilio

**Install: `twilio`**
**Version: 5.13.0**
**Confidence: HIGH** — Verified via npm (published within hours of research; v5 is current major).

**Why Twilio v5 (not v4):**
- v5 introduced breaking changes from v4 — the upgrade guide must be followed if upgrading an existing installation
- This is a new install (Twilio is not in package.json) so install v5 directly
- v5 Node.js SDK supports scheduled SMS (up to 35 days ahead), required for notification orchestration timelines
- Two-way messaging via webhooks is available for RSVP-by-text patterns if needed later

**SMS use cases in v3.0:**
- Day-before event reminders to parents
- Day-of check-in confirmations ("Your child checked in at 9:02 AM")
- Emergency alerts from the event incident log
- Notification orchestration condition triggers ("if not checked in by 9:30, SMS guardian")

**Pattern:** Create `src/lib/services/smsService.ts` mirroring the existing `emailService.ts` pattern. Environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.

```bash
npm install twilio
```

---

### 7. Google Calendar API Sync

**Install: `googleapis`**
**Version: latest (134.x as of research period)**
**Confidence: MEDIUM** — Official Google package; version confirmed via npm. OAuth2 flow complexity is HIGH.

**Why googleapis:**
- Official, maintained Google client library for all Google Workspace APIs
- Used as `import { google } from 'googleapis'` — initialize Calendar API client with OAuth2 credentials
- Supports server-side OAuth2 (required — user authenticates with Google, Lionheart stores refresh token, syncs server-side without client interaction)
- Push webhook notifications (`events.watch`) enable real-time sync from Google Calendar to Lionheart

**OAuth2 storage pattern:**
- Store `access_token` and `refresh_token` in a new `GoogleCalendarToken` table (org-scoped)
- Refresh token is permanent (until user revokes); access token expires in 1 hour — auto-refresh on each sync call
- Per-admin scoped: each admin who connects their Google Calendar gets their own token row

**Scope required:** `https://www.googleapis.com/auth/calendar` (read + write events)

**Integration approach:**
```typescript
// src/lib/services/googleCalendarService.ts
const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
await calendar.events.insert({ calendarId: 'primary', requestBody: eventResource })
```

**Warning:** Google Calendar OAuth2 requires HTTPS redirect URIs in production. Local dev requires `ngrok` or Vercel preview URL for OAuth callback testing.

```bash
npm install googleapis
```

---

### 8. Planning Center Integration

**Install: `@planningcenter/api-client`**
**Version: latest (verify at npm install time)**
**Confidence: MEDIUM** — Official Planning Center JavaScript client; confirmed on npm. API coverage is selective.

**Why the official client:**
- `@planningcenter/api-client` is Planning Center's own library; it handles JSON:API response transformation automatically
- Authentication uses OAuth 2.0 — same pattern as Google Calendar (store tokens per org)
- Covers People, Check-Ins, Services, Calendar — the three v3.0 integration targets

**v3.0 integration scope:**
- **People API:** Pull student/parent roster into EventRegistration without manual re-entry
- **Check-Ins API:** Sync attendance to/from Planning Center Check-Ins (churches using both)
- **Calendar API:** Push approved events to Planning Center Calendar

**Warning:** Planning Center's API is rate limited and coverage varies by subscription tier. Not all schools use Planning Center — wrap integration in a feature flag / module toggle. Do not build event registration dependency on Planning Center availability.

```bash
npm install @planningcenter/api-client
```

---

### 9. CAPTCHA (Public Registration Form Spam Prevention)

**Install: `react-turnstile`**
**Version: 1.1.5**
**Confidence: HIGH** — Verified via npm; published 1 month ago; Cloudflare Turnstile is free and privacy-friendly.

**Why Cloudflare Turnstile (not reCAPTCHA):**
- Free and unlimited — no paid tier needed for school event registration volumes
- Invisible by default — passes human verification silently without showing a puzzle (better UX for parents)
- Does not require Google account / has fewer GDPR/COPPA concerns than reCAPTCHA
- `react-turnstile` provides a simple `<Turnstile siteKey={...} onSuccess={setToken} />` component
- Server-side verification is a single POST to Cloudflare's API with the token

**Where to use in v3.0:**
- Public registration form submission
- Magic-link request form (prevents email abuse)
- Any public-facing form endpoint

**Not needed for:** Authenticated staff API routes (JWT provides identity).

**Environment variables needed:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (from Cloudflare dashboard)

```bash
npm install react-turnstile
```

---

## Libraries Already Installed — No New Package Needed

| v3.0 Requirement | Existing Package | Notes |
|-----------------|-----------------|-------|
| QR code generation (registration confirmations, wristbands) | `qrcode@^1.5.4` | Server-side, `QRCode.toDataURL()` for emails; `QRCode.toString('svg')` for PDF embed |
| QR code scanning (check-in, headcounts) | `html5-qrcode@^2.3.8` | Dynamic import `{ ssr: false }` required; camera scanner |
| Drag-and-drop group assignment (buses, cabins) | `@dnd-kit/core` + `@dnd-kit/sortable` | Already installed; use SortableContext for multiple groups |
| Recurring series event generation | `rrule@^2.8.1` | Already installed; `RRule.all()` generates occurrence dates |
| Date formatting + schedule display | `date-fns@^4.1.0` | `format`, `addDays`, `differenceInDays` — do not add dayjs |
| Offline rosters + QR scanning (PWA) | `dexie@^4.3.0` + `@serwist/next@^9.5.6` | Extend existing offline tables; add EventRoster, SyncQueue |
| Budget charts + registration analytics | `recharts@^3.7.0` | `BarChart` for budget vs. actual; `LineChart` for registrations over time |
| Stripe payment intent (server) | `stripe@^20.4.1` | Node SDK already installed; only missing client-side packages |
| Animation + transitions | `framer-motion@^12.34.3` | Use existing variants from `src/lib/animations.ts` |
| Form validation (all routes) | `zod@^4.3.6` | Continue existing pattern |
| In-app notifications (event updates) | Existing notification system | Extend `notificationService.ts` for event triggers |
| Email notifications | `nodemailer` + Resend | Extend `emailService.ts` for event-specific templates |
| Photo upload (registration, events) | `@supabase/supabase-js` | `supabase.storage.from('events').upload()` — signed URL pattern |
| AI event creation + form generation | `@google/genai@^1.40.0` | Gemini already handles all AI; no new AI library needed |
| Server-side scheduled jobs | Vercel Cron Jobs | Platform feature — `vercel.json` cron + API route |

---

## What NOT to Install

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Abandoned 2023; breaks React 18 Strict Mode | `@dnd-kit` (already installed) |
| `moment.js` | Deprecated; 67kb bundle | `date-fns` (already installed) |
| `dayjs` | Redundant with date-fns | `date-fns` (already installed) |
| `puppeteer` | 300MB binary; kills Vercel cold starts | `@react-pdf/renderer` for templated docs |
| `Formik` | Re-renders on every keystroke; superseded | `react-hook-form` |
| `DocuSign SDK` | Overkill; built-in signature capture handles 95% of needs | `signature_pad` |
| `socket.io` | Requires persistent server; incompatible with Vercel serverless | Native SSE via Next.js ReadableStream (no library needed) |
| `pusher-js` | Paid service; adds external dependency | Native SSE or Supabase Realtime (already available via existing client) |
| `@ducanh2912/next-pwa` | Less maintained than Serwist | `@serwist/next` (already installed) |
| `next-pwa` (shadowwalker) | Unmaintained since 2023 | `@serwist/next` (already installed) |
| `Dexie Cloud` | Commercial sync product; conflicts with Supabase backend | Dexie + custom sync via existing API (already the pattern) |
| `react-select` | Heavy; Tailwind floats better | `FloatingDropdown` from existing `@/components/ui/FloatingInput` |
| `@stripe/stripe-react-native` | React Native package; wrong platform | `@stripe/react-stripe-js` |
| `google-auth-library` | Lower level; googleapis includes it | `googleapis` (higher level; includes auth) |

---

## Real-Time Collaboration (No New Library Needed)

v3.0 requires real-time presence indicators and live document updates. **Use native SSE via Next.js Route Handlers** — no library needed.

**Why SSE over WebSockets for this use case:**
- SSE is server → client only — sufficient for "see who else is viewing/editing this event"
- Next.js 15 Route Handlers support `ReadableStream` natively; no additional package needed
- Works on Vercel serverless (WebSocket connections do not persist across serverless invocations)
- Simple reconnection behavior built into the browser's `EventSource` API

**Pattern:**
```typescript
// GET /api/events/[eventId]/presence
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Push presence events; clean up on close
    }
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}
```

**For collaborative editing** (multiple staff editing event details simultaneously): Use optimistic updates with TanStack Query + `onConflict` resolution on the server. Full CRDT collaboration is out of scope for v3.0 — last-write-wins with a visible "X is editing" indicator is sufficient.

---

## Complete Install Command (New Packages Only)

```bash
# Stripe client-side (PCI-compliant card collection)
npm install @stripe/stripe-js @stripe/react-stripe-js

# Signature capture
npm install signature_pad

# Multi-step form state
npm install zustand

# Form handling (individual steps)
npm install react-hook-form @hookform/resolvers

# PDF generation (bus manifests, rosters)
npm install @react-pdf/renderer

# SMS notifications
npm install twilio

# Google Calendar sync
npm install googleapis

# Planning Center integration
npm install @planningcenter/api-client

# CAPTCHA for public forms
npm install react-turnstile
```

---

## Environment Variables to Add

```bash
# Stripe (client key is public; secret key is server-only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   # From Stripe dashboard
STRIPE_SECRET_KEY                    # Already used by existing stripe package; verify it's set
STRIPE_WEBHOOK_SECRET                # Webhook endpoint signing secret for payment confirmations

# Twilio SMS
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER                   # E.164 format: +12025551234

# Google Calendar OAuth2
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI                  # e.g., https://yourdomain.com/api/oauth/google/callback

# Planning Center OAuth2
PLANNING_CENTER_APP_ID
PLANNING_CENTER_SECRET

# Cloudflare Turnstile CAPTCHA
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

---

## Supabase Storage Buckets to Create

```
events/
  {orgId}/{eventId}/
    hero-image/           — Public event page cover photo
    documents/            — Templates, waivers, consent forms
    registrations/{regId}/
      photos/             — Participant photos
      signatures/         — Signature PNG exports
    reports/              — Generated PDF exports (manifests, rosters)
```

Use signed upload URLs for all client-side uploads (server creates signed URL, client uploads directly — bypasses Next.js 1MB body limit for server actions).

---

## Version Compatibility Notes

| Package | Constraint | Notes |
|---------|------------|-------|
| `@stripe/react-stripe-js` | Requires `@stripe/stripe-js` as peer | Both install together; they are released in sync |
| `@react-pdf/renderer@4.x` | Not compatible with React Server Components directly | Import with `dynamic({ ssr: false })` for client use; use directly in Route Handlers |
| `zustand@5.x` | Breaking changes from v4 | This is a new install; start with v5; do not upgrade any existing v4 installation |
| `twilio@5.x` | Breaking changes from v4 | New install; if an older twilio is found anywhere in the project, follow the UPGRADE.md |
| `html5-qrcode` | Browser-only | Always `import dynamic(() => import('html5-qrcode'), { ssr: false })` |
| `signature_pad` | Browser-only | Always wrap in a `'use client'` component; never import in RSC or API routes |

---

## Sources

- [Stripe npm — stripe@20.4.1](https://www.npmjs.com/package/stripe) — server SDK, confirmed installed
- [Stripe npm — @stripe/stripe-js@8.9.0](https://www.npmjs.com/package/@stripe/stripe-js) — version confirmed
- [Stripe npm — @stripe/react-stripe-js@5.6.1](https://www.npmjs.com/package/@stripe/react-stripe-js) — version confirmed
- [Stripe Payment Element docs](https://docs.stripe.com/payments/payment-element) — PCI compliance requirements, integration pattern
- [signature_pad@5.1.3 on npm](https://www.npmjs.com/package/signature_pad) — version and touch support confirmed
- [react-turnstile@1.1.5 on npm](https://www.npmjs.com/package/react-turnstile) — Cloudflare Turnstile React wrapper
- [Cloudflare Turnstile overview](https://developers.cloudflare.com/turnstile/) — free tier, invisible mode
- [twilio@5.13.0 on npm](https://www.npmjs.com/package/twilio) — v5 is current major, breaking changes from v4
- [googleapis on npm](https://www.npmjs.com/package/googleapis) — official Google Node.js client
- [@planningcenter/api-client on npm](https://www.npmjs.com/package/@planningcenter/api-client) — official Planning Center JS client
- [Planning Center API docs](https://developer.planning.center/docs/) — OAuth2 required, JSON:API spec
- [@react-pdf/renderer@4.3.2 on npm](https://www.npmjs.com/package/@react-pdf/renderer) — 860k weekly downloads, confirmed version
- [zustand on npm](https://www.npmjs.com/package/zustand) — v5 current major
- [react-hook-form releases](https://github.com/react-hook-form/react-hook-form/releases) — 0-dependency, v7 current
- [Next.js 15 SSE guide (HackerNoon)](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) — SSE vs WebSocket comparison for Next.js
- [SSE real-time in Next.js 15](https://damianhodgkiss.com/tutorials/real-time-updates-sse-nextjs) — Route Handler ReadableStream pattern

---
*Stack research for: Lionheart v3.0 Event Planning Features*
*Researched: 2026-03-14*
