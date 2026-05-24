# Onboarding Backend API Specification

Backend API endpoints required for the onboarding flow. All endpoints should follow the existing pattern in `src/lib/api-response.ts` using `ok()` and `fail()` helpers.

> Current hierarchy note: onboarding now captures organization, primary school, and primary campus separately. Use `/api/onboarding/school-info` for the structure step; older references to `/api/organizations/current` and `/api/organizations/update` are historical.

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

## 2. GET /api/onboarding/school-info

Fetch current organization, primary school, and primary campus details (requires auth).

**Request:**
```
GET /api/onboarding/school-info
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "org-uuid",
    "name": "Mitchell Academy",
    "schoolName": "Mitchell Academy Upper School",
    "campusName": "Main Campus",
    "campusAddress": "123 Main St, City, State",
    "campusKind": "HEADQUARTERS",
    "campusGradeLevel": "HIGH_SCHOOL",
    "slug": "mitchell-academy",
    "website": "https://mitchell.edu",
    "phone": "(555) 123-4567",
    "district": "Springfield Public Schools",
    "studentCount": 500,
    "staffCount": 45,
    "principalName": "Sarah Mitchell",
    "principalEmail": "principal@mitchell.edu",
    "principalPhone": "(555) 123-4568",
    "logoUrl": "https://cdn.example.com/logo.png",
    "schoolColor": "#2563eb"
  }
}
```

---

## 3. PATCH /api/onboarding/school-info

Update onboarding structure information (requires auth).

**Request:**
```json
{
  "schoolName": "Mitchell Academy Upper School",
  "campusName": "Main Campus",
  "campusAddress": "123 Main St, City, State",
  "campusKind": "HEADQUARTERS",
  "campusGradeLevel": "HIGH_SCHOOL",
  "phone": "(555) 123-4567",
  "district": "Springfield Public Schools",
  "principalName": "Sarah Mitchell",
  "principalEmail": "principal@mitchell.edu",
  "principalPhone": "(555) 123-4568",
  "institutionType": "PRIVATE",
  "studentCount": 500,
  "staffCount": 45
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "org-uuid",
    "name": "Mitchell Academy",
    "slug": "mitchell-academy"
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
    "institutionType": "PRIVATE"
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
- `GET /api/onboarding/school-info` - Fetches org, primary school, primary campus
- `PATCH /api/onboarding/school-info` - Saves structure, contacts, counts, campus

**Need to Implement:**
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
