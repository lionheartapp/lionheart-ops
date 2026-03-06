# Lionheart Mobile App Plan
### React Native / Expo — iOS & Android

**Prepared for:** Lionheart Operations Platform
**Date:** March 6, 2026
**Status:** Planning / Exploratory

---

## Executive Summary

This plan outlines how to build native iOS and Android apps for the Lionheart platform using React Native with Expo. The existing Next.js web app has 181 API endpoints, 95 data models, and a well-structured REST API — all of which the mobile apps can consume directly without backend changes.

The recommended approach is to **prioritize mobile-critical features first** (maintenance tickets, calendar, notifications, athletics) rather than rebuilding the entire web app. A phased rollout lets you ship value early while building toward full parity over time.

**Estimated timeline:** 4–8 months to first App Store release (Phase 1)
**Estimated cost range:** $15K–$150K+ depending on build approach (see Cost Estimates section)

---

## Why React Native / Expo?

Your team already works in React and TypeScript. React Native lets you reuse that knowledge while building truly native apps. Expo specifically adds:

- **Managed build pipeline** — no need to maintain Xcode or Android Studio locally for CI builds
- **Over-the-air (OTA) updates** — push bug fixes without going through App Store review
- **Expo Router** — file-based routing that mirrors Next.js App Router patterns you already use
- **EAS (Expo Application Services)** — handles build, submit, and update workflows
- **Pre-built native modules** — camera, push notifications, biometrics, QR scanning all work out of the box

---

## What You Can Reuse vs. What You Rebuild

### Reuse directly (no changes needed)
- **Entire API layer** — all 181 endpoints work as-is from mobile clients
- **JWT authentication** — same `Authorization: Bearer` flow
- **Business logic** — all server-side validation, permissions, org-scoping stays unchanged
- **Supabase backend** — database, storage, everything
- **Zod schemas** — can be shared in a common package for client-side validation

### Reuse with adaptation
- **TypeScript types** — Prisma-generated types and API response types can be extracted into a shared package
- **API client patterns** — your `fetchApi<T>()` wrapper translates almost 1:1
- **TanStack Query hooks** — same library works in React Native, query keys and cache logic port directly
- **Permission logic** — `can()`, `assertCan()` patterns work client-side too
- **Offline sync architecture** — your Dexie/IndexedDB patterns map to SQLite/WatermelonDB

### Rebuild from scratch
- **All UI components** — React Native uses `<View>`, `<Text>`, `<Pressable>` instead of HTML. No Tailwind (though NativeWind provides Tailwind-like syntax). This is the bulk of the work.
- **Navigation** — Expo Router replaces Next.js routing
- **Animations** — `react-native-reanimated` replaces Framer Motion
- **Charts** — `victory-native` or `react-native-chart-kit` replaces Recharts
- **Calendar views** — native calendar components replace react-big-calendar
- **Drag-and-drop** — `react-native-gesture-handler` replaces @dnd-kit

---

## Feature Prioritization for Mobile

Not every web feature belongs on mobile. Here's how your features break down by mobile relevance:

### Tier 1 — Ship First (highest mobile value)
| Feature | Why it's mobile-critical |
|---------|------------------------|
| **Maintenance tickets** | Field technicians need to submit, view, and update work orders on the go |
| **QR code scanning** | Scanning asset QR codes is inherently a mobile activity |
| **Push notifications** | Real-time alerts for ticket assignments, approvals, schedule changes |
| **Calendar (view + create)** | Quick schedule checking between classes or meetings |
| **Photo capture & upload** | Documenting maintenance issues, asset conditions |
| **Offline mode** | Technicians often work in basements, boiler rooms with no signal |

### Tier 2 — Fast Follow
| Feature | Why |
|---------|-----|
| **Athletics** | Coaches track games, scores, and schedules from the field |
| **Dashboard overview** | Quick status check without opening a laptop |
| **Notifications center** | Centralized alert management |
| **User profile & settings** | Password changes, avatar, basic prefs |

### Tier 3 — Later or Web-Only
| Feature | Why it can wait |
|---------|----------------|
| **Admin settings** (roles, teams, permissions) | Complex config best done on desktop |
| **Campus map editor** | Interactive map editing needs a large screen |
| **Board report generation** | Heavy document workflow, desktop-suited |
| **Planning seasons** | Complex multi-step workflow |
| **Platform admin panel** | Internal tool, no mobile need |
| **Onboarding wizard** | One-time flow, fine on web |
| **Compliance management** | Document-heavy, desktop-first |
| **Knowledge base editing** | Content authoring better on desktop |

---

## Architecture

### High-Level Structure

```
lionheart-mobile/
├── app/                        # Expo Router screens (file-based)
│   ├── (auth)/                 # Login, set-password
│   ├── (tabs)/                 # Main tab navigator
│   │   ├── dashboard/
│   │   ├── calendar/
│   │   ├── maintenance/
│   │   ├── athletics/
│   │   └── more/
│   └── _layout.tsx             # Root layout
├── components/                 # Shared UI components
├── lib/
│   ├── api-client.ts           # Port of web fetchApi()
│   ├── auth.ts                 # Token storage (SecureStore)
│   ├── queries.ts              # TanStack Query keys & options (port from web)
│   ├── offline/                # SQLite + sync engine
│   └── hooks/                  # Custom hooks
├── shared/                     # Types, schemas shared with web (or extracted package)
└── assets/                     # Icons, images, fonts
```

### Navigation Structure

```
Tab Navigator
├── Dashboard        → summary cards, quick actions, weather
├── Calendar         → month/week/day views, event creation
├── Maintenance      → ticket list, submit request, QR scan
├── Athletics        → games, practices, scores, roster
└── More             → profile, settings, notifications, knowledge base
```

### Authentication Flow

Your existing JWT auth works perfectly for mobile:

1. User opens app → check `SecureStore` for saved token
2. No token → show login screen → POST `/api/auth/login` → store JWT in `SecureStore`
3. Has token → verify not expired → proceed to main app
4. All API calls attach `Authorization: Bearer <token>` header (same as web)
5. 401 response → clear token → redirect to login

The only addition is using Expo's `SecureStore` (encrypted, keychain-backed) instead of `localStorage`.

### Offline Architecture

Your web app already has offline patterns (Dexie/IndexedDB). The mobile equivalent:

| Web (current) | Mobile (proposed) |
|---------------|-------------------|
| Dexie (IndexedDB) | WatermelonDB or Expo SQLite |
| `offlineTickets` table | SQLite `tickets` table |
| `mutations` queue | SQLite `pending_mutations` table |
| `sync.ts` batch logic | Same pattern, adapted for SQLite |
| `navigator.onLine` | `NetInfo` from `@react-native-community/netinfo` |

The sync logic you've already built (`enqueueMutation`, `getPendingMutations`, conflict resolution) maps almost directly. The main change is swapping the storage layer.

### Push Notifications

Expo handles push notifications across both platforms:

1. Register device with `expo-notifications` → get push token
2. Send token to your API (new endpoint: `POST /api/devices/register`)
3. Backend stores token per user
4. When events happen (ticket assigned, event approved, etc.), call Expo Push API
5. Expo routes to APNs (iOS) or FCM (Android) automatically

New backend additions needed:
- `DevicePushToken` model in Prisma (userId, token, platform, createdAt)
- `POST /api/devices/register` and `DELETE /api/devices/unregister` endpoints
- Push notification service using `expo-server-sdk` Node library
- Trigger points in existing services (ticket assignment, event approval, etc.)

---

## Development Phases

### Phase 0: Project Setup (Weeks 1–2)

**Goal:** Scaffolding, tooling, shared code extraction

- Initialize Expo project with TypeScript template
- Set up Expo Router with tab navigation skeleton
- Configure EAS Build for iOS and Android
- Extract shared TypeScript types into a `packages/shared` workspace
- Port `fetchApi()` client with `SecureStore` token management
- Port TanStack Query setup and key factories
- Set up CI/CD (GitHub Actions → EAS Build)
- Apple Developer Account ($99/yr) and Google Play Console ($25 one-time) setup

**Deliverable:** Empty app shell that can authenticate against your live API

### Phase 1: Maintenance Module (Weeks 3–8)

**Goal:** Full maintenance workflow on mobile — this is your highest-value mobile feature

**Screens:**
- Maintenance dashboard (summary cards, recent tickets)
- Ticket list with filters (status, priority, assigned to me)
- Ticket detail view (status, description, photos, activity log)
- Submit request wizard (location → asset → details → photos)
- QR code scanner (scan asset → view details or submit ticket)
- Labor time entry with timer
- Cost entry with receipt photo
- PM checklist completion

**Native capabilities used:**
- Camera (photos for tickets and receipts)
- QR scanner (`expo-camera` barcode scanning)
- Location services (auto-detect building/campus)
- Offline storage + sync
- Push notifications (ticket assignment, status changes)

**Deliverable:** Maintenance-focused app in TestFlight (iOS) and Internal Testing (Android)

### Phase 2: Calendar + Notifications (Weeks 9–12)

**Goal:** Calendar viewing and event management on mobile

**Screens:**
- Month view (agenda-style, optimized for small screens)
- Day view (time slots)
- Event detail view
- Quick event creation
- Notification center (list of all notifications, mark read)
- Notification preferences

**Native capabilities used:**
- Push notifications for event reminders and approvals
- Calendar integration (optional: sync to device calendar)
- Share sheet (share event details)

**Deliverable:** Calendar + notifications added to existing TestFlight build

### Phase 3: Athletics Module (Weeks 13–18)

**Goal:** Coaches and athletic directors can manage from the field

**Screens:**
- Athletics dashboard (upcoming games, season overview)
- Game detail + live score entry
- Practice schedule view
- Roster management (view, not full edit)
- Player stat entry during games
- Tournament bracket view
- Season standings

**Native capabilities used:**
- Quick score entry (optimized for sideline use)
- Push notifications for game reminders
- Share game results

**Deliverable:** Full Tier 1 + Tier 2 feature set, ready for App Store submission

### Phase 4: Polish + App Store Launch (Weeks 19–22)

**Goal:** Production-ready, reviewed, and published

- App Store Optimization (screenshots, descriptions, keywords)
- Apple App Review submission (expect 1–2 rounds of feedback)
- Google Play Store submission
- Performance profiling and optimization
- Crash reporting setup (Sentry or Bugsnag via `expo-updates`)
- Analytics integration (Mixpanel, Amplitude, or PostHog)
- Deep linking configuration (open specific tickets/events from notifications)
- Biometric authentication option (Face ID / fingerprint unlock)

**Deliverable:** Live apps in both stores

### Phase 5: Ongoing (Post-Launch)

- OTA updates for bug fixes (no store review needed)
- Feature parity expansion based on user feedback
- Dashboard and profile screens
- Academic calendar view
- Knowledge base reader (view-only)
- Widget support (iOS home screen widgets for upcoming events)

---

## API Changes Required

Your existing API is well-structured and nearly mobile-ready. Only a few additions are needed:

### New Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/devices/register` | Register push notification token |
| `DELETE /api/devices/unregister` | Remove push token on logout |
| `GET /api/devices/me` | List user's registered devices |
| `POST /api/notifications/push-preferences` | Per-user notification settings |

### New Prisma Model

```prisma
model DevicePushToken {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  token          String
  platform       String   // "ios" or "android"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, token])
  @@index([organizationId])
}
```

### Existing Endpoints — No Changes Needed

All 181 current endpoints work as-is. The JWT auth, org-scoping headers, and response envelope format (`ok(data)` / `fail(code, message)`) are already mobile-friendly.

### Optional Enhancements

- **Pagination cursors** — Some list endpoints may benefit from cursor-based pagination for infinite scroll on mobile (vs. offset-based)
- **Image thumbnails** — Return smaller image variants for mobile bandwidth efficiency
- **Batch endpoints** — Combine multiple queries into single requests to reduce round-trips on cellular networks

---

## Tech Stack for Mobile

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Expo SDK 52+** | Managed workflow, OTA updates, EAS builds |
| Navigation | **Expo Router v4** | File-based routing, mirrors your Next.js patterns |
| State | **TanStack Query v5** | You already use it; same query keys port over |
| Styling | **NativeWind v4** | Tailwind CSS syntax for React Native — your team already thinks in Tailwind |
| Forms | **React Hook Form + Zod** | Consistent with web validation patterns |
| Offline DB | **WatermelonDB** or **Expo SQLite** | WatermelonDB for complex sync; SQLite for simpler needs |
| Auth storage | **expo-secure-store** | Encrypted keychain storage for JWT |
| Camera | **expo-camera** | Photo capture + QR scanning |
| Notifications | **expo-notifications** | Unified push for iOS + Android |
| Maps | **react-native-maps** | Campus map view (if needed) |
| Charts | **victory-native** | Charting library with React Native support |
| Animations | **react-native-reanimated v3** | 60fps native animations |
| Network | **@react-native-community/netinfo** | Online/offline detection |
| Crash reporting | **Sentry** (`@sentry/react-native`) | Error tracking in production |
| Analytics | **PostHog** or **Mixpanel** | Usage analytics |

---

## Cost Estimates

### Option A: Solo Developer / Small Team (DIY)

| Item | Cost |
|------|------|
| Apple Developer Account | $99/year |
| Google Play Console | $25 (one-time) |
| EAS Build (free tier) | $0 (limited builds) |
| EAS Build (production tier) | ~$99/month |
| Push notification service | $0 (Expo handles this free) |
| Sentry (crash reporting) | $0–$26/month |
| Developer time (6 months, 1 person) | $0 if you / your team does it |
| **Total (year 1)** | **~$1,300–$2,500** |

**Timeline:** 6–8 months with one experienced React/RN developer

### Option B: Hire 1–2 Mobile Developers

| Item | Cost |
|------|------|
| React Native developer (US, mid-level) | $80K–$130K/year (or $40–$65/hr contract) |
| Accounts + tooling (same as above) | ~$1,500/year |
| Design (freelance, 20–30 screens) | $3,000–$8,000 |
| **Total (to Phase 4 launch, ~5 months)** | **$35K–$65K** |

### Option C: Agency / Dev Shop

| Item | Cost |
|------|------|
| Agency build (Phase 1–4) | $80K–$150K+ |
| Ongoing maintenance retainer | $3K–$8K/month |
| **Total (build + 6 months maintenance)** | **$100K–$200K** |

### Option D: Offshore / Nearshore Team

| Item | Cost |
|------|------|
| 2 developers (Latin America / Eastern Europe) | $30–$50/hr each |
| Project manager | $25–$40/hr |
| Build timeline: 4–6 months | **$40K–$80K** |

**Recommendation:** If you're comfortable with React, **Option A** (building it yourself with Expo) is very viable for Phase 1. The Expo ecosystem has simplified mobile development dramatically. You could ship a maintenance-focused app in 6–8 weeks of dedicated work, then iterate.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Apple App Review rejection** | 1–2 week delay per round | Follow Apple HIG, test on real devices, submit early |
| **Offline sync conflicts** | Data loss or corruption | You already have conflict resolution patterns; port them carefully and test extensively |
| **Performance on older devices** | Poor UX for some users | Profile early, use `FlatList` virtualization, lazy-load screens |
| **Push notification reliability** | Missed alerts | Implement in-app notification center as fallback; don't rely solely on push |
| **Scope creep** | Timeline blows up | Strict phase boundaries; ship Phase 1 before starting Phase 2 |
| **Two codebases to maintain** | Ongoing cost | Extract shared types/schemas into a monorepo package; consider feature flags that work across both |

---

## Monorepo Strategy (Recommended)

To maximize code sharing between web and mobile, restructure into a monorepo:

```
lionheart/
├── apps/
│   ├── web/                 # Current Next.js app (moved here)
│   └── mobile/              # New Expo app
├── packages/
│   ├── shared/              # TypeScript types, Zod schemas, constants
│   ├── api-client/          # fetchApi wrapper, query keys, hooks
│   └── permissions/         # Permission constants + helpers
├── prisma/                  # Shared schema
├── package.json             # Workspace root
└── turbo.json               # Turborepo config (or nx.json)
```

This isn't required for Phase 1, but it pays off quickly once both apps are in active development. You can start with a standalone Expo project and migrate to a monorepo when the code-sharing overhead becomes worth it.

---

## App Store Requirements Checklist

### Apple App Store
- [ ] Apple Developer Account ($99/year)
- [ ] App icon (1024x1024 PNG, no alpha)
- [ ] Screenshots for iPhone 6.7", 6.5", 5.5" and iPad 12.9"
- [ ] Privacy policy URL (required)
- [ ] App description, keywords, subtitle
- [ ] Age rating questionnaire
- [ ] Export compliance (encryption declaration — yes, you use HTTPS)
- [ ] Sign In with Apple (required if you offer other social logins)
- [ ] Data collection disclosure (App Privacy labels)

### Google Play Store
- [ ] Google Play Console account ($25 one-time)
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots for phone and tablet
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience declaration
- [ ] Data safety section

---

## Decision Points (To Resolve Before Starting)

1. **Standalone project or monorepo from day one?**
   Standalone is faster to start. Monorepo pays off once you're sharing significant code.

2. **Expo managed vs. bare workflow?**
   Start managed. Only eject to bare if you hit a native module Expo doesn't support (unlikely for your use case).

3. **WatermelonDB vs. Expo SQLite for offline?**
   WatermelonDB is more powerful but complex. Expo SQLite is simpler. Choose based on how critical offline is for launch.

4. **Design: match web exactly, or native-feeling?**
   Recommended: native-feeling. Use platform conventions (iOS bottom sheets, Android material snackbars) rather than pixel-matching the web app. Users expect apps to feel like apps.

5. **Who builds it?**
   This plan is designed to work whether you build it yourself, hire someone, or engage an agency. The phased approach lets you start small and validate before committing major budget.

---

## Next Steps

1. **Create the Expo project** — `npx create-expo-app lionheart-mobile --template tabs`
2. **Set up EAS** — `eas init` and configure build profiles
3. **Port the API client** — Adapt `fetchApi()` with SecureStore token handling
4. **Build the login screen** — Prove auth works against your live API
5. **Start Phase 1** — Maintenance ticket list → detail → submission wizard
6. **Get on TestFlight within 4 weeks** — Even if incomplete, having it on a real device changes everything

---

*This plan is a living document. Update it as decisions are made and phases are completed.*
