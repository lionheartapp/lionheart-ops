#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'

const prisma = new PrismaClient()
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const preferredOrgSlug = process.env.SMOKE_ORG_SLUG || 'demo'

function hashSetupToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { res, json }
}

async function resolveOrganizationId() {
  const preferred = await prisma.organization.findFirst({
    where: { slug: preferredOrgSlug },
    select: { id: true },
  })

  if (preferred) return preferred.id

  const fallback = await prisma.organization.findFirst({ select: { id: true } })
  if (!fallback) {
    throw new Error('No organization found in database for smoke test')
  }

  return fallback.id
}

async function main() {
  let testUserId = null

  try {
    const organizationId = await resolveOrganizationId()
    const seed = Date.now().toString()
    const email = `smoke+set-password-${seed}@example.com`
    const initialPasswordHash = await bcrypt.hash('TempInit123!', 10)

    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        firstName: 'Smoke',
        lastName: 'Password',
        name: 'Smoke Password',
        passwordHash: initialPasswordHash,
        status: 'ACTIVE',
        role: 'VIEWER',
        schoolScope: 'GLOBAL',
        teamIds: [],
      },
      select: { id: true },
    })

    testUserId = user.id

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = hashSetupToken(rawToken)

    await prisma.passwordSetupToken.create({
      data: {
        userId: testUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    const newPassword = 'SmokeNewPass123!'
    const setPasswordRes = await req('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: newPassword }),
    })

    if (!setPasswordRes.res.ok || !setPasswordRes.json?.ok) {
      throw new Error(
        `Set password failed: ${setPasswordRes.res.status} ${JSON.stringify(setPasswordRes.json)}`
      )
    }

    const tokenRecord = await prisma.passwordSetupToken.findUnique({
      where: { tokenHash },
      select: { usedAt: true },
    })

    if (!tokenRecord?.usedAt) {
      throw new Error('Expected setup token to be marked used, but usedAt is null')
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { passwordHash: true },
    })

    if (!updatedUser) {
      throw new Error('Test user missing after set-password flow')
    }

    const matches = await bcrypt.compare(newPassword, updatedUser.passwordHash)
    if (!matches) {
      throw new Error('Password hash was not updated to the new password')
    }

    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword, organizationId }),
    })

    if (!loginRes.res.ok || !loginRes.json?.ok || !loginRes.json?.data?.token) {
      throw new Error(`Login with new password failed: ${loginRes.res.status} ${JSON.stringify(loginRes.json)}`)
    }

    const secondUseRes = await req('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'AnotherPass123!' }),
    })

    if (secondUseRes.res.status !== 400 || secondUseRes.json?.error?.code !== 'TOKEN_USED') {
      throw new Error(
        `Expected TOKEN_USED on token reuse, got ${secondUseRes.res.status} ${JSON.stringify(secondUseRes.json)}`
      )
    }

    console.log('✅ Set-password smoke passed')
    console.log(
      JSON.stringify(
        {
          organizationId,
          checks: {
            setPasswordStatus: setPasswordRes.res.status,
            tokenMarkedUsed: true,
            passwordUpdated: true,
            loginWithNewPasswordStatus: loginRes.res.status,
            tokenReuseRejected: true,
          },
        },
        null,
        2
      )
    )
  } finally {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }

    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('❌ Set-password smoke failed:', error.message)
  process.exit(1)
})
