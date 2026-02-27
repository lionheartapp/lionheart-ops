/**
 * Onboarding Finalization API Endpoint
 *
 * POST /api/onboarding/finalize
 *
 * Completes the onboarding process for an organization:
 * - Updates theme colors and logo
 * - Creates default Building if address exists
 * - Sets onboarding status to ACTIVE
 * - Creates Free Trial subscription
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { prisma, rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'

const FinalizeSchema = z.object({
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
      secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
      accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
    })
    .optional(),
  logoUrl: z.string().min(1, 'Logo URL cannot be empty').optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const ctx = await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    // Parse and validate request body
    const body = await req.json()
    const validation = FinalizeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const { theme, logoUrl } = validation.data

    return await runWithOrgContext(orgId, async () => {
      // Get current organization
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          physicalAddress: true,
        },
      })

      if (!org) {
        return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
      }

      try {
        // Build update data
        const updateData: Record<string, any> = {
          onboardingStatus: 'ACTIVE',
        }

        if (logoUrl) {
          updateData.logoUrl = logoUrl
        }

        if (theme) {
          // Store theme as JSON
          updateData.theme = JSON.stringify(theme)
        }

        // Update organization
        const updatedOrg = await rawPrisma.organization.update({
          where: { id: orgId },
          data: updateData,
          select: {
            id: true,
            name: true,
            physicalAddress: true,
            logoUrl: true,
          },
        })

        // Create default Building if address exists
        if (org.physicalAddress) {
          try {
            await prisma.building.create({
              data: {
                name: 'Main Campus',
                code: 'MAIN',
                organizationId: orgId,
              },
            })
          } catch (error) {
            // Building might already exist, ignore error
            console.log('Building creation skipped:', error instanceof Error ? error.message : error)
          }
        }

        // TODO: Create subscription when billing models are synced

        return NextResponse.json(
          ok({
            organization: updatedOrg,
            status: 'FINALIZED',
          })
        )
      } catch (error) {
        console.error('Finalization error:', error)
        return NextResponse.json(
          fail('INTERNAL_ERROR', 'Failed to finalize onboarding'),
          { status: 500 }
        )
      }
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

    console.error('Finalize onboarding error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to finalize onboarding'),
      { status: 500 }
    )
  }
}
