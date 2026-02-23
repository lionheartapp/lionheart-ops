import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'mkerley@linfield.com';
  const orgId = 'cmly7nsqt0000cdtmpyswsrlj';
  const testPassword = 'test123';

  console.log('🔍 Checking user in database...\n');

  // Check organization
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    console.log('❌ Organization not found with ID:', orgId);
    console.log('\n📋 Available organizations:');
    const orgs = await prisma.organization.findMany();
    orgs.forEach(o => console.log(`  - ${o.name} (${o.slug}): ${o.id}`));
    return;
  }

  console.log('✅ Organization found:', org.name, '(' + org.slug + ')');
  console.log('   ID:', org.id);

  // Check user with exact match
  const user = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      email: email,
    },
  });

  if (!user) {
    console.log('\n❌ User not found with exact match');
    console.log('\n📋 All users in database:');
    const allUsers = await prisma.user.findMany();
    allUsers.forEach(u => {
      console.log(`  - Email: ${u.email}`);
      console.log(`    OrgId: ${u.organizationId}`);
      console.log(`    Name: ${u.name || 'no name'}`);
      console.log(`    Match: email=${u.email === email}, org=${u.organizationId === orgId}`);
      console.log('');
    });
    return;
  }

  console.log('\n✅ User found:', user.email);
  console.log('   Name:', user.name);
  console.log('   Role:', user.role);
  console.log('   ID:', user.id);
  console.log('   OrgID:', user.organizationId);

  // Test password
  const match = await bcrypt.compare(testPassword, user.passwordHash);
  console.log('\n🔑 Password verification:', match ? '✅ MATCH' : '❌ NO MATCH');

  // Test with AND clause
  console.log('\n🔍 Testing with AND clause (like org-scoped query)...');
  const andUser = await prisma.user.findFirst({
    where: {
      AND: [
        { email: email },
        { organizationId: orgId }
      ]
    }
  });
  console.log('   Result:', andUser ? '✅ FOUND' : '❌ NOT FOUND');

  if (match && andUser) {
    console.log('\n✅ All credentials are correct!');
    console.log('\n🎯 If login is still failing, check:');
    console.log('   1. Network/CORS issues');
    console.log('   2. Middleware blocking the request');
    console.log('   3. Different database in production vs local');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
