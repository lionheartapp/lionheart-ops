/**
 * Bulk Member Import API Endpoint
 *
 * POST /api/onboarding/import-members
 *
 * Accepts an array of members to import into the organization.
 * For each member: creates User with status PENDING, generates PasswordSetupToken,
 * and sends welcome email.
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { prisma, rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { generateSetupToken, hashSetupToken, getSetupLink } from '@/lib/auth/password-setup'
import { sendWelcomeEmail } from '@/lib/services/emailService'

const ImportMembersSchema = z.object({
  members: z
    .array(
      z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email address'),
        role: z.string().optional(),
        team: z.string().optional(),
      })
    )
    .min(1, 'At least one member required')
    .max(500, 'Maximum 500 members per request'),
})

interface ImportError {
  email: string
  reason: string
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const ctx = await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    // Parse and validate request body
    const body = await req.json()
    const validation = ImportMembersSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const { members } = validation.data

    return await runWithOrgContext(orgId, async () => {
      const imported: string[] = []
      const errors: ImportError[] = []

      // Get the organization and its roles
      const organization = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      })

      if (!organization) {
        return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
      }

      // Get available roles
      const roles = await prisma.role.findMany({
        select: { id: true, slug: true },
      })

      const roleMap = new Map(roles.map((r) => [r.slug, r.id]))

      // Get available teams
      const teams = await prisma.team.findMany({
        select: { id: true, slug: true },
      })

      const teamMap = new Map(teams.map((t) => [t.slug, t.id]))

      // Process each member
      for (const member of members) {
        try {
          // Check if user already exists in this org
          const existingUser = await rawPrisma.user.findFirst({
            where: { email: member.email, organizationId: orgId, deletedAt: null },
          })

          if (existingUser) {
            errors.push({
              email: member.email,
              reason: 'User already exists in this organization',
            })
            continue
          }

          // Get role ID if specified
          let roleId: string | null = null
          if (member.role) {
            roleId = roleMap.get(member.role) || null
            if (!roleId) {
              errors.push({
                email: member.email,
                reason: `Role '${member.role}' not found`,
              })
              continue
            }
          }

          // Create the user
          const firstName = member.name.split(' ')[0]
          const lastName = member.name.split(' ').slice(1).join(' ')

          const user = await prisma.user.create({
            data: {
              email: member.email,
              firstName,
              lastName,
              name: member.name,
              status: 'PENDING' as any,
              roleId,
            } as any,
          })

          // Generate password setup token
          const plainToken = generateSetupToken()
          const tokenHash = hashSetupToken(plainToken)

          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 7) // Valid for 7 days

          await rawPrisma.passwordSetupToken.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt,
            },
          })

          // Add to team if specified
          if (member.team) {
            const teamId = teamMap.get(member.team)
            if (teamId) {
              await prisma.userTeam.create({
                data: {
                  userId: user.id,
                  teamId,
                },
              })
            }
          }

          // Send welcome email
          const setupLink = getSetupLink(plainToken)
          await sendWelcomeEmail({
            to: user.email,
            firstName: firstName || user.email,
            organizationName: organization.name,
            setupLink,
            expiresAtIso: expiresAt.toISOString(),
            mode: 'INVITE_ONLY',
          })

          imported.push(user.email)
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown error'
          errors.push({
            email: member.email,
            reason,
          })
        }
      }

      return NextResponse.json(
        ok({
          imported: imported.length,
          members: imported,
          errors,
        })
      )
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Authentication required'),
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('Missing x-org-id')) {
      return NextResponse.json(fail('FORBIDDEN', 'Missing tenant context'), { status: 403 })
    }

    console.error('Import members error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to import members'),
      { status: 500 }
    )
  }
}
