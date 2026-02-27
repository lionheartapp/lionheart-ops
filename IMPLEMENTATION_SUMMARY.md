# Auth.js Integration & Onboarding Services - Implementation Summary

## Overview

This implementation adds Auth.js v5 integration and comprehensive onboarding services to the Lionheart platform. All files are production-ready with proper error handling, validation, and architectural consistency with the existing codebase.

## Files Created

### 1. **src/lib/auth-config.ts** — Auth.js Configuration
Authentication configuration using Auth.js v5 with JWT strategy for compatibility with existing middleware.

**Key Features:**
- JWT-based sessions (not database sessions) - maintains existing 30-day token expiry
- Three authentication providers:
  - **Credentials (Email + Password)**: Looks up users by email across all organizations, verifies password with bcryptjs
  - **Google OAuth**: Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
  - **Microsoft Azure AD**: Uses AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
- Custom JWT callback embeds userId, organizationId, and email in token
- Custom Session callback exposes user context in session object
- signIn callback prevents OAuth signup (users must go through signup flow first)
- Graceful fallback for missing OAuth credentials

**Environment Variables Required:**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AZURE_AD_CLIENT_ID
AZURE_AD_CLIENT_SECRET
AZURE_AD_TENANT_ID
AUTH_SECRET (or NEXTAUTH_SECRET)
NEXTAUTH_URL (for production)
```

### 2. **src/app/api/auth/[...nextauth]/route.ts** — Auth.js Route Handler
Simple route handler that exports Auth.js GET/POST endpoints for all authentication flows (sign-in, sign-out, callbacks, etc.).

### 3. **src/lib/services/schoolLookupService.ts** — School Data Extraction
AI-powered school lookup service with 3-layer data extraction:

**Layer 1: Brandfetch API**
- Fetches logo and brand colors
- Optional (graceful fallback if API key missing or fails)
- Requires BRANDFETCH_API_KEY

**Layer 2: Website Scraping + Gemini AI**
- Server-side fetch of website HTML with 5s timeout
- Strips HTML to text and sends to Google Gemini
- Extracts structured data: phone, address, principal info, district, grades, institution type, student/staff counts
- Requires GEMINI_API_KEY

**Layer 3: Meta Tag Fallback**
- Parses og:image, theme-color, apple-touch-icon, favicon
- Fallback for basic styling information

**Returns:**
```typescript
{
  logo: string | null
  colors: { primary, secondary, accent }
  phone, address, principalName, principalEmail, district
  gradeRange, institutionType, studentCount, staffCount
  confidence: 0-100 score
}
```

### 4. **src/lib/services/storageService.ts** — Supabase Storage Service
Handles file uploads to Supabase Storage buckets.

**Functions:**
- `uploadLogo(orgId, fileBuffer, contentType)` - Uploads buffer and returns public URL
- `uploadFromUrl(orgId, imageUrl)` - Downloads image from URL and uploads
- `deleteFile(orgId, fileName)` - Deletes file from storage
- `getPublicUrl(orgId, fileName)` - Constructs public URL

**Environment Variables Required:**
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### 5. **src/app/api/onboarding/school-lookup/route.ts** — School Lookup Endpoint
`POST /api/onboarding/school-lookup`

**Request:**
```json
{
  "website": "https://example-school.edu" or "example-school.edu"
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* schoolLookupService result */ }
}
```

**Authentication:** Required (reads JWT from Authorization header)

### 6. **src/app/api/onboarding/import-members/route.ts** — Bulk Member Import
`POST /api/onboarding/import-members`

**Request:**
```json
{
  "members": [
    {
      "name": "John Doe",
      "email": "john@school.edu",
      "role": "admin",           // optional, role slug
      "team": "it-support"       // optional, team slug
    }
  ]
}
```

**Process:**
1. Validates email uniqueness within organization
2. Creates User with status PENDING
3. Generates PasswordSetupToken (valid 7 days)
4. Adds to team if specified
5. Sends welcome email with setup link

**Response:**
```json
{
  "ok": true,
  "data": {
    "imported": 5,
    "members": ["john@school.edu", ...],
    "errors": [
      { "email": "duplicate@school.edu", "reason": "User already exists" }
    ]
  }
}
```

**Limits:** Maximum 500 members per request

**Authentication:** Required + org context via x-org-id header

### 7. **src/app/api/onboarding/finalize/route.ts** — Onboarding Finalization
`POST /api/onboarding/finalize`

**Request:**
```json
{
  "theme": {
    "primaryColor": "#1a73e8",
    "secondaryColor": "#4285f4",
    "accentColor": "#ea4335"
  },
  "logoUrl": "https://storage.example.com/logo.png"
}
```

**Process:**
1. Updates organization theme colors (stored as JSON)
2. Sets logoUrl
3. Creates default Building if address exists
4. Sets onboardingStatus to ACTIVE
5. Creates Free Trial subscription (30 days)

**Response:**
```json
{
  "ok": true,
  "data": {
    "organization": { /* updated org */ },
    "status": "FINALIZED"
  }
}
```

**Authentication:** Required + org context via x-org-id header

**Prevents:** Re-finalizing already active organizations (409 Conflict)

## Integration Points

### With Existing Auth System
- Uses existing `signAuthToken()` and `verifyAuthToken()` for JWT compatibility
- Maintains existing JWT payload structure: `{ userId, organizationId, email }`
- Works with existing middleware that injects `x-org-id` header
- Compatible with `getUserContext()` function

### With Existing Services
- Uses `sendWelcomeEmail()` from emailService for member invites
- Uses `generateSetupToken()` and `hashSetupToken()` for password reset tokens
- Uses org-scoped `prisma` client inside `runWithOrgContext()`
- Uses `rawPrisma` for cross-org lookups (auth, org updates, subscriptions)
- Respects soft-delete patterns (deletedAt)

### With Existing Patterns
- API response envelope: `ok(data)` and `fail(code, message, details)`
- Error handling with proper HTTP status codes (400, 401, 403, 404, 409, 500)
- Zod validation for all inputs
- Try/catch blocks with specific error messages
- Request context verification with `getUserContext(req)`
- Organization context with `runWithOrgContext()`

## Environment Setup

### Required for Auth.js
```bash
# JWT Secret (use: npm run auth:secret)
AUTH_SECRET="your-long-random-secret-here"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Azure AD (optional)
AZURE_AD_CLIENT_ID="..."
AZURE_AD_CLIENT_SECRET="..."
AZURE_AD_TENANT_ID="common"

# NextAuth URL (required in production)
NEXTAUTH_URL="https://yourdomain.com"
```

### Required for Services
```bash
# School Lookup
BRANDFETCH_API_KEY="..." (optional)
GEMINI_API_KEY="..."

# Storage
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."

# Email
RESEND_API_KEY="..." (or SMTP credentials)
MAIL_FROM="noreply@lionheartapp.com"
```

## Testing

### School Lookup
```bash
curl -X POST http://localhost:3004/api/onboarding/school-lookup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"website":"example.edu"}'
```

### Import Members
```bash
curl -X POST http://localhost:3004/api/onboarding/import-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "x-org-id: <orgId>" \
  -d '{
    "members":[
      {"name":"John Doe","email":"john@example.com","role":"admin"}
    ]
  }'
```

### Finalize Onboarding
```bash
curl -X POST http://localhost:3004/api/onboarding/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "x-org-id: <orgId>" \
  -d '{
    "theme":{"primaryColor":"#1a73e8"},
    "logoUrl":"https://example.com/logo.png"
  }'
```

## Error Handling

All endpoints follow consistent error patterns:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|INTERNAL_ERROR",
    "message": "Human-readable error message",
    "details": [ /* optional validation errors */ ]
  }
}
```

Status codes:
- 400: Validation error
- 401: Missing/invalid authentication
- 403: Missing organization context
- 404: Resource not found
- 409: Conflict (e.g., already finalized)
- 500: Internal server error

## Security Considerations

1. **JWT Security**: 30-day expiry, HS256 with random secret
2. **OAuth Account Linking**: Prevents account hijacking with provider checks
3. **Email Validation**: All emails verified and normalized
4. **Organization Scoping**: All org-scoped operations use AsyncLocalStorage
5. **Soft Deletes**: User deletions are reversible via soft-delete pattern
6. **File Upload**: Supabase handles storage security, signed URLs for public access
7. **Email Tokenization**: Password setup tokens are SHA256 hashed in database
8. **Timeouts**: Network requests have explicit timeouts (5-10 seconds)

## Production Checklist

- [ ] Generate AUTH_SECRET: `npm run auth:secret`
- [ ] Set NEXTAUTH_URL for OAuth callbacks
- [ ] Configure OAuth credentials in provider dashboards
- [ ] Set up Brandfetch API key (optional but recommended)
- [ ] Set up Gemini API credentials
- [ ] Configure Supabase Storage bucket 'logos' with public access
- [ ] Set up SMTP or Resend email credentials
- [ ] Test all three auth providers
- [ ] Test member import with large batch (500 members)
- [ ] Test school lookup with various website formats
- [ ] Verify email delivery in production
- [ ] Monitor Auth.js logs for failed sign-ins

## Future Enhancements

1. **Rate Limiting**: Add rate limits to school lookup and import endpoints
2. **Batch Optimization**: Implement batch email sending for large imports
3. **Webhook Support**: Add webhooks for onboarding stage changes
4. **Custom Fields**: Support custom member import fields per organization
5. **AI Improvements**: Use multi-modal Gemini for extracting logos/images
6. **Caching**: Cache Brandfetch results for frequently-looked-up schools
7. **Audit Logging**: Log all onboarding actions for compliance
8. **Manual Upload**: Allow direct logo upload instead of URL import
