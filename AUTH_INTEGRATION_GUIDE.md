# Auth.js Integration Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install next-auth@latest @supabase/supabase-js @google/generai
```

### 2. Generate Auth Secret
```bash
npm run auth:secret
```

Add the output to `.env.local`:
```bash
AUTH_SECRET="your-generated-secret-here"
```

### 3. Configure Environment Variables

**Minimum Required (.env.local or .env):**
```bash
# Auth Secret (generate with: npm run auth:secret)
AUTH_SECRET="..."

# Database
DATABASE_URL="..."
DIRECT_URL="..."

# Gemini AI (for school lookup)
GEMINI_API_KEY="..."

# Supabase Storage (for logo uploads)
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."

# Email Service (RESEND or SMTP)
RESEND_API_KEY="..." # OR SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
MAIL_FROM="noreply@lionheartapp.com"
```

**OAuth (Optional):**
```bash
# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Microsoft Azure AD
AZURE_AD_CLIENT_ID="..."
AZURE_AD_CLIENT_SECRET="..."
AZURE_AD_TENANT_ID="common" # or your tenant ID

# For production
NEXTAUTH_URL="https://yourdomain.com"
```

**Optional - Brand Data Extraction:**
```bash
BRANDFETCH_API_KEY="..." # For logo/color extraction
```

### 4. Update Middleware (if needed)

The existing middleware in `src/middleware.ts` already supports Auth.js JWT tokens. No changes needed if using Bearer tokens.

### 5. Create Supabase Storage Bucket

1. Go to Supabase dashboard > Storage
2. Create bucket named `logos`
3. Set to Public (allow public read access)
4. Update bucket policy for authenticated uploads:

```json
{
  "version": "1",
  "definitions": {
    "basePath": ["logos/{organizationId}/*"]
  },
  "rules": [
    {
      "operation": "SELECT",
      "authenticated": true,
      "using": {}
    },
    {
      "operation": "INSERT",
      "authenticated": true,
      "using": {}
    },
    {
      "operation": "UPDATE",
      "authenticated": true,
      "using": {}
    },
    {
      "operation": "DELETE",
      "authenticated": true,
      "using": {}
    }
  ]
}
```

## API Endpoints

### Authentication
```
POST /api/auth/signin          # Sign in (any provider)
POST /api/auth/callback/{provider}  # OAuth callback
POST /api/auth/signout         # Sign out
GET  /api/auth/session         # Get current session
GET  /api/auth/csrf            # CSRF token
```

### Onboarding
```
POST /api/onboarding/school-lookup    # AI school lookup
POST /api/onboarding/import-members   # Bulk member import
POST /api/onboarding/finalize         # Complete onboarding
```

## Usage Examples

### Sign In (Client-side with next-auth)
```typescript
import { signIn } from 'next-auth/react'

// Email & Password
await signIn('credentials', {
  email: 'user@example.com',
  password: 'password123',
  redirect: true,
  callbackUrl: '/dashboard'
})

// Google OAuth
await signIn('google', { callbackUrl: '/dashboard' })

// Microsoft OAuth
await signIn('azure-ad', { callbackUrl: '/dashboard' })
```

### Get User Session (Client-side)
```typescript
import { useSession } from 'next-auth/react'

export default function Page() {
  const { data: session } = useSession()

  if (!session) {
    return <p>Not signed in</p>
  }

  return (
    <p>
      Signed in as {session.user.email}
      Organization: {session.user.organizationId}
    </p>
  )
}
```

### School Lookup (Server-side)
```typescript
import { lookupSchool } from '@/lib/services/schoolLookupService'

const result = await lookupSchool('example-school.edu')
console.log(result)
// {
//   logo: 'https://...',
//   colors: { primary, secondary, accent },
//   phone: '555-1234',
//   address: '123 Main St',
//   principalName: 'John Smith',
//   ...
// }
```

### Upload File to Storage
```typescript
import { uploadLogo, uploadFromUrl } from '@/lib/services/storageService'

// Upload from buffer
const logoUrl = await uploadLogo(
  orgId,
  fileBuffer,
  'image/png'
)

// Upload from URL
const logoUrl = await uploadFromUrl(
  orgId,
  'https://example.com/logo.png'
)
```

## Data Models

### User Schema (relevant fields)
```typescript
User {
  id: string
  email: string
  organizationId: string
  passwordHash: string | null  // bcryptjs hash
  status: UserStatus  // ACTIVE | PENDING
  authMethod: AuthMethod  // EMAIL | GOOGLE | MICROSOFT
  googleId: string | null
  microsoftId: string | null
  firstName: string | null
  lastName: string | null
  ...
}
```

### Account Schema (OAuth)
```typescript
Account {
  id: string
  userId: string
  provider: string  // 'google', 'azure-ad'
  providerAccountId: string
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
  ...
}
```

## Common Tasks

### Reset a User's Password
```typescript
import bcryptjs from 'bcryptjs'
import { rawPrisma } from '@/lib/db'

const passwordHash = await bcryptjs.hash('newpassword', 10)
await rawPrisma.user.update({
  where: { id: userId },
  data: { passwordHash }
})
```

### Link OAuth Account to Existing User
```typescript
// This happens automatically during OAuth flow if email matches
// Manual linking (if needed):
await rawPrisma.account.create({
  data: {
    userId: existingUserId,
    provider: 'google',
    type: 'oauth',
    providerAccountId: googleId,
    access_token: token,
    // ... other fields
  }
})
```

### Import Members with Teams
```typescript
const response = await fetch('/api/onboarding/import-members', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-org-id': organizationId
  },
  body: JSON.stringify({
    members: [
      {
        name: 'John Doe',
        email: 'john@school.edu',
        role: 'admin',
        team: 'it-support'
      },
      {
        name: 'Jane Smith',
        email: 'jane@school.edu',
        role: 'teacher',
        team: 'teachers'
      }
    ]
  })
})

const result = await response.json()
console.log(result.data.imported)  // 2
console.log(result.data.errors)    // []
```

### Complete Onboarding
```typescript
const response = await fetch('/api/onboarding/finalize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-org-id': organizationId
  },
  body: JSON.stringify({
    theme: {
      primaryColor: '#1a73e8',
      secondaryColor: '#4285f4',
      accentColor: '#ea4335'
    },
    logoUrl: 'https://storage.example.com/logo.png'
  })
})

const result = await response.json()
console.log(result.data.status)  // 'FINALIZED'
```

## Troubleshooting

### "Missing x-org-id header"
The middleware needs to inject the organization ID. Ensure:
1. Request has valid Bearer token
2. Token contains `organizationId` claim
3. Middleware is running before route handler

### "User not found"
Possible causes:
1. JWT token is valid but user was deleted
2. User was soft-deleted (deletedAt is set)
3. Organization ID mismatch

Check with: `rawPrisma.user.findUnique({ where: { id } })`

### OAuth callback failing
1. Check NEXTAUTH_URL matches provider redirect URI
2. Verify GOOGLE_CLIENT_ID/SECRET in provider dashboard
3. Check AZURE_AD tenant ID matches your setup
4. Review Auth.js logs for detailed error

### School lookup returning low confidence
1. Website might not have standard meta tags
2. Gemini API key might be invalid
3. Website might be blocking requests (add User-Agent in fetch)
4. Content might be dynamically loaded (JavaScript rendered)

### Email not sending
1. Check RESEND_API_KEY or SMTP credentials
2. Verify MAIL_FROM domain is authorized
3. Check spam/junk folder
4. Test with: `npm run test:email`

## Security Best Practices

1. **Never commit secrets** - Use .env.local for local dev
2. **Rotate Auth Secret** - Change AUTH_SECRET periodically
3. **Use HTTPS in production** - Set NEXTAUTH_URL to https://
4. **Validate all inputs** - Zod schemas are included
5. **Rate limit endpoints** - Add middleware for production
6. **Monitor auth logs** - Watch for suspicious sign-in attempts
7. **Use OAuth for user providers** - Reduces password management
8. **Soft delete users** - Never hard-delete (reversible)

## Performance Optimization

1. **Cache school lookups** - Avoid redundant Brandfetch calls
2. **Batch email sends** - Group welcome emails
3. **Store theme as JSON** - Avoid repeated parsing
4. **Index userId + provider** - Fast OAuth lookups
5. **Connection pooling** - Use Supabase pooling for database

## Testing

### Test Credentials Provider
```bash
curl -X POST http://localhost:3004/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass",
    "provider": "credentials"
  }'
```

### Test School Lookup
```bash
curl -X POST http://localhost:3004/api/onboarding/school-lookup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"website": "mit.edu"}'
```

### Test Session
```bash
curl http://localhost:3004/api/auth/session \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

## Next Steps

1. Configure OAuth providers in respective dashboards
2. Test credentials provider locally
3. Deploy to staging environment
4. Test OAuth providers
5. Monitor auth logs
6. Train admins on member import process
7. Plan user migration (if switching from old auth system)

## Support

- Auth.js Docs: https://authjs.dev
- Supabase Docs: https://supabase.com/docs
- Google Gemini: https://ai.google.dev
- Brandfetch: https://brandfetch.com/api

## Version Info

- next-auth: v5.x
- next: 15.x (App Router)
- prisma: v5.22
- @supabase/supabase-js: latest
- @google/generai: latest
