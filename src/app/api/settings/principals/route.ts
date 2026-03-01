import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const normalizeNameToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const splitPrincipalName = (value: string) => {
  const cleaned = value.trim().replace(/\s+/g, ' ')
  const parts = cleaned.split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
  return { firstName, lastName }
}

const extractDomainFromUrl = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`)
    return parsed.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

const buildPrincipalEmailLocalPart = (firstName: string, lastName: string) => {
  const firstInitial = normalizeNameToken(firstName).charAt(0) || 'p'
  const normalizedLastName = normalizeNameToken(lastName)
  const fallbackLastName = normalizeNameToken(firstName) || 'principal'
  return `${firstInitial}${normalizedLastName || fallbackLastName}`
}

const toPrincipalResponse = (user: {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  phone: string | null
  jobTitle: string | null
}) => ({
  id: user.id,
  name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  email: user.email,
  phone: user.phone,
  jobTitle: user.jobTitle || '',
})

// GET - Search for principals by name
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission
    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()

    if (!query) {
      return NextResponse.json(ok([]))
    }

    return await runWithOrgContext(orgId, async () => {
      const queryTokens = query.split(/\s+/).map((token) => token.trim()).filter(Boolean)

      const users = await prisma.user.findMany({
        where: {
          organizationId: orgId,
          AND: queryTokens.map((token) => ({
            OR: [
              { firstName: { contains: token, mode: 'insensitive' } },
              { lastName: { contains: token, mode: 'insensitive' } },
              { name: { contains: token, mode: 'insensitive' } },
              { email: { contains: token, mode: 'insensitive' } },
            ],
          })),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
        take: 15,
      })

      return NextResponse.json(ok(users.map(toPrincipalResponse)))
    })
  } catch (err) {
    console.error('Failed to search principals:', err)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to search principals'),
      { status: 500 }
    )
  }
}

// POST - Create a new principal (user)
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    // Check permission
    await assertCan(userContext.userId, PERMISSIONS.USERS_INVITE)

    const principalName = String(body.name || '').trim().replace(/\s+/g, ' ')
    const phone = String(body.phone || '').trim() || null
    const phoneExt = String(body.phoneExt || '').trim() || null

    if (!principalName) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Principal name is required'),
        { status: 400 }
      )
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Principal phone must be a valid phone number'),
        { status: 400 }
      )
    }

    if (phoneExt && !isValidExtension(phoneExt)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Extension must be numeric and up to 6 digits'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const { firstName, lastName } = splitPrincipalName(principalName)

      const [organization, existingUserForDomain] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { slug: true, website: true },
        }),
        prisma.user.findFirst({
          where: {
            organizationId: orgId,
            email: {
              not: {
                endsWith: '@temp.local',
              },
            },
          },
          select: { email: true },
          orderBy: { createdAt: 'asc' },
        }),
      ])

      const websiteDomain = extractDomainFromUrl(organization?.website)
      const existingEmailDomain = existingUserForDomain?.email.split('@')[1]?.toLowerCase() || null
      const fallbackDomain = `${(organization?.slug || 'school').toLowerCase()}.com`
      const emailDomain = websiteDomain || existingEmailDomain || fallbackDomain

      const baseLocalPart = buildPrincipalEmailLocalPart(firstName, lastName)
      let email = `${baseLocalPart}@${emailDomain}`
      let suffix = 2

      while (true) {
        const emailExists = await prisma.user.findUnique({
          where: {
            organizationId_email: {
              organizationId: orgId,
              email,
            },
          },
          select: { id: true },
        })

        if (!emailExists) break
        email = `${baseLocalPart}${suffix}@${emailDomain}`
        suffix += 1
      }

      // Get a basic role for the principal
      let roleId = null
      const roles = await prisma.role.findMany({
        where: { organizationId: orgId },
        select: { id: true },
        take: 1,
      })
      if (roles.length > 0) {
        roleId = roles[0].id
      }

      if (!roleId) {
        return NextResponse.json(
          fail('BAD_REQUEST', 'No roles available in organization'),
          { status: 400 }
        )
      }

      // Create the user
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          phone: phone || null,
          jobTitle: 'Principal',
          passwordHash: '', // Will need to be set later
          roleId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
        },
      })

      return NextResponse.json(ok(toPrincipalResponse(user)), { status: 201 })
    })
  } catch (err) {
    console.error('Failed to create principal:', err)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create principal'),
      { status: 500 }
    )
  }
}
