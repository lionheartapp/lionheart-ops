# Onboarding Backend API Specification

Backend API endpoints required for the onboarding flow. All endpoints should follow the existing pattern in `src/lib/api-response.ts` using `ok()` and `fail()` helpers.

## 1. POST /api/organizations/signup

Create a new organization with admin user.

**Request:**
```json
{
  "name": "Mitchell Academy",
  "website": "https://mitchell.edu",
  "slug": "mitchell-academy",
  "adminEmail": "principal@mitchell.edu",
  "adminName": "Sarah Mitchell",
  "adminPassword": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "organizationId": "uuid-here",
    "organizationName": "Mitchell Academy",
    "slug": "mitchell-academy",
    "admin": {
      "id": "user-uuid",
      "name": "Sarah Mitchell",
      "email": "principal@mitchell.edu",
      "token": "jwt-token-here"
    },
    "loginUrl": "https://mitchell-academy.lionheartapp.com/login"
  }
}
```

---

## 2. GET /api/organizations/current

Fetch current organization details (requires auth).

**Request:**
```
GET /api/organizations/current
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "org-uuid",
    "name": "Mitchell Academy",
    "slug": "mitchell-academy",
    "website": "https://mitchell.edu",
    "phone": "(555) 123-4567",
    "physicalAddress": "123 Main St, City, State",
    "district": "Springfield Public Schools",
    "gradeRange": "9-12",
    "studentCount": 500,
    "staffCount": 45,
    "principalName": "Sarah Mitchell",
    "principalEmail": "principal@mitchell.edu",
    "logoUrl": "https://cdn.example.com/logo.png",
    "primaryColor": "#2563eb"
  }
}
```

---

## 3. PATCH /api/organizations/update

Update organization information (requires auth).

**Request:**
```json
{
  "phone": "(555) 123-4567",
  "physicalAddress": "123 Main St, City, State",
  "district": "Springfield Public Schools",
  "gradeRange": "9-12",
  "principalName": "Sarah Mitchell",
  "principalEmail": "principal@mitchell.edu",
  "schoolType": "HIGH_SCHOOL",
  "studentCount": 500,
  "staffCount": 45,
  "logoUrl": "data:image/png;base64,...",
  "primaryColor": "#2563eb"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "org-uuid",
    "name": "Mitchell Academy",
    "updated": true
  }
}
```

---

## 4. POST /api/onboarding/school-lookup

Lookup school information by website (optional, public endpoint).

**Request:**
```json
{
  "website": "https://mitchell.edu"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "name": "Mitchell Academy",
    "logo": "https://mitchell.edu/logo.png",
    "primaryColor": "#1e40af",
    "phone": "(541) 890-1000",
    "address": "123 Main St, Springfield, OR 97477",
    "district": "Springfield Public Schools",
    "gradeRange": "9-12"
  }
}
```

---

## 5. POST /api/onboarding/import-members

Bulk invite team members (requires auth).

**Request:**
```json
{
  "members": [
    {
      "name": "John Smith",
      "email": "john@mitchell.edu"
    },
    {
      "name": "Jane Doe",
      "email": "jane@mitchell.edu"
    }
  ]
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "imported": 2,
    "failed": 0,
    "errors": []
  }
}
```

---

## 6. POST /api/onboarding/finalize

Complete onboarding setup (requires auth).

**Request:**
```json
{
  "schoolData": "{\"logo\":\"...\",\"primaryColor\":\"#2563eb\"}",
  "memberCount": 2
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "status": "complete",
    "organizationId": "org-uuid",
    "teamMembersInvited": 2
  }
}
```

---

## Error Response Format

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Input validation failed (400)
- `CONFLICT` - Resource already exists (409)
- `NOT_FOUND` - Resource not found (404)
- `UNAUTHORIZED` - Missing auth (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `INTERNAL_ERROR` - Server error (500)

---

## Authentication

All endpoints except `/api/organizations/signup` and `/api/onboarding/school-lookup` require JWT:

**Header:** `Authorization: Bearer {jwt-token}`

---

## Implementation Notes

**Already Exists:**
- `POST /api/organizations/signup` - Uses `organizationRegistrationService`

**Need to Implement:**
- `GET /api/organizations/current` - Fetch org by organizationId from JWT
- `PATCH /api/organizations/update` - Update org fields (org-scoped)
- `POST /api/onboarding/school-lookup` - Optional: web scraping or data service
- `POST /api/onboarding/import-members` - Create users + send emails
- `POST /api/onboarding/finalize` - Mark setup complete + analytics

---

## Quick Example

```typescript
// src/app/api/onboarding/import-members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    const { members } = await req.json()

    if (!Array.isArray(members)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Members array required'),
        { status: 400 }
      )
    }

    // TODO: Create users, send emails, return count

    return NextResponse.json(
      ok({ imported: members.length, failed: 0, errors: [] }),
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to import members'),
      { status: 500 }
    )
  }
}
```

---

For full details on API response patterns, see existing routes in `src/app/api/`.
