# Onboarding UI Quick Start Guide

## Overview

Complete, production-ready onboarding UI for Lionheart. 4 pages + 1 rewritten signup modal, all using Next.js 15, React 18, and Tailwind CSS.

## Files Created

| File | Type | Purpose |
|------|------|---------|
| `src/app/onboarding/layout.tsx` | Layout | Wrapper with progress bar and navigation |
| `src/app/onboarding/school-info/page.tsx` | Page | School details setup (logo, colors, principal info) |
| `src/app/onboarding/members/page.tsx` | Page | Team member invitations (CSV or manual) |
| `src/app/onboarding/setup/page.tsx` | Page | Final setup completion with celebration |
| `src/app/SignupModal.tsx` | Component | Rewritten signup modal (5 fields + OAuth) |

## User Journey

```
Landing Page (src/app/page.tsx)
    ↓ [Get Started button]
SignupModal (src/app/SignupModal.tsx)
    ↓ [Create Account]
/onboarding/school-info
    ↓ [Upload logo, set colors, fill principal info]
/onboarding/members
    ↓ [Upload CSV or add members manually]
/onboarding/setup
    ↓ [Confetti! Go to Dashboard]
Dashboard (organization-specific)
```

## Key Features

### SignupModal.tsx
- **5 fields:** Name, Email, Password, School Name, School Website
- **OAuth ready:** Google & Microsoft buttons (placeholders)
- **Validation:** Email format, password 8+ chars, required fields
- **On submit:** Creates org, stores tokens, redirects to /onboarding/school-info

### School Info Page
- **Auto-prefill:** Fetches org data if available
- **School lookup:** Optional POST to /api/onboarding/school-lookup
- **Branded preview:** Shows school logo + name + primary color
- **Logo upload:** Client-side file picker, base64 encoding
- **Color picker:** Visual swatch + text input for hex codes
- **Form fields:** 10+ inputs (phone, address, principal info, etc.)

### Members Page
- **3 options:** Upload CSV, Add Manually, Skip for Later
- **CSV parsing:** PapaParse handles multiple column name formats
- **Manual entry:** Add members one by one with validation
- **Preview:** Shows list of members before import
- **Success state:** Count + confetti-style loader before redirect

### Setup Page
- **Animated steps:** 5 sequential steps with 800ms stagger
- **Status flow:** Pending (circle) → Loading (spinner) → Done (checkmark)
- **Confetti:** canvas-confetti explosion on completion
- **Dashboard link:** Auto-constructs subdomain-based URL
- **Help link:** Points to documentation

### Layout
- **Progress indicator:** 3-step numbered progress bar
- **Mobile-responsive:** Full bar on desktop, dots on mobile
- **Logo:** Lionheart branding on left
- **Clean styling:** White background, blue accents, card container

## localStorage Keys

Used for persistent auth state across pages:

```javascript
localStorage.setItem('auth-token', 'jwt-token-here')
localStorage.setItem('org-id', 'organization-uuid')
localStorage.setItem('org-name', 'School Name')
localStorage.setItem('org-slug', 'school-slug')
localStorage.setItem('user-name', 'User Full Name')
localStorage.setItem('user-email', 'user@email.com')
```

## API Endpoints Required

Your backend should implement these endpoints:

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/organizations/signup` | POST | Create org + admin | name, website, adminEmail, adminName, adminPassword, slug |
| `/api/organizations/current` | GET | Get org details | (reads auth token header) |
| `/api/organizations/update` | PATCH | Update org info | phone, physicalAddress, district, gradeRange, etc. |
| `/api/onboarding/school-lookup` | POST | Lookup school by domain | website |
| `/api/onboarding/import-members` | POST | Bulk invite members | members: [{name, email}...] |
| `/api/onboarding/finalize` | POST | Complete onboarding | schoolData, memberCount |

## Styling & Customization

### Colors (Light Theme)
- **Primary:** `blue-600` (#2563eb)
- **Success:** `green-500` (#22c55e)
- **Error:** `red-600` (#dc2626)
- **Background:** `white` (bg-white)
- **Text:** `gray-900` (dark), `gray-600` (secondary)

### Fonts
- **Headers:** font-bold, text-2xl-4xl
- **Labels:** font-medium, text-sm
- **Body:** text-base, text-gray-600

### Spacing
- **Container max-width:** max-w-2xl (672px)
- **Modal max-width:** max-w-md (448px)
- **Padding:** px-4 sm:px-6 lg:px-8
- **Gap:** gap-3 to gap-8 depending on context

### Icons
- Source: `lucide-react`
- Sizes: w-4/5 (small), w-6 (standard), w-8-16 (headers)
- Color: text-blue-600 (primary), text-gray-400 (muted)

## Common Customizations

### Change Primary Color
1. Update Tailwind color: `bg-blue-600` → `bg-purple-600`
2. Update form buttons and accents throughout
3. Update branded preview card: `style={{ backgroundColor: data.primaryColor }}`

### Add/Remove Form Fields
- School Info: Edit lines 100-165 (form fields)
- Members: Edit CSV column detection (~line 50)
- Update API payload in handleSave / handleImportMembers

### Adjust Animation Timing
- Members page success: `setTimeout(..., 1500)` (line 161)
- Setup page stagger: `await new Promise(resolve => setTimeout(resolve, 800))` (line 95)

### Change Progress Step Labels
- Layout.tsx line 14: Update STEPS array labels

## Testing Notes

1. **SignupModal:** Test email validation, password strength, school name generation
2. **School Info:** Mock the school-lookup API, test logo upload, color picker
3. **Members:** Test CSV parsing with edge cases (missing columns, extra whitespace)
4. **Setup:** Verify confetti animation, correct dashboard redirect URL
5. **Mobile:** Check responsive layout on 375px+ widths

## Troubleshooting

**Confetti not showing?**
- Ensure `canvas-confetti` is installed: `npm list canvas-confetti`
- Check browser console for errors
- Try resetting animations: Clear browser cache

**Form submission fails?**
- Verify API endpoints exist and return proper response format
- Check Authorization header: `Bearer {token}`
- Ensure localStorage tokens are set correctly

**Progress bar not updating?**
- Layout reads pathname dynamically - ensure route structure is `/onboarding/{step}`
- Browser back button may cache old progress - test in new tab

**CSV upload not working?**
- PapaParse column detection is case-sensitive - check CSV headers
- Accepted columns: `name`, `Name`, `email`, `Email`, `email_address`
- Add more columns in members/page.tsx line 45-48

## Dependencies (Already Installed)

```json
{
  "next": "^15.1.0",
  "react": "^18.3.1",
  "lucide-react": "^0.564.0",
  "canvas-confetti": "^1.9.3",
  "papaparse": "^5.5.2"
}
```

## Next Steps

1. **Implement backend APIs** - All 6 endpoints listed above
2. **Test signup flow** - Create test org, verify localStorage state
3. **Connect school lookup** - If available (optional feature)
4. **Configure OAuth** - Replace Google/Microsoft button placeholders
5. **Deploy to production** - Test on live domain
6. **Monitor user flow** - Track completion rates, drop-off points

---

**Questions?** Refer to `/sessions/optimistic-dreamy-bardeen/mnt/Linfield Test/ONBOARDING_IMPLEMENTATION.md` for detailed documentation.
