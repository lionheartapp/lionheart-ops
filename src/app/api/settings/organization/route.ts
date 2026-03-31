import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'
import { audit, getIp } from '@/lib/services/auditService'

const OrgUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    )
    .optional(),
  eventBufferMinutes: z.number().int().min(0).max(480).optional(),
})

export const GET = withAuth(async ({ orgId }) => {
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true, eventBufferMinutes: true },
  })

  if (!org) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  return NextResponse.json(ok(org))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof OrgUpdateSchema>>(async ({ orgId, ctx, req, body }) => {
  const { name, slug, eventBufferMinutes } = body

  if (!name && !slug && eventBufferMinutes === undefined) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'At least one field must be provided'),
      { status: 400 }
    )
  }

  // If slug is changing, check uniqueness
  if (slug) {
    const existing = await rawPrisma.organization.findFirst({
      where: { slug, id: { not: orgId } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Slug already taken'),
        { status: 400 }
      )
    }
  }

  const updated = await rawPrisma.organization.update({
    where: { id: orgId },
    data: {
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      ...(eventBufferMinutes !== undefined ? { eventBufferMinutes } : {}),
    },
    select: { name: true, slug: true, eventBufferMinutes: true },
  })

  await audit({
    organizationId: orgId,
    userId: ctx.userId,
    userEmail: ctx.email,
    action: 'organization.update',
    resourceType: 'Organization',
    resourceId: orgId,
    changes: { name, slug },
    ipAddress: getIp(req),
  })

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.SETTINGS_READ, schema: OrgUpdateSchema })
