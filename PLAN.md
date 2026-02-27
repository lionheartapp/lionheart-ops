# New Signup & Onboarding Flow — Implementation Plan

## Overview

Replace the current 15-field signup form with a streamlined experience:
1. **Minimal signup** (Google / Microsoft / email+password, school name, website)
2. **AI-powered school lookup** (auto-pull logo, colors, phone, address → show branded preview)
3. **Member import** (CSV upload, manual entry, or skip)
4. **"Getting things set up" screen** (actually provisions defaults behind the scenes, confetti on completion, redirects to dashboard)

---

## Phase 1: Auth.js Integration (Replace Custom JWT Auth)

### What changes
- Install `next-auth` (Auth.js v5) and configure it with three providers:
  - **Google** (OAuth)
  - **Microsoft / Azure AD** (OAuth)
  - **Credentials** (email + password — preserves existing bcrypt flow)
- Auth.js will issue JWTs (not database sessions) to stay compatible with the existing middleware and org-scoping pattern.
- The JWT callback will embed `{ userId, organizationId, email }` — same claims the app already expects.
- **New env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `NEXTAUTH_SECRET` (replaces `AUTH_SECRET`)

### Files to create/modify
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `src/lib/auth-config.ts` — Auth.js configuration (providers, callbacks, JWT strategy)
- `src/middleware.ts` — Update to read Auth.js JWT instead of custom token; keep platform admin auth separate
- `src/lib/auth.ts` — Keep `signAuthToken`/`verifyAuthToken` for backward compat during transition, but new signups go through Auth.js
- `prisma/schema.prisma` — Add `Account` and `Session` models (Auth.js adapter tables), add `googleId` and `microsoftId` fields to User

### Account linking logic
- On OAuth sign-in, look up User by email within the org. If found, link the OAuth account. If not found during signup, create new User + Org.
- Existing email/password users can later "Connect Google" or "Connect Microsoft" from settings.

---

## Phase 2: New Signup Modal (Minimal Form)

### What the user sees
A clean modal with:
- "Continue with Google" button
- "Continue with Microsoft" button
- Divider: "or"
- Email + Password fields
- School Name field
- School Website field (optional but encouraged — powers the AI lookup)
- "Create Account" button

That's it — 4-5 fields max instead of 15+.

### What happens on submit
1. Validate inputs (Zod)
2. Create Organization with just: `name`, `slug` (auto-generated from name), `website`
3. Create admin User (email, name, passwordHash or OAuth link)
4. Set `onboardingStatus: 'ONBOARDING'`
5. Seed org defaults (roles, permissions, teams — existing `seedOrgDefaults`)
6. Issue JWT, auto-login
7. Redirect to `/onboarding/school-info`

### Files to create/modify
- `src/app/SignupModal.tsx` — Complete rewrite (minimal form + OAuth buttons)
- `src/app/api/organizations/signup/route.ts` — Simplify to accept minimal fields
- `src/lib/services/organizationRegistrationService.ts` — Update `CreateOrganizationSchema` to make most fields optional; add `onboardingStatus: 'ONBOARDING'`

---

## Phase 3: AI-Powered School Lookup

### New API route: `POST /api/onboarding/school-lookup`
Accepts `{ website: string }` and returns extracted school data.

### Extraction pipeline (layered for best success rate)

**Layer 1 — Brandfetch API** (logo + brand colors)
- `GET https://api.brandfetch.io/v2/brands/{domain}`
- Returns: logos (icon, wordmark, full), brand colors (primary, secondary, accent), fonts
- Free tier: 1 request/second, sufficient for onboarding
- New env var: `BRANDFETCH_API_KEY`
- Fallback if no result: skip to Layer 3

**Layer 2 — Gemini** (structured text data)
- Fetch the school website HTML server-side (Node fetch, strip to text)
- Send to Gemini with structured extraction prompt:
  ```
  Extract from this school website: phone, physical address, principal name,
  principal email, grade levels, district name, student count, staff count,
  institution type (public/private/charter). Return as JSON.
  ```
- Uses existing `GeminiService` with a new method: `extractSchoolInfo(htmlText: string)`

**Layer 3 — Meta tag fallback** (if Brandfetch fails)
- Parse the already-fetched HTML for:
  - `<meta property="og:image">` → logo candidate
  - `<meta name="theme-color">` → primary color
  - `<link rel="icon">` / `<link rel="apple-touch-icon">` → favicon as logo fallback
  - `<meta name="description">` → school description

### Response shape
```typescript
{
  logo: string | null,           // URL
  colors: {
    primary: string | null,      // hex
    secondary: string | null,
    accent: string | null,
  },
  phone: string | null,
  address: string | null,
  principalName: string | null,
  principalEmail: string | null,
  district: string | null,
  gradeRange: string | null,
  institutionType: string | null,
  studentCount: number | null,
  staffCount: number | null,
  confidence: 'high' | 'medium' | 'low',  // based on how many layers succeeded
}
```

### Files to create
- `src/app/api/onboarding/school-lookup/route.ts` — Orchestrates the 3 layers
- `src/lib/services/schoolLookupService.ts` — Brandfetch client, HTML fetcher, meta parser
- `src/lib/services/ai/gemini.service.ts` — Add `extractSchoolInfo()` method

---

## Phase 4: Onboarding UI (3-Step Flow)

### New pages under `src/app/onboarding/`

All onboarding pages are protected — require auth but allow `onboardingStatus: 'ONBOARDING'`.
Middleware update: allow `/onboarding/*` paths for authenticated users who haven't completed onboarding.

#### `src/app/onboarding/layout.tsx`
- Clean, minimal layout (no sidebar — just logo + progress indicator)
- Progress bar showing steps: School Info → Add Members → Setup Complete
- "Skip" option on each step

#### Step 1: `src/app/onboarding/school-info/page.tsx`
**"Let's set up your school"**

On mount:
- If org has a website, auto-trigger the school lookup API
- Show a loading state: "Finding your school's information..."
- When results come back, show a **live branded preview card** with the school's logo, colors, and extracted data

The page displays:
- Branded preview card (logo + school name in their colors) — the "wow" moment
- Editable fields pre-filled with AI-extracted data:
  - Logo (with upload override via Supabase Storage)
  - Primary color picker (pre-filled from Brandfetch)
  - Phone, Address, District, Grade Range
  - Principal Name, Principal Email
  - Institution Type dropdown
  - Student Count, Staff Count
- "Looks good, continue" button → saves to Organization, advances to step 2
- "Skip for now" link → advances to step 2 without saving

#### Step 2: `src/app/onboarding/members/page.tsx`
**"Add your team"**

Three options presented as cards:
1. **Upload CSV** — Drag & drop or file picker. Expected columns: `name, email, role (optional), team (optional)`. Preview table before import. Bulk creates users with status `PENDING` + sends welcome emails.
2. **Add manually** — Simple inline form (name + email + role dropdown). Add multiple with "Add another" button.
3. **Skip** — "I'll do this later" link

### New API routes for member import:
- `POST /api/onboarding/import-members` — Accepts CSV data (parsed client-side with PapaParse), validates, bulk creates users + sends invites
- Uses existing `sendWelcomeEmail` service for invitations

#### Step 3: `src/app/onboarding/setup/page.tsx`
**"Getting things set up for you..."**

Behind the scenes (actual provisioning):
- Apply brand colors to org theme (`theme` JSON field on Organization)
- Upload logo to Supabase Storage if it was fetched from Brandfetch, save URL to `logoUrl`
- Auto-create default building from address (e.g., "Main Building" with the school's address)
- Set `onboardingStatus: 'ACTIVE'`
- Create subscription (Free Trial plan, 30-day trial period)

UI shows:
- Animated progress with checkmarks appearing one by one:
  - ✓ "Setting up your school profile..."
  - ✓ "Applying your brand colors..."
  - ✓ "Creating your workspace..."
  - ✓ "Starting your free trial..."
  - ✓ "Sending invitations to your team..." (if members were added)
- Confetti animation when all done (use `canvas-confetti` library)
- "Welcome to Lionheart!" message
- "Go to Dashboard" button → redirects to `/dashboard`

### New API route:
- `POST /api/onboarding/finalize` — Runs all provisioning steps, updates onboardingStatus to ACTIVE

### Files to create
- `src/app/onboarding/layout.tsx`
- `src/app/onboarding/school-info/page.tsx`
- `src/app/onboarding/members/page.tsx`
- `src/app/onboarding/setup/page.tsx`
- `src/app/api/onboarding/school-lookup/route.ts`
- `src/app/api/onboarding/import-members/route.ts`
- `src/app/api/onboarding/finalize/route.ts`

---

## Phase 5: Supabase Storage Integration

### Setup
- Create a `logos` bucket in Supabase Storage (public read, authenticated write)
- Create an `imports` bucket (private, for temporary CSV storage)

### New service: `src/lib/services/storageService.ts`
- `uploadLogo(orgId: string, file: Buffer, contentType: string): Promise<string>` — returns public URL
- `uploadCSV(orgId: string, file: Buffer): Promise<string>` — returns signed URL
- Uses `@supabase/supabase-js` client with service role key

### New env vars
- `NEXT_PUBLIC_SUPABASE_URL` (already have this via DATABASE_URL domain)
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Phase 6: Schema Changes

### New fields on User
```prisma
googleId    String?   @unique
microsoftId String?   @unique
authMethod  AuthMethod @default(EMAIL)  // EMAIL, GOOGLE, MICROSOFT
```

### New enum
```prisma
enum AuthMethod {
  EMAIL
  GOOGLE
  MICROSOFT
}
```

### Auth.js adapter tables (if using database adapter)
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}
```

---

## Phase 7: Middleware Updates

- Add `/onboarding` to allowed paths for authenticated users
- Add `/api/onboarding/*` to allowed paths
- If user's org has `onboardingStatus: 'ONBOARDING'` and they try to access the main app, redirect to `/onboarding/school-info`
- Auth.js callback URLs (`/api/auth/*`) must be public

---

## Implementation Order

1. **Schema changes** — Add AuthMethod enum, googleId/microsoftId fields, Account model
2. **Auth.js setup** — Install, configure providers, JWT callbacks, update middleware
3. **Signup modal rewrite** — Minimal form with OAuth buttons
4. **School lookup service** — Brandfetch + Gemini + meta tag extraction
5. **Supabase Storage** — Logo upload service
6. **Onboarding Step 1** — School info page with AI lookup + branded preview
7. **Onboarding Step 2** — Member import (CSV + manual)
8. **Onboarding Step 3** — Finalization + confetti
9. **Middleware guards** — Onboarding redirect logic
10. **Testing & polish**

---

## New Environment Variables Summary

```
GOOGLE_CLIENT_ID        # Google OAuth
GOOGLE_CLIENT_SECRET    # Google OAuth
MICROSOFT_CLIENT_ID     # Microsoft OAuth
MICROSOFT_CLIENT_SECRET # Microsoft OAuth
NEXTAUTH_SECRET         # Auth.js signing secret (can reuse AUTH_SECRET)
BRANDFETCH_API_KEY      # School branding lookup
SUPABASE_SERVICE_ROLE_KEY # Supabase Storage uploads
```

---

## Risk Considerations

- **Auth.js migration**: Existing users have custom JWTs. We'll keep the old auth working during transition. New signups use Auth.js, existing users can continue with email/password login (Credentials provider wraps the existing bcrypt verification).
- **Brandfetch rate limits**: Free tier is limited. Cache results per domain to avoid repeated lookups. Graceful degradation if API is down.
- **Gemini extraction accuracy**: Always show editable fields — AI results are suggestions, not final answers.
- **Large CSV imports**: Cap at 500 members per import. Process async if needed for larger schools.
