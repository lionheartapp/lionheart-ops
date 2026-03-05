# Technology Stack — Maintenance & Facilities Module

**Project:** Lionheart — K-12 CMMS / Facilities Module
**Researched:** 2026-03-05
**Scope:** Additive only — libraries to install on top of the existing stack

---

## Existing Stack (Do Not Re-research)

The following are already installed and in active use. The module must use them consistently:

| Technology | Version | Role |
|------------|---------|------|
| Next.js | ^15.1.0 | Framework, App Router, API routes |
| Prisma | ^5.22.0 | ORM, org-scoped client pattern |
| @supabase/supabase-js | ^2.49.1 | DB connection + Storage uploads |
| React / React DOM | ^18.3.1 | UI rendering |
| Tailwind CSS | ^3.4.15 | Styling |
| @tanstack/react-query | ^5.90.21 | Server state, caching, mutations |
| framer-motion | ^12.34.3 | Animations (glassmorphism system) |
| zod | ^4.3.6 | Validation (all route inputs) |
| date-fns | ^4.1.0 | Date math (already installed — use this) |
| rrule | ^2.8.1 | Recurrence rules (already installed — use for PM schedules) |
| lucide-react | ^0.564.0 | Icons |
| nodemailer / Resend | ^7.0.7 | Email notifications |

---

## New Libraries Required

### 1. Kanban Drag-and-Drop

**Recommended: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`**
**Version: 6.3.1** (current stable; a major new version is in development but not yet released)
**Confidence: HIGH** — Verified via npm registry; dominant library for this use case in 2025/2026.

**Why dnd-kit:**
- Specifically designed for accessible keyboard + pointer drag-and-drop in React
- Zero runtime dependencies; ~10kb bundle
- Native TypeScript support
- Best-documented patterns for Kanban boards in Next.js / React 18 ecosystem
- `@dnd-kit/sortable` handles column-to-column card moves cleanly
- Works within React 18 concurrent rendering model without issues
- Used in production by Vercel, Linear (inspiration), and 100k+ projects

**Why NOT react-beautiful-dnd:** Abandoned in 2023; not compatible with React 18 Strict Mode. Do not use.
**Why NOT react-dnd:** More verbose API, no accessibility built-in, no active Kanban community patterns.

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

### 2. Photo Upload — Dropzone Component

**Recommended: `react-dropzone`**
**Version: 15.0.0** (published ~Feb 2026)
**Confidence: HIGH** — Verified via npm; 4,473 dependents; actively maintained.

**Why react-dropzone:**
- `useDropzone` hook-based API fits the existing React patterns
- Handles multi-file selection, drag-and-drop, file type restrictions (`image/*`)
- Does not impose a UI — integrates cleanly with the glassmorphism design system
- Preview URLs: `URL.createObjectURL(file)` (standard pattern, previews were removed from lib intentionally in v7+ to keep it headless)

**Why NOT react-dropzone-uploader:** Adds its own UI opinions; last published 2021.

```bash
npm install react-dropzone
```

---

### 3. Photo Compression (Client-Side, Before Upload)

**Recommended: `browser-image-compression`**
**Version: 2.0.x** (positive release cadence, published within last 3 months as of research date)
**Confidence: HIGH** — Verified via npm; 112k weekly downloads; used widely for mobile-first upload flows.

**Why browser-image-compression:**
- Compresses JPEG/PNG/WebP before sending to Supabase Storage — critical for mobile photos
- Web Worker mode (`useWebWorker: true`) keeps UI responsive during compression
- Configurable `maxSizeMB` and `maxWidthOrHeight` — set to 2MB / 2048px for ticket photos
- Runs entirely client-side; no additional backend needed

**Why this matters for K-12 maintenance:** Teachers submitting from mobile phones produce 5–12MB JPEG files. Without compression, Supabase Storage costs balloon and upload times on school Wi-Fi are unacceptable.

```bash
npm install browser-image-compression
```

---

### 4. QR Code Generation

**Recommended: `qrcode.react`**
**Version: 4.x** (current stable on npm as of 2026)
**Confidence: HIGH** — Most widely used React QR component; SVG output; zero dependencies.

**Why qrcode.react:**
- Exports `<QRCodeSVG>` and `<QRCodeCanvas>` — use SVG for print-friendly asset labels
- SVG output scales without pixelation (critical for printing QR stickers for assets)
- Can embed a small logo/icon in center (useful for Lionheart branding on asset tags)
- Passes through `className` and `style` for Tailwind integration

**Why NOT react-qr-code:** Also fine, but qrcode.react has better SVG print support and wider adoption.
**Why NOT qr-code-styling:** Styling library adds 100kb+ for features (gradients, custom shapes) not needed here.

```bash
npm install qrcode.react
# Dev types if not bundled:
npm install -D @types/qrcode.react
```

---

### 5. QR Code Scanning (Camera)

**Recommended: `html5-qrcode`**
**Version: 2.3.8** (current stable)
**Confidence: MEDIUM** — Verified via npm and GitHub; widely used but last major release was ~2023. Active minor updates continue. Alternative is @zxing/browser if issues arise.

**Why html5-qrcode:**
- `Html5Qrcode` class gives raw API for building custom camera scanner UI (needed to match glassmorphism design)
- `Html5QrcodeScanner` is the turnkey UI option for fast implementation
- Handles both camera scan and local file scan (fallback for devices without camera permission)
- Used in 1000+ production projects
- Handles the tricky part: requesting camera permissions, switching front/back camera, and decoding from video frames

**Caveat:** Uses ZXing under the hood. If camera scanning is only needed in Phase 2 and html5-qrcode shows maintenance concerns by then, evaluate `@zxing/browser` directly as the fallback — it's the lower-level library and is actively maintained by the ZXing org.

**Critical:** Must be dynamically imported with `{ ssr: false }` in Next.js since it accesses `navigator.mediaDevices` (browser-only API).

```bash
npm install html5-qrcode
```

---

### 6. AI Diagnostics — Anthropic Claude API

**Recommended: `@anthropic-ai/sdk`**
**Version: 0.78.0** (published ~2 weeks ago as of research date; actively maintained)
**Confidence: HIGH** — Verified via npm; official Anthropic SDK; 0.78.0 is current.

**Why @anthropic-ai/sdk over Vercel AI SDK (@ai-sdk/anthropic):**
- Direct SDK gives full control over vision messages, caching headers, and streaming
- The spec requires Claude Sonnet for photo diagnosis — direct SDK makes model pinning explicit
- Existing Gemini integration uses `@google/genai` directly (same pattern); consistency
- Vercel AI SDK adds abstraction overhead without benefit for this single-provider use case

**Model to use: `claude-sonnet-4-5` (latest Sonnet as of research date)**
- Supports image input (Base64 PNG/JPEG/WebP)
- Cached per ticket using `aiAnalysis` JSON field in MaintenanceTicket — call once, store result
- PPE analysis, multi-issue detection, and free-form chat all work via messages API

**Note:** The project already has `GEMINI_API_KEY` for the existing AI feature. Add `ANTHROPIC_API_KEY` as a new env var. Do not reuse Gemini for maintenance AI — user decision per PROJECT.md.

```bash
npm install @anthropic-ai/sdk
```

---

### 7. PDF Report Generation

**Recommended: `@react-pdf/renderer`**
**Version: 4.3.2** (published ~2 months ago as of research date; supports React 18 and React 19)
**Confidence: HIGH** — Verified via npm; 860k+ weekly downloads; official react-pdf.org docs current.

**Why @react-pdf/renderer:**
- JSX-based PDF authoring — `<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>` primitives
- Generates PDFs server-side in Next.js API routes (as a Route Handler returning a `Response` with `Content-Type: application/pdf`)
- Required for: Compliance audit exports (Phase 3), Board-ready FCI reports (Phase 3), one-click PDF download
- No headless browser (Puppeteer) needed — pure Node.js rendering

**Critical Next.js integration note:** When used in client components, must be imported with `dynamic(..., { ssr: false })`. In API route handlers (server-side), import directly — no special config needed. This is the recommended pattern per the official docs.

**Why NOT Puppeteer:** Adds ~300MB binary, complicates Vercel deployment, and is overkill for templated reports.
**Why NOT jsPDF:** Low-level canvas API; building FCI reports with it is painful; no React component model.

```bash
npm install @react-pdf/renderer
npm install -D @types/react-pdf
```

---

### 8. Scheduled Jobs (PM Ticket Auto-Generation)

**Recommended: Vercel Cron Jobs (no new npm package)**
**Version: N/A — platform feature**
**Confidence: HIGH** — Verified via Vercel docs; native to the deployment platform.

**How it works:**
- Add `vercel.json` cron config pointing to a Next.js API route handler (e.g., `GET /api/cron/pm-generate`)
- Vercel calls the route on schedule (e.g., daily at 6am)
- Route queries `PmSchedule` records where `nextDueDate <= now + advanceNoticeDays`, creates `MaintenanceTicket` rows
- Secure with `CRON_SECRET` header verification per Vercel docs

**Why NOT node-cron / Bree:** These require a persistent Node.js process. Vercel is serverless — these approaches simply don't work without a separate always-on server.
**Why NOT Supabase pg_cron:** Valid alternative (PostgreSQL-native scheduled queries), but it runs SQL only — creating tickets with full business logic (notifications, permission checks) is cleaner in the application layer.

**rrule is already installed** — use it to compute `nextDueDate` after PM completion. No new package needed.

---

### 9. Offline PWA (Phase 3)

**Recommended: `@serwist/next` + `dexie`**

#### Service Worker: `@serwist/next`
**Version: ~9.x** (current stable — verify at install time)
**Confidence: MEDIUM** — Verified via serwist.pages.dev official docs and multiple 2025 community articles. Named as the next-pwa successor in Next.js official PWA guide.

**Why Serwist:**
- Actively maintained successor to `next-pwa` (which is unmaintained as of 2023)
- Specifically documented for Next.js 15 App Router
- Listed in Next.js official PWA guide as the recommended library
- Built on Google Workbox; provides precaching, runtime caching, and offline fallbacks
- `reloadOnOnline: false` is required — do not auto-reload when connectivity returns (techs may be mid-form-fill)

**Why NOT next-pwa (the original):** Last update was 2+ years ago; not compatible with App Router.
**Why NOT @ducanh2912/next-pwa:** Another fork; Serwist is more actively maintained and better documented for Next.js 15.

```bash
npm install @serwist/next
npm install -D serwist
```

#### Offline Storage: `dexie`
**Version: 4.x** (current stable — v4.1.x includes active development; stable v4.0.x for production use)
**Confidence: MEDIUM** — Verified via dexie.org official docs and npm. Most widely adopted IndexedDB wrapper with 100k+ sites using it.

**Why Dexie:**
- Clean Promise-based API over the notoriously verbose IndexedDB native API
- Schema versioning with migrations (needed as the offline data model evolves across phases)
- Works in service workers and main thread alike
- Handles offline queuing: create a `SyncQueue` table in IndexedDB, flush on reconnect via `navigator.onLine` event or Background Sync API
- Do NOT use Dexie Cloud (the commercial sync add-on) — sync back to Supabase/Postgres directly via the existing API

```bash
npm install dexie
```

**Background Sync pattern:** Service Worker listens for `sync` event → replays queued mutations against existing API routes. No additional library needed — this is a browser API.

---

### 10. Analytics Charts (Phase 2 Dashboard)

**Recommended: `recharts`**
**Version: 2.x** (current stable as of research date — verify at install time)
**Confidence: HIGH** — Extensively documented; consistent with React 18; fits the "SaaS admin dashboard" pattern exactly.

**Why Recharts:**
- Composable React components map cleanly to the required charts: `BarChart`, `LineChart`, `PieChart`, `AreaChart`
- Tailwind-compatible: `className` passes through to SVG elements
- Reasonable performance for the data volumes in this module (< 10k data points per chart)
- Already the standard choice for operational metrics dashboards in the Next.js ecosystem
- Integrates with Framer Motion for animated chart entrances (matches the existing animation system)

**Why NOT Visx:** D3-based primitives library requiring significant custom code to produce standard bar/line charts. Appropriate for bespoke data viz, not operational dashboards. Overkill for this use case.
**Why NOT Chart.js / react-chartjs-2:** Canvas-based; accessibility is worse; SVG-based recharts is preferred for this module's print-to-PDF requirements (compliance reports).

```bash
npm install recharts
npm install -D @types/recharts
```

---

### 11. Form Handling for Complex Ticket Forms

**Recommended: `react-hook-form`**
**Version: 7.71.2** (current stable as of research date; 0 dependencies)
**Confidence: HIGH** — Verified via npm releases; actively maintained; industry standard.

**Why react-hook-form:**
- Uncontrolled inputs with minimal re-renders — critical for mobile performance on ticket submission
- Native Zod integration via `@hookform/resolvers` (Zod already installed in the project)
- Handles file inputs for photo uploads cleanly via `register('photos')`
- Already used in the project (confirmed by existing codebase patterns in the spec)
- 8,657 npm dependents; consistent with the existing team's React patterns

**Note:** `@hookform/resolvers` is the companion package connecting react-hook-form to Zod. Install it alongside:

```bash
npm install react-hook-form @hookform/resolvers
```

---

## Libraries to Explicitly NOT Install

| Library | Reason |
|---------|--------|
| `react-beautiful-dnd` | Abandoned 2023; breaks in React 18 Strict Mode |
| `Puppeteer` | 300MB binary; kills Vercel cold start; unnecessary for templated PDFs |
| `next-pwa` (original) | Unmaintained for 2+ years; incompatible with App Router |
| `@ducanh2912/next-pwa` | Serwist is better maintained and more current |
| `Dexie Cloud` | Commercial sync; conflicts with existing Supabase backend |
| `@vercel/ai` / `ai` (Vercel AI SDK) | Adds abstraction for a single-provider use case; direct SDK is cleaner |
| `moment.js` | Deprecated; `date-fns` already installed |
| `jsPDF` | Low-level canvas API; `@react-pdf/renderer` is vastly better for structured reports |
| `react-dnd` | Verbose; no accessibility; superseded by dnd-kit |
| `ag-grid-react` | Enterprise-scale complexity for what is a filtered list view |

---

## Complete Install Command

```bash
# Phase 1 (MVP) — Kanban, upload, AI, forms
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install react-dropzone
npm install browser-image-compression
npm install @anthropic-ai/sdk
npm install react-hook-form @hookform/resolvers

# Phase 2 (Operations) — QR, charts
npm install qrcode.react
npm install html5-qrcode
npm install recharts

# Phase 3 (Intelligence) — PDF, PWA, offline
npm install @react-pdf/renderer
npm install @serwist/next
npm install -D serwist
npm install dexie

# Dev types (as needed)
npm install -D @types/recharts @types/react-pdf
```

---

## No-New-Package Solutions

The following spec requirements are satisfied by libraries **already installed**:

| Requirement | How Existing Library Handles It |
|-------------|-------------------------------|
| PM recurrence calculation | `rrule` (^2.8.1) — already installed; compute `nextDueDate` from last completion |
| Date formatting / SLA age | `date-fns` (^4.1.0) — `formatDistance`, `differenceInHours` for overdue detection |
| Scheduled PM job trigger | Vercel Cron Jobs (platform) — no npm package needed |
| Ticket mutation optimistic updates | `@tanstack/react-query` (^5.90.21) — `useMutation` + `queryClient.invalidateQueries` |
| Activity feed animations | `framer-motion` (^12.34.3) — `AnimatePresence` + `listItem` variants from `src/lib/animations.ts` |
| Supabase Storage file upload | `@supabase/supabase-js` (^2.49.1) — `supabase.storage.from('bucket').upload()` |
| Email notifications | `nodemailer` + Resend (already wired) — extend `emailService.ts` |
| In-app notifications | Existing notification system — extend for maintenance ticket events |
| Zod validation on all routes | `zod` (^4.3.6) — already the project standard |
| Voice-to-text (submission) | Web Speech API (`webkitSpeechRecognition`) — browser native, no library |

---

## Environment Variables to Add

```bash
ANTHROPIC_API_KEY          # Claude Sonnet for AI diagnostics (Phase 1)
CRON_SECRET                # Shared secret for Vercel Cron Job route auth (Phase 2)
NEXT_PUBLIC_SUPABASE_ANON_KEY  # If not already exposed for client-side Storage uploads
```

---

## Supabase Storage Bucket

Create a dedicated `maintenance` bucket (separate from any existing buckets):

```
maintenance/
  tickets/{ticketId}/         — submission photos, completion photos
  assets/{assetId}/           — asset condition photos
  costs/{costEntryId}/        — receipt photos
  compliance/{recordId}/      — compliance documents
  reports/{reportId}/         — generated PDF reports (optional cache)
```

Use signed upload URLs pattern for all client-side uploads: server action creates the signed URL, client uploads directly to Supabase, bypassing the Next.js 1MB body limit for server actions.

---

## Sources

- [@dnd-kit/core on npm](https://www.npmjs.com/package/@dnd-kit/core) — version 6.3.1 confirmed
- [dnd-kit official docs](https://dndkit.com/) — Kanban patterns, accessibility
- [react-dropzone on npm](https://www.npmjs.com/package/react-dropzone) — version 15.0.0 confirmed
- [browser-image-compression on npm](https://www.npmjs.com/package/browser-image-compression) — version 2.0.x confirmed
- [@anthropic-ai/sdk on npm search](https://www.npmjs.com/package/@anthropic-ai/sdk) — version 0.78.0 confirmed
- [Anthropic Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview) — claude-sonnet-4-5 current
- [@react-pdf/renderer on npm](https://www.npmjs.com/package/@react-pdf/renderer) — version 4.3.2 confirmed
- [Serwist Next.js getting started](https://serwist.pages.dev/docs/next/getting-started) — official docs, Next.js 15 App Router support confirmed
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — Serwist listed as recommended
- [Dexie.js official site](https://dexie.org/) — v4.x stable, IndexedDB wrapper patterns
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — native platform feature, no library needed
- [react-hook-form releases](https://github.com/react-hook-form/react-hook-form/releases) — version 7.71.2 confirmed
- [qrcode.react on npm](https://www.npmjs.com/package/qrcode.react) — SVG output, current stable
- [html5-qrcode on npm](https://www.npmjs.com/package/html5-qrcode) — version 2.3.8, camera scanning
- [recharts LogRocket 2025 comparison](https://blog.logrocket.com/best-react-chart-libraries-2025/) — Recharts vs Visx recommendation
- [Supabase Storage signed URL upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — official pattern for Next.js 15
