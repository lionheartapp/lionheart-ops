#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPermissions() {
  try {
    console.log('🔍 Checking admin role permissions...\n')
    
    const org = await prisma.organization.findFirst({
      where: { slug: 'demo' },
      select: { id: true, name: true },
    })
    
    if (!org) {
      console.log('❌ Demo organization not found')
      return
    }
    
    console.log(`📍 Organization: ${org.name} (${org.id})\n`)
    
    const admin = await prisma.user.findFirst({
      where: { 
        organizationId: org.id,
        email: 'admin@demo.com' 
      },
      include: {
        userRole: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })
    
    if (!admin) {
      console.log('❌ Admin user not found')
      return
    }
    
    console.log(`👤 User: ${admin.email}`)
    console.log(`🎭 Role: ${admin.userRole?.name || 'No role assigned'}\n`)
    
    if (!admin.userRole) {
      console.log('⚠️  User has no role assigned!')
      return
    }
    
    const rolePerms = admin.userRole.permissions.map(rp => {
      const p = rp.permission
      return `${p.resource}:${p.action}:${p.scope}`
    }).sort()
    
    console.log(`📋 Total permissions: ${rolePerms.length}\n`)
    
    const rolesPerms = rolePerms.filter(p => p.startsWith('roles:'))
    const teamsPerms = rolePerms.filter(p => p.startsWith('teams:'))
    
    console.log('🛡️  Roles permissions:')
    if (rolesPerms.length === 0) {
      console.log('   ❌ NONE')
    } else {
      rolesPerms.forEach(p => console.log(`   ✓ ${p}`))
    }
    
    console.log('\n👥 Teams permissions:')
    if (teamsPerms.length === 0) {
      console.log('   ❌ NONE')
    } else {
      teamsPerms.forEach(p => console.log(`   ✓ ${p}`))
    }
    
    console.log('\n' + '='.repeat(50))
    
    const missing = []
    const required = ['roles:read', 'roles:create', 'roles:update', 'roles:delete', 'teams:read', 'teams:create', 'teams:update', 'teams:delete']
    
    required.forEach(perm => {
      const [resource, action] = perm.split(':')
      const found = rolePerms.some(p => p === `${resource}:${action}:global`)
      if (!found) {
        missing.push(perm)
      }
    })
    
    if (missing.length > 0) {
      console.log('\n❌ MISSING PERMISSIONS:')
      missing.forEach(p => console.log(`   - ${p}`))
    } else {
      console.log('\n✅ All required permissions present!')
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkPermissions()
