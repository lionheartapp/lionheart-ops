# Permission System Implementation - Phase 2 Complete

## ✅ Completed This Session

### 1. Legacy User Migration Script
**Location:** `scripts/migrate-legacy-users.ts`

Maps existing users from old `UserRole` enum to new permission system:
- `SUPER_ADMIN` → `super-admin` role + `administration` team
- `ADMIN` → `admin` role + `administration` team
- `OPERATIONS` → `admin` role + `it-support`, `maintenance` teams
- `TEACHER` → `member` role + `teachers` team
- `VIEWER` → `viewer` role (no teams)

**Run once to migrate existing users:**
```bash
npx tsx scripts/migrate-legacy-users.ts
```

### 2. Service Layer Updated

#### Ticket Service (`src/lib/services/ticketService.ts`)
- **Remove**: `UserRole` parameter from all functions
- **Before**: `listTickets(input, userId, userRole)`
- **After**: `listTickets(input, userId)`
- **Permissions Used**:
  - `TICKETS_CREATE` - Create tickets
  - `TICKETS_READ_ALL` - View all tickets (vs assigned only)
  - `TICKETS_UPDATE_ALL` - Update any ticket
  - `TICKETS_UPDATE_OWN` - Update status on assigned tickets
  - `TICKETS_ASSIGN` - Assign tickets to users
  - `TICKETS_DELETE` - Delete tickets

#### Event Service (`src/lib/services/eventService.ts`)
- **Remove**: `UserRole` parameter from all functions
- **Before**: `createEvent(input, userId, userRole)`
- **After**: `createEvent(input, userId)`
- **Permissions Used**:
  - `EVENTS_READ` - View events
  - `EVENTS_CREATE` - Create events
  - `EVENTS_UPDATE_OWN` - Update events (basic level)
  - `EVENTS_APPROVE` - Cancel events (admin action)
  - `EVENTS_DELETE` - Permanently delete events

#### Draft Event Service (`src/lib/services/draftEventService.ts`)
- **Remove**: `UserRole` parameter from all functions
- **Before**: `listDraftEvents(input, userId, userRole)`
- **After**: `listDraftEvents(input, userId)`
- **Permissions Used**:
  - `EVENTS_CREATE` - Create/read/update own drafts
  - `EVENTS_APPROVE` - View/update all drafts + submit to confirmed events

### 3. API Routes Updated

#### `/api/tickets/route.ts`
- `GET`: Pass `userId` only (not `userRole`)
- `POST`: Pass `userId` only

#### `/api/events/route.ts`
- `GET`: Pass `userId` only
- `POST`: Pass `userId` only

#### `/api/draft-events/route.ts`
- `GET`: Pass `userId` only
- `POST`: Pass `userId` only

## Permission Examples

### Checking Permissions in Service Layer
```typescript
import { assertCan, can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// Throw error if denied
await assertCan(userId, PERMISSIONS.TICKETS_CREATE)

// Return boolean
const canReadAll = await can(userId, PERMISSIONS.TICKETS_READ_ALL)
if (!canReadAll) {
  // Filter to only assigned tickets
  where.assignedToId = userId
}
```

### Permission Caching
- Permissions are cached for 30 seconds in-memory per user
- No database hit for repeated permission checks within 30s
- Cache automatically invalidates after 30s

## Next Steps

### Phase 3: Test & Verify (Recommended Next)
1. Run the legacy migration script
2. Start dev server: `npm run dev`
3. Test permission checks:
   - Login as admin@demo.com (admin role) - should have full access
   - Login as teacher@demo.com (member role) - should have limited access
   - Verify permission errors return 403 status

### Phase 4: Settings UI (Future)
- `/settings/roles` - Manage roles and assign permissions
- `/settings/teams` - Manage teams and assign users
- `/settings/users` - Update roleId and teamIds when inviting users

### Phase 5: Documentation & Cleanup (Future)
- Add inline comments for complex permission logic
- Document permission system in main README
- Consider deprecation plan for old `role` enum field

## Database Schema Reminder

```prisma
model User {
  id         String   @id @default(uuid())
  role       UserRole @default(VIEWER)  // OLD - kept for backward compatibility
  roleId     String?  // NEW - FK to Role.id
  teamIds    String[] @default([])     // NEW - team slugs
  userRole   Role?    @relation(fields: [roleId], references: [id])
}

model Role {
  id              String            @id @default(uuid())
  organizationId  String
  name            String            // "Admin", "Member", etc.
  slug            String            // "admin", "member", etc.
  isSystem        Boolean @default(false)
  permissions     RolePermission[]
  users           User[]
  @@unique([organizationId, slug])
}

model Permission {
  resource    String                // "tickets", "events", etc.
  action      String                // "create", "read", "delete", etc.
  scope       String @default("global")  // "global", "own", "team", "all"
  description String?
  roles       RolePermission[]
  @@unique([resource, action, scope])
}
```

## Permission String Format
`{resource}:{action}` or `{resource}:{action}:{scope}`

Examples:
- `tickets:create` (global scope implied)
- `tickets:read:all` (explicit scope)
- `tickets:update:own` (own items only)
- `*:*` (wildcard - super admin)

## Current Permission Assignments

### super-admin role (1 permission)
- `*:*` - Full wildcard access

### admin role (23 permissions)
Full operational permissions across tickets, events, inventory, settings

### member role (6 permissions)
- `tickets:read:own`, `tickets:update:own`
- `events:read`, `events:create`, `events:update:own`
- `inventory:read`

### viewer role (3 permissions)
- `tickets:read:own`
- `events:read`
- `inventory:read`

## Files Modified

### Services
- ✅ `src/lib/services/ticketService.ts`
- ✅ `src/lib/services/eventService.ts`
- ✅ `src/lib/services/draftEventService.ts`

### API Routes
- ✅ `src/app/api/tickets/route.ts`
- ✅ `src/app/api/events/route.ts`
- ✅ `src/app/api/draft-events/route.ts`

### Scripts
- ✅ `scripts/migrate-legacy-users.ts` (NEW)

## TypeScript Status
✅ **0 errors** - All services and routes are type-safe

## Demo Credentials
- **Admin**: admin@demo.com / test123 (admin role)
- **Member**: teacher@demo.com / test123 (member role)
