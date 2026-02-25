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

  // Check user
  const user = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      email: email,
    },
  });

  if (!user) {
    console.log('\n❌ User not found');
    console.log('\n📋 Users in this org:');
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
    });
    if (users.length === 0) {
      console.log('   (no users found)');
    } else {
      users.forEach(u => console.log(`  - ${u.email} (${u.name || 'no name'})`));
    }
    return;
  }

  console.log('\n✅ User found:', user.email);
  console.log('   Name:', user.name);
  console.log('   Role:', user.role);
  console.log('   ID:', user.id);

  // Test password
  const match = await bcrypt.compare(testPassword, user.passwordHash);
  console.log('\n🔑 Password verification:', match ? '✅ MATCH' : '❌ NO MATCH');

  if (match) {
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
