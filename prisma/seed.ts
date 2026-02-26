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

// Permission definitions
const PERMISSIONS = [
  // Tickets
  { resource: 'tickets', action: 'create', scope: 'global', description: 'Create tickets' },
  { resource: 'tickets', action: 'read', scope: 'own', description: 'Read own tickets' },
  { resource: 'tickets', action: 'read', scope: 'team', description: 'Read team tickets' },
  { resource: 'tickets', action: 'read', scope: 'all', description: 'Read all tickets' },
  { resource: 'tickets', action: 'update', scope: 'own', description: 'Update own tickets' },
  { resource: 'tickets', action: 'update', scope: 'team', description: 'Update team tickets' },
  { resource: 'tickets', action: 'update', scope: 'all', description: 'Update all tickets' },
  { resource: 'tickets', action: 'delete', scope: 'global', description: 'Delete tickets' },
  { resource: 'tickets', action: 'assign', scope: 'global', description: 'Assign tickets' },
  
  // Events
  { resource: 'events', action: 'create', scope: 'global', description: 'Create events' },
  { resource: 'events', action: 'read', scope: 'global', description: 'Read events' },
  { resource: 'events', action: 'update', scope: 'own', description: 'Update own events' },
  { resource: 'events', action: 'update', scope: 'all', description: 'Update all events' },
  { resource: 'events', action: 'delete', scope: 'global', description: 'Delete events' },
  { resource: 'events', action: 'approve', scope: 'global', description: 'Approve events' },
  
  // Inventory
  { resource: 'inventory', action: 'read', scope: 'global', description: 'Read inventory' },
  { resource: 'inventory', action: 'create', scope: 'global', description: 'Create inventory items' },
  { resource: 'inventory', action: 'update', scope: 'global', description: 'Update inventory' },
  { resource: 'inventory', action: 'delete', scope: 'global', description: 'Delete inventory items' },
  
  // Settings
  { resource: 'settings', action: 'read', scope: 'global', description: 'Read settings' },
  { resource: 'settings', action: 'update', scope: 'global', description: 'Update settings' },
  { resource: 'settings', action: 'billing', scope: 'global', description: 'Manage billing' },
  
  // Users
  { resource: 'users', action: 'read', scope: 'global', description: 'Read user list' },
  { resource: 'users', action: 'invite', scope: 'global', description: 'Invite users' },
  { resource: 'users', action: 'update', scope: 'global', description: 'Update users' },
  { resource: 'users', action: 'delete', scope: 'global', description: 'Delete users' },
  { resource: 'users', action: 'manage', scope: 'roles', description: 'Manage user roles' },
  
  // Roles & Teams
  { resource: 'roles', action: 'read', scope: 'global', description: 'Read roles' },
  { resource: 'roles', action: 'create', scope: 'global', description: 'Create roles' },
  { resource: 'roles', action: 'update', scope: 'global', description: 'Update roles' },
  { resource: 'roles', action: 'delete', scope: 'global', description: 'Delete roles' },
  { resource: 'teams', action: 'read', scope: 'global', description: 'Read teams' },
  { resource: 'teams', action: 'create', scope: 'global', description: 'Create teams' },
  { resource: 'teams', action: 'update', scope: 'global', description: 'Update teams' },
  { resource: 'teams', action: 'delete', scope: 'global', description: 'Delete teams' },
  
  // Wildcard
  { resource: '*', action: '*', scope: 'global', description: 'All permissions (Super Admin)' },
];

async function seedPermissions() {
  console.log('📋 Seeding permissions...');
  
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        resource_action_scope: {
          resource: perm.resource,
          action: perm.action,
          scope: perm.scope,
        },
      },
      update: { description: perm.description },
      create: perm,
    });
  }
  
  console.log(`✅ ${PERMISSIONS.length} permissions created`);
}

async function seedRolesAndPermissions(organizationId: string) {
  console.log('👥 Seeding roles...');
  
  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const wildcard = allPermissions.find(
    (p) => p.resource === '*' && p.action === '*' && p.scope === 'global'
  );
  
  // Super Admin - has wildcard permission
  const superAdmin = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: 'super-admin',
      },
    },
    update: {},
    create: {
      organizationId,
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full system access including billing and user management',
      isSystem: true,
    },
  });
  
  if (wildcard) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdmin.id,
          permissionId: wildcard.id,
        },
      },
      update: {},
      create: {
        roleId: superAdmin.id,
        permissionId: wildcard.id,
      },
    });
  }
  
  // Admin - most permissions except billing
  const adminPermissionSlugs = [
    'tickets:create', 'tickets:read:all', 'tickets:update:all', 'tickets:delete', 'tickets:assign',
    'events:create', 'events:read', 'events:update:all', 'events:delete', 'events:approve',
    'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
    'settings:read', 'settings:update',
    'users:read', 'users:invite', 'users:update', 'users:manage:roles',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'teams:read', 'teams:create', 'teams:update', 'teams:delete',
  ];
  
  const admin = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: 'admin',
      },
    },
    update: {},
    create: {
      organizationId,
      name: 'Administrator',
      slug: 'admin',
      description: 'Full operational access, can manage users and approve events',
      isSystem: true,
    },
  });
  
  for (const slug of adminPermissionSlugs) {
    const [resource, action, scope] = slug.split(':');
    const permission = allPermissions.find(
      (p) => p.resource === resource && p.action === action && p.scope === (scope || 'global')
    );
    
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: admin.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: admin.id,
          permissionId: permission.id,
        },
      });
    }
  }
  
  // Member - basic permissions
  const memberPermissionSlugs = [
    'tickets:create', 'tickets:read:own', 'tickets:update:own',
    'events:read',
    'inventory:read',
    'settings:read',
  ];
  
  const member = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: 'member',
      },
    },
    update: {},
    create: {
      organizationId,
      name: 'Member',
      slug: 'member',
      description: 'Standard user with ability to create and manage own tickets',
      isSystem: true,
    },
  });
  
  for (const slug of memberPermissionSlugs) {
    const [resource, action, scope] = slug.split(':');
    const permission = allPermissions.find(
      (p) => p.resource === resource && p.action === action && p.scope === (scope || 'global')
    );
    
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: member.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: member.id,
          permissionId: permission.id,
        },
      });
    }
  }
  
  // Viewer - read-only
  const viewerPermissionSlugs = [
    'tickets:read:own',
    'events:read',
    'inventory:read',
  ];
  
  const viewer = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: 'viewer',
      },
    },
    update: {},
    create: {
      organizationId,
      name: 'Viewer',
      slug: 'viewer',
      description: 'Read-only access',
      isSystem: true,
    },
  });
  
  for (const slug of viewerPermissionSlugs) {
    const [resource, action, scope] = slug.split(':');
    const permission = allPermissions.find(
      (p) => p.resource === resource && p.action === action && p.scope === (scope || 'global')
    );
    
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: viewer.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: viewer.id,
          permissionId: permission.id,
        },
      });
    }
  }
  
  console.log('✅ 4 system roles created with permissions');
  
  return { superAdmin, admin, member, viewer };
}

async function seedTeams(organizationId: string) {
  console.log('🏢 Seeding teams...');
  
  const teams = [
    {
      slug: 'it-support',
      name: 'IT Support',
      description: 'Technical infrastructure, hardware, and software support',
    },
    {
      slug: 'maintenance',
      name: 'Facility Maintenance',
      description: 'Physical campus upkeep and repairs',
    },
    {
      slug: 'av-production',
      name: 'A/V Production',
      description: 'Audio/visual equipment and event support',
    },
    {
      slug: 'teachers',
      name: 'Teachers',
      description: 'Teaching staff',
    },
    {
      slug: 'administration',
      name: 'Administration',
      description: 'School administration and office staff',
    },
  ];
  
  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        organizationId_slug: {
          organizationId,
          slug: team.slug,
        },
      },
      update: {},
      create: {
        organizationId,
        ...team,
      },
    });
  }
  
  console.log(`✅ ${teams.length} teams created`);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Seed global permissions first
  await seedPermissions();

  // Create test organization with branding
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

  console.log('✅ Organization created:', org.slug);

  // Seed roles and permissions
  const roles = await seedRolesAndPermissions(org.id);
  
  // Seed teams
  await seedTeams(org.id);

  // Create test users
  const passwordHash = await bcrypt.hash('test123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'admin@demo.com',
      },
    },
    update: {
      roleId: roles.admin.id,
      status: 'ACTIVE',
      schoolScope: 'GLOBAL',
      firstName: 'Admin',
      lastName: 'User',
    },
    create: {
      organizationId: org.id,
      email: 'admin@demo.com',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      roleId: roles.admin.id,
      status: 'ACTIVE',
      schoolScope: 'GLOBAL',
      employmentType: 'FULL_TIME',
      jobTitle: 'Administrator',
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'teacher@demo.com',
      },
    },
    update: {
      roleId: roles.member.id,
      status: 'ACTIVE',
      schoolScope: 'HIGH_SCHOOL',
      firstName: 'Test',
      lastName: 'Teacher',
    },
    create: {
      organizationId: org.id,
      email: 'teacher@demo.com',
      name: 'Test Teacher',
      firstName: 'Test',
      lastName: 'Teacher',
      passwordHash,
      roleId: roles.member.id,
      status: 'ACTIVE',
      schoolScope: 'HIGH_SCHOOL',
      employmentType: 'FULL_TIME',
      jobTitle: 'Teacher',
    },
  });

  console.log('✅ Users created:', adminUser.email, teacherUser.email);

  console.log('\n🎉 Seed complete! Test credentials:');
  console.log('\n📊 Admin:');
  console.log('  📧 Email: admin@demo.com');
  console.log('  🔑 Password: test123');
  console.log('  👤 Role: Administrator');
  console.log('\n👨‍🏫 Teacher:');
  console.log('  📧 Email: teacher@demo.com');
  console.log('  🔑 Password: test123');
  console.log('  👤 Role: Member (Teachers team)');
  console.log(`\n🏢 Organization ID: ${org.id}`);
  console.log(`🔗 Login at: https://demo.lionheartapp.com/login\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
