import dotenv from 'dotenv';

// When DATABASE_URL is already set (e.g. by `npm run db:seed:remote` with dotenv -e .env), don't load .env.local so we target that DB.
// Otherwise prefer .env.local then .env for local development.
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' });
}
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Parse a permission string like "tickets:read:all" into { resource, action, scope }.
 * Scope defaults to "global" when not present in the string.
 */
function parsePermission(perm: string): { resource: string; action: string; scope: string } {
  const parts = perm.split(':')
  return {
    resource: parts[0],
    action: parts[1],
    scope: parts[2] || 'global',
  }
}

// ── Role definitions ─────────────────────────────────────────────────────
// Mirrors DEFAULT_ROLES from src/lib/permissions.ts.
// We inline the permission strings here so the seed script has zero dependency
// on Next.js path aliases (@/lib/…) which are unavailable at `tsx prisma/seed.ts`.

const ROLE_DEFINITIONS: Record<string, {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}> = {
  SUPER_ADMIN: {
    slug: 'super-admin',
    name: 'Super Admin',
    description: 'Full system access including billing and user management',
    permissions: ['*:*'],
    isSystem: true,
  },
  ADMIN: {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full operational access, can manage users and approve events',
    permissions: [
      // Tickets
      'tickets:create', 'tickets:read:all', 'tickets:update:all', 'tickets:delete', 'tickets:assign',
      // Events
      'events:create', 'events:read', 'events:update:all', 'events:delete', 'events:approve',
      // Inventory
      'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
      'inventory:checkout', 'inventory:checkin',
      // Settings
      'settings:read', 'settings:update', 'settings:billing',
      // Users
      'users:read', 'users:invite', 'users:update', 'users:manage:roles', 'users:manage:permissions',
      // Roles & Teams
      'roles:read', 'roles:create', 'teams:read', 'teams:create', 'teams:update', 'teams:delete',
      // Calendar
      'calendars:create', 'calendars:read', 'calendars:update', 'calendars:delete', 'calendars:share',
      'calendar-events:create', 'calendar-events:read', 'calendar-events:update:all',
      'calendar-events:delete:all', 'calendar-events:approve', 'calendar-events:publish',
      // Academic
      'academic:manage', 'academic:bell-schedules', 'academic:special-days', 'academic:read',
      // Planning
      'planning:manage', 'planning:submit', 'planning:review', 'planning:view', 'planning:comment',
      // Resource Requests
      'resource-requests:create', 'resource-requests:read:all', 'resource-requests:respond', 'resource-requests:manage',
      // Athletics
      'athletics:manage', 'athletics:games:create', 'athletics:games:approve', 'athletics:games:score', 'athletics:read',
      // Maintenance
      'maintenance:submit', 'maintenance:read:all', 'maintenance:update:all', 'maintenance:assign',
      'maintenance:approve:qa', 'maintenance:cancel', 'maintenance:assets:manage', 'maintenance:pm:manage',
      'maintenance:analytics:view', 'maintenance:technicians:manage',
      // Assets
      'assets:read', 'assets:create', 'assets:update', 'assets:delete',
      // Compliance
      'compliance:read', 'compliance:manage', 'compliance:export',
      // Knowledge Base
      'knowledge-base:read', 'knowledge-base:create', 'knowledge-base:update', 'knowledge-base:delete',
      // IT Help Desk
      'it:ticket:submit', 'it:ticket:read:all', 'it:ticket:update:status', 'it:ticket:assign',
      'it:ticket:comment:internal', 'it:ticket:comment:submitter', 'it:magiclink:generate',
      // MDM + Roster
      'it:device:read', 'it:device:create', 'it:device:update', 'it:device:delete',
      'it:device:assign', 'it:device:sync', 'it:device:intelligence', 'it:device:configure',
      'students:read', 'students:read:own-school', 'students:manage', 'students:audit',
      'it:loaner:checkout', 'it:loaner:checkin', 'it:loaner:manage',
      'it:roster:sync', 'it:roster:configure',
      // Device Lifecycle
      'it:deployment:manage', 'it:deployment:process', 'it:summer:manage', 'it:repair-queue:manage',
      'it:damage:assess', 'it:damage:export', 'it:mdm:configure', 'it:mdm:sync',
      'it:student:password', 'it:ai:diagnostic',
      // Account Provisioning
      'it:provisioning:manage', 'it:provisioning:view', 'it:qr:generate',
      // IT Analytics & Reports
      'it:analytics:read', 'it:reports:board',
      // E-Rate + Content Filter
      'it:erate:manage', 'it:erate:view', 'it:cipa:audit:view', 'it:cipa:audit:manage',
      'it:filters:configure', 'it:filters:manage',
      // Security Incidents
      'it:incident:read', 'it:incident:create', 'it:incident:manage',
      // Event Projects
      'events:project:create', 'events:project:read', 'events:project:update:own',
      'events:project:update:all', 'events:project:delete', 'events:project:approve', 'events:series:manage',
      // Registration
      'events:medical:read', 'events:registration:manage',
      // Documents, Groups, Communication, Day-of
      'events:documents:manage', 'events:compliance:manage', 'events:groups:manage',
      'events:checkin:manage', 'events:announcements:manage', 'events:incidents:manage', 'events:surveys:manage',
      // Templates, Notifications, Budget, Integrations
      'events:templates:manage', 'events:notifications:manage',
      'events:budget:manage', 'events:budget:read',
      'integrations:manage', 'integrations:google-calendar',
    ],
    isSystem: true,
  },
  MEMBER: {
    slug: 'member',
    name: 'Member',
    description: 'Standard user with ability to create and manage own tickets',
    permissions: [
      'tickets:create', 'tickets:read:own', 'tickets:update:own',
      'events:read', 'settings:read',
      'calendars:read', 'calendar-events:create:own-calendar', 'calendar-events:read',
      'calendar-events:update:own', 'calendar-events:delete:own',
      'academic:read',
      'planning:submit', 'planning:view', 'planning:comment',
      'resource-requests:create', 'resource-requests:read:own',
      'athletics:read',
      'maintenance:submit', 'maintenance:read:own', 'maintenance:update:own',
      'assets:read', 'compliance:read', 'knowledge-base:read',
      'it:ticket:submit', 'it:ticket:read:own', 'it:ticket:comment:submitter',
      'it:device:read',
      'events:project:create', 'events:project:read', 'events:project:update:own',
      'events:documents:manage', 'events:groups:manage', 'events:checkin:manage',
      'events:announcements:manage', 'events:incidents:manage',
      'events:templates:manage', 'events:budget:read',
      'integrations:google-calendar',
    ],
    isSystem: true,
  },
  VIEWER: {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'tickets:read:own', 'events:read',
      'calendars:read', 'calendar-events:read', 'academic:read', 'athletics:read',
      'maintenance:read:own', 'assets:read', 'knowledge-base:read',
      'it:ticket:read:own', 'it:device:read',
    ],
    isSystem: true,
  },
}

// ── Team definitions ─────────────────────────────────────────────────────
const TEAM_DEFINITIONS = [
  { slug: 'it-support', name: 'IT Support', description: 'Technical infrastructure, hardware, and software support' },
  { slug: 'maintenance', name: 'Facility Maintenance', description: 'Physical campus upkeep and repairs' },
  { slug: 'av-production', name: 'A/V Production', description: 'Audio/visual equipment and event support' },
  { slug: 'security', name: 'Security', description: 'Campus security and access control' },
  { slug: 'administration', name: 'Administration', description: 'School administration and office staff' },
]

// ── Standard modules every demo org should have enabled ──────────────────
const DEFAULT_MODULES = [
  'athletics',
  'maintenance',
  'it-helpdesk',
  'planning-season',
  'calendar',
]

/**
 * Collect every unique permission string from all role definitions,
 * then upsert each into the Permission table.
 */
async function seedPermissions() {
  console.log('Seeding permissions...');

  const allPermStrings = new Set<string>()
  for (const roleDef of Object.values(ROLE_DEFINITIONS)) {
    for (const p of roleDef.permissions) {
      allPermStrings.add(p)
    }
  }

  let count = 0
  for (const permStr of allPermStrings) {
    const { resource, action, scope } = parsePermission(permStr)
    await prisma.permission.upsert({
      where: { resource_action_scope: { resource, action, scope } },
      update: {},
      create: { resource, action, scope, description: `${resource}:${action}${scope !== 'global' ? ':' + scope : ''}` },
    })
    count++
  }

  console.log(`  ${count} permissions upserted`);
}

/**
 * Seed all role definitions with their full permission sets.
 * Returns a map of slug -> Role record.
 */
async function seedRolesAndPermissions(organizationId: string) {
  console.log('Seeding roles...');

  const allPermissions = await prisma.permission.findMany()
  const roleMap: Record<string, { id: string; slug: string }> = {}

  for (const [, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { organizationId_slug: { organizationId, slug: roleDef.slug } },
      update: {},
      create: {
        organizationId,
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    })

    // Link all permissions for this role
    for (const permStr of roleDef.permissions) {
      const { resource, action, scope } = parsePermission(permStr)
      const perm = allPermissions.find(
        (p) => p.resource === resource && p.action === action && p.scope === scope
      )
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        })
      }
    }

    roleMap[roleDef.slug] = role
  }

  console.log(`  ${Object.keys(ROLE_DEFINITIONS).length} roles created with permissions`);
  return roleMap
}

async function seedTeams(organizationId: string) {
  console.log('Seeding teams...');

  for (const team of TEAM_DEFINITIONS) {
    await prisma.team.upsert({
      where: { organizationId_slug: { organizationId, slug: team.slug } },
      update: {},
      create: { organizationId, ...team },
    })
  }

  console.log(`  ${TEAM_DEFINITIONS.length} teams created`);
}

async function seedModules(organizationId: string) {
  console.log('Seeding modules...');

  for (const moduleId of DEFAULT_MODULES) {
    // campusId is null for org-wide modules. Prisma can't upsert on nullable unique fields,
    // so check for existence first.
    const existing = await prisma.tenantModule.findFirst({
      where: { organizationId, moduleId, campusId: null },
    })
    if (!existing) {
      await prisma.tenantModule.create({
        data: { organizationId, moduleId },
      })
    }
  }

  console.log(`  ${DEFAULT_MODULES.length} modules enabled`);
}

async function main() {
  console.log('Seeding database...\n');

  // 1. Seed global permissions
  await seedPermissions();

  // 2. Create test organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {
      logoUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=200',
      heroImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2000',
      imagePosition: 'LEFT',
    },
    create: {
      name: 'Demo Academy',
      slug: 'demo',
      logoUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=200',
      heroImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2000',
      imagePosition: 'LEFT',
    },
  });
  console.log('Organization created:', org.slug);

  // 3. Seed roles with full permission sets
  const roleMap = await seedRolesAndPermissions(org.id);

  // 4. Seed teams
  await seedTeams(org.id);

  // 5. Seed modules (so sidebar shows all features)
  await seedModules(org.id);

  // 6. Create test users (emailVerified: true so login works immediately)
  const passwordHash = await bcrypt.hash('test123', 10);

  const adminUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'admin@demo.com' } },
    update: {
      roleId: roleMap['super-admin'].id,
      status: 'ACTIVE',
      schoolScope: 'GLOBAL',
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
    },
    create: {
      organizationId: org.id,
      email: 'admin@demo.com',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      roleId: roleMap['super-admin'].id,
      status: 'ACTIVE',
      schoolScope: 'GLOBAL',
      employmentType: 'FULL_TIME',
      jobTitle: 'Administrator',
      emailVerified: true,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'teacher@demo.com' } },
    update: {
      roleId: roleMap['member'].id,
      status: 'ACTIVE',
      schoolScope: 'HIGH_SCHOOL',
      firstName: 'Test',
      lastName: 'Teacher',
      emailVerified: true,
    },
    create: {
      organizationId: org.id,
      email: 'teacher@demo.com',
      name: 'Test Teacher',
      firstName: 'Test',
      lastName: 'Teacher',
      passwordHash,
      roleId: roleMap['member'].id,
      status: 'ACTIVE',
      schoolScope: 'HIGH_SCHOOL',
      employmentType: 'FULL_TIME',
      jobTitle: 'Teacher',
      emailVerified: true,
    },
  });

  console.log('Users created:', adminUser.email, teacherUser.email);

  console.log('\nSeed complete! Test credentials:');
  console.log('\nAdmin (Super Admin):');
  console.log('  Email: admin@demo.com');
  console.log('  Password: test123');
  console.log('\nTeacher (Member):');
  console.log('  Email: teacher@demo.com');
  console.log('  Password: test123');
  console.log(`\nOrganization ID: ${org.id}`);
  console.log(`Login at: https://demo.lionheartapp.com/login\n`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
