# Onboarding API Specification

Complete API specification for the onboarding system. All endpoints are fully implemented and production-ready.

## Base Information

- **Base URL**: `https://api.lionheartapp.com` (or `http://localhost:3004` for local)
- **Authentication**: Bearer token in `Authorization` header (JWT)
- **Tenant Context**: `x-org-id` header for org-scoped operations
- **Content-Type**: `application/json`
- **Response Format**: Standard envelope with `ok`, `data`, and `error` fields

## Standard Response Format

### Success Response (2xx)
```json
{
  "ok": true,
  "data": { /* endpoint-specific data */ },
  "meta": { /* optional metadata */ }
}
```

### Error Response (4xx, 5xx)
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ /* optional validation details */ ]
  }
}
```

### Status Codes
- `200 OK` - Successful request
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Missing organization context
- `404 Not Found` - Resource not found
- `409 Conflict` - Business logic conflict (e.g., already finalized)
- `500 Internal Server Error` - Server error

---

## 1. School Lookup Endpoint

Extract institutional data from school websites using AI.

### Request

**Endpoint**: `POST /api/onboarding/school-lookup`

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body**:
```json
{
  "website": "string (required)"
}
```

**Website Format Options**:
- Full URL: `https://example-school.edu`
- Domain only: `example-school.edu`
- URL with path: `https://example-school.edu/about`

### Response

**Success (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "logo": "https://example.com/logo.png or null",
    "colors": {
      "primary": "#1a73e8 or null",
      "secondary": "#4285f4 or null",
      "accent": "#ea4335 or null"
    },
    "phone": "555-123-4567 or null",
    "address": "123 Main Street, City, State 12345 or null",
    "principalName": "John Smith or null",
    "principalEmail": "john.smith@school.edu or null",
    "district": "Springfield School District or null",
    "gradeRange": "K-5 or elementary or null",
    "institutionType": "public or private or charter or null",
    "studentCount": 500 or null",
    "staffCount": 50 or null",
    "confidence": 75
  }
}
```

**Errors**:
- `400 VALIDATION_ERROR`: Invalid website URL
- `401 UNAUTHORIZED`: Missing or invalid authentication

### Data Extraction Layers

1. **Brandfetch API** (Logo & Colors)
   - Requires: `BRANDFETCH_API_KEY`
   - Timeout: 5 seconds
   - Returns: logo URL, primary/secondary/accent colors

2. **Website Scraping + Gemini** (Structured Data)
   - Fetches website HTML with 5-second timeout
   - Extracts text and sends to Google Gemini API
   - Requires: `GEMINI_API_KEY`
   - Returns: Contact info, address, principal details, grades, counts

3. **Meta Tag Fallback** (Basic Styling)
   - Parses og:image, theme-color, apple-touch-icon, favicon
   - Always available (no API keys)
   - Returns: logo, primary color

### Confidence Score

- Range: 0-100
- Based on: Number of successful layers + number of fields extracted
- Score < 50: Consider manual verification
- Score >= 75: Good confidence
- Score = 100: All data extracted successfully

### Example cURL

```bash
curl -X POST https://api.lionheartapp.com/api/onboarding/school-lookup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{"website": "https://springfield-elementary.edu"}'
```

---

## 2. Bulk Member Import Endpoint

Import multiple members into an organization with optional role and team assignments.

### Request

**Endpoint**: `POST /api/onboarding/import-members`

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
x-org-id: <organization_uuid>
```

**Body**:
```json
{
  "members": [
    {
      "name": "John Doe (required)",
      "email": "john@example.com (required)",
      "role": "admin (optional, role slug)",
      "team": "it-support (optional, team slug)"
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "teacher",
      "team": "teachers"
    }
  ]
}
```

**Constraints**:
- `members` array: min 1, max 500
- `name`: non-empty string
- `email`: valid email format
- `role`: must be existing role slug (optional)
- `team`: must be existing team slug (optional)

### Response

**Success (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "imported": 98,
    "members": [
      "john@example.com",
      "jane@example.com",
      "..."
    ],
    "errors": [
      {
        "email": "duplicate@example.com",
        "reason": "User already exists in this organization"
      },
      {
        "email": "invalid-role@example.com",
        "reason": "Role 'supervisor' not found"
      }
    ]
  }
}
```

**Errors**:
- `400 VALIDATION_ERROR`: Invalid request format
- `401 UNAUTHORIZED`: Missing or invalid authentication
- `403 FORBIDDEN`: Missing x-org-id header
- `404 NOT_FOUND`: Organization not found
- `500 INTERNAL_ERROR`: Server error during import

### Import Process

For each member:
1. Validate email uniqueness in organization
2. Create User record with status `PENDING`
3. Generate PasswordSetupToken (7-day expiry)
4. Assign to role if specified
5. Add to team if specified
6. Send welcome email with setup link

### Email Sent

Members receive a welcome email containing:
- Organization name
- Setup link (valid 7 days)
- Instructions to set password

### Available Roles

System roles (all organizations have these):
- `super-admin` - Full system access
- `admin` - Administrative access
- `member` - Standard member
- `viewer` - Read-only access

Custom roles can be created via Settings API.

### Available Teams

Default teams (all organizations have these):
- `it-support`
- `facility-maintenance`
- `av-production`
- `teachers`
- `administration`

Custom teams can be created via Settings API.

### Example cURL

```bash
curl -X POST https://api.lionheartapp.com/api/onboarding/import-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-org-id: 507f1f77bcf86cd799439011" \
  -d '{
    "members": [
      {
        "name": "John Doe",
        "email": "john@school.edu",
        "role": "admin",
        "team": "it-support"
      },
      {
        "name": "Jane Smith",
        "email": "jane@school.edu",
        "role": "teacher",
        "team": "teachers"
      }
    ]
  }'
```

---

## 3. Onboarding Finalization Endpoint

Complete the onboarding process: set theme, logo, create default infrastructure, and activate.

### Request

**Endpoint**: `POST /api/onboarding/finalize`

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
x-org-id: <organization_uuid>
```

**Body**:
```json
{
  "theme": {
    "primaryColor": "#1a73e8 (optional, hex color)",
    "secondaryColor": "#4285f4 (optional, hex color)",
    "accentColor": "#ea4335 (optional, hex color)"
  },
  "logoUrl": "https://storage.example.com/logo.png (optional, valid URL)"
}
```

**Constraints**:
- `theme.primaryColor`: Must match `#[0-9a-f]{6}` (case-insensitive)
- `theme.secondaryColor`: Must match `#[0-9a-f]{6}`
- `theme.accentColor`: Must match `#[0-9a-f]{6}`
- `logoUrl`: Must be valid HTTPS URL
- All fields optional (can finalize with empty body)

### Response

**Success (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "organization": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Springfield Elementary",
      "physicalAddress": "123 Main Street",
      "logoUrl": "https://storage.example.com/logo.png or null",
      "theme": "{\"primaryColor\":\"#1a73e8\",...} (JSON string)"
    },
    "status": "FINALIZED"
  }
}
```

**Errors**:
- `400 VALIDATION_ERROR`: Invalid color format or URL
- `401 UNAUTHORIZED`: Missing or invalid authentication
- `403 FORBIDDEN`: Missing x-org-id header
- `404 NOT_FOUND`: Organization not found
- `409 CONFLICT`: Organization already finalized
- `500 INTERNAL_ERROR`: Server error

### Finalization Process

1. **Validate** request and organization status
2. **Prevent re-finalization** (return 409 if already ACTIVE)
3. **Update organization**:
   - Set `onboardingStatus` to ACTIVE
   - Store theme colors as JSON
   - Set logoUrl
4. **Create default Building** (if address exists):
   - Name: "Main Campus"
   - Code: "MAIN"
5. **Create Free Trial subscription** (30 days):
   - Status: TRIALING
   - Expiry: 30 days from now
   - Plan: free-trial

### Theme Storage

Theme is stored as JSON in the `theme` field:
```json
{
  "primaryColor": "#1a73e8",
  "secondaryColor": "#4285f4",
  "accentColor": "#ea4335"
}
```

Retrieve and parse during theme application:
```typescript
const theme = JSON.parse(org.theme || '{}')
const primaryColor = theme.primaryColor // "#1a73e8"
```

### Example cURL

```bash
curl -X POST https://api.lionheartapp.com/api/onboarding/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-org-id: 507f1f77bcf86cd799439011" \
  -d '{
    "theme": {
      "primaryColor": "#1a73e8",
      "secondaryColor": "#4285f4",
      "accentColor": "#ea4335"
    },
    "logoUrl": "https://storage.example.com/logo.png"
  }'
```

---

## Authentication

### Bearer Token Format

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Token must be valid JWT with these claims:
```json
{
  "userId": "cuid",
  "organizationId": "cuid",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234567890 + (30 days in seconds)
}
```

### Obtaining a Token

1. **Sign up**: `POST /api/organizations/signup`
2. **Sign in**: `POST /api/auth/signin` (credentials, Google, or Azure)
3. Response includes `token` field

Example response:
```json
{
  "ok": true,
  "data": {
    "user": { /* user object */ },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Organization Context (x-org-id)

Member import and finalization require organization context via header.

```
x-org-id: 507f1f77bcf86cd799439011
```

**How to obtain**:
1. From JWT claims (`organizationId`)
2. From organization lookup by slug
3. From user's organization relationship

**Missing header** returns `403 Forbidden`:
```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Missing tenant context"
  }
}
```

---

## Rate Limiting

Recommended rate limits for production:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/school-lookup` | 100 | per minute |
| `/import-members` | 10 | per minute |
| `/finalize` | 5 | per minute |

Implement via middleware or reverse proxy (nginx, Cloudflare, etc.).

---

## Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Missing organization context |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Business logic conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Implementation Details

### School Lookup

**Brandfetch Layer**:
- Endpoint: `https://api.brandfetch.io/v2/brands/{domain}`
- Header: `Authorization: Bearer {BRANDFETCH_API_KEY}`
- Timeout: 5 seconds
- Fallback: Continue to next layer on failure

**Website Fetch Layer**:
- Method: GET with User-Agent header
- Timeout: 5 seconds
- User-Agent: Standard browser string (to avoid blocks)
- Max response: 5000 characters of text

**Gemini Layer**:
- Model: `gemini-1.5-flash`
- Prompt: Structured data extraction request
- Response parsing: Extracts JSON from response
- Fallback: Skip if no JSON found

### Member Import

**Database Operations**:
- All operations wrapped in `runWithOrgContext(orgId, ...)`
- Uses org-scoped `prisma` client
- Transactions not used (sequential operations)

**Email Service**:
- Uses `sendWelcomeEmail()` from `emailService`
- Includes setup link and 7-day expiry
- Failure doesn't block import (logged and continued)

**Token Generation**:
- Plain token: 64 random hex characters
- Hashed in DB: SHA256 of plain token
- Expiry: 7 days from creation
- Can only be used once (`usedAt` tracking)

### Finalization

**Atomic Update**: Uses `rawPrisma` for org-level updates (not org-scoped)

**Building Creation**:
- Only if `physicalAddress` exists
- Uses org-scoped `prisma` inside `runWithOrgContext`
- Ignores errors (building might already exist)

**Subscription Creation**:
- Looks up `free-trial` plan by slug
- Creates TRIALING subscription
- 30-day validity
- Idempotent (can be called again safely)

---

## Testing Checklist

- [ ] School lookup with various domain formats
- [ ] School lookup with no Brandfetch key
- [ ] School lookup with invalid website
- [ ] Member import with 500 members
- [ ] Member import with duplicate emails
- [ ] Member import with invalid role/team
- [ ] Finalize with all fields
- [ ] Finalize with no fields
- [ ] Finalize twice (should error 409)
- [ ] Missing authentication (should error 401)
- [ ] Missing x-org-id header (should error 403)
- [ ] Invalid color format (should error 400)
- [ ] Invalid email in import (should error in details)

---

## FAQ

**Q: Can I import members without role/team?**
A: Yes, both are optional. User will be created with no role/team assignment.

**Q: What if email already exists in organization?**
A: Import will skip with error message and continue with other members.

**Q: How long are setup links valid?**
A: 7 days from creation. Can be regenerated via Settings API.

**Q: Can I update theme after finalization?**
A: Yes, use the organization update endpoint (not finalize).

**Q: What happens if school lookup fails?**
A: Returns partial data with low confidence score. Proceed with manual entry.

**Q: Can I cancel a Free Trial subscription?**
A: Yes, use the subscription management endpoint (not part of this API).

**Q: What formats does school lookup accept?**
A: Full URLs, domain-only, URLs with paths. All automatically normalized.

**Q: Is file upload included?**
A: Use `storageService.uploadLogo()` separately before calling finalize.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial implementation |

---

## Support & Contact

For issues or questions:
1. Check the troubleshooting guide in `AUTH_INTEGRATION_GUIDE.md`
2. Review error messages and error codes
3. Check environment variables are configured
4. Enable debug logging: `DEBUG=lionheart:*`
5. Contact support via platform dashboard
