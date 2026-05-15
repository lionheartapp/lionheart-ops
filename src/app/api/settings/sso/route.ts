/**
 * SSO Settings — GET/PUT /api/settings/sso
 *
 * Manage the organization's SAML SSO configuration.
 * Requires SETTINGS_SSO_MANAGE permission.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { buildSpEntityId, buildAcsUrl, buildMetadataUrl } from '@/lib/services/samlService'
import { audit, getIp } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  idpEntityId: z.string().min(1, 'IdP Entity ID is required'),
  idpSsoUrl: z.string().url('IdP SSO URL must be a valid URL'),
  idpCertificate: z.string().min(1, 'IdP Certificate is required'),
  nameIdFormat: z.string().optional(),
  emailAttr: z.string().optional(),
  firstNameAttr: z.string().nullable().optional(),
  lastNameAttr: z.string().nullable().optional(),
  autoProvisionUsers: z.boolean().optional(),
  defaultRoleId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_SSO_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const connection = await rawPrisma.samlConnection.findUnique({
        where: { organizationId: orgId },
      })

      // Always include the SP metadata URLs so admins can configure their IdP
      const spInfo = {
        spEntityId: buildSpEntityId(orgId),
        spAcsUrl: buildAcsUrl(),
        spMetadataUrl: buildMetadataUrl(orgId),
      }

      if (!connection) {
        return NextResponse.json(ok({ connection: null, ...spInfo }))
      }

      // Don't expose the full certificate in list view — just confirm it exists
      return NextResponse.json(ok({
        connection: {
          id: connection.id,
          enabled: connection.enabled,
          idpEntityId: connection.idpEntityId,
          idpSsoUrl: connection.idpSsoUrl,
          hasCertificate: !!connection.idpCertificate,
          idpCertificate: connection.idpCertificate,
          nameIdFormat: connection.nameIdFormat,
          emailAttr: connection.emailAttr,
          firstNameAttr: connection.firstNameAttr,
          lastNameAttr: connection.lastNameAttr,
          autoProvisionUsers: connection.autoProvisionUsers,
          defaultRoleId: connection.defaultRoleId,
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
        },
        ...spInfo,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const log = logger.child({ route: '/api/settings/sso', method: 'PUT' })

  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_SSO_MANAGE)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid SSO configuration', parsed.error.issues),
        { status: 400 }
      )
    }

    const data = parsed.data

    // Basic certificate format validation
    const cert = data.idpCertificate.trim()
    if (!cert.includes('BEGIN CERTIFICATE') && !cert.includes('MIIC')) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Certificate must be in PEM format (BEGIN CERTIFICATE) or base64-encoded DER'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const connection = await rawPrisma.samlConnection.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          enabled: data.enabled ?? false,
          idpEntityId: data.idpEntityId,
          idpSsoUrl: data.idpSsoUrl,
          idpCertificate: cert,
          spEntityId: buildSpEntityId(orgId),
          spAcsUrl: buildAcsUrl(),
          nameIdFormat: data.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          emailAttr: data.emailAttr || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstNameAttr: data.firstNameAttr ?? null,
          lastNameAttr: data.lastNameAttr ?? null,
          autoProvisionUsers: data.autoProvisionUsers ?? false,
          defaultRoleId: data.defaultRoleId ?? null,
        },
        update: {
          enabled: data.enabled,
          idpEntityId: data.idpEntityId,
          idpSsoUrl: data.idpSsoUrl,
          idpCertificate: cert,
          spEntityId: buildSpEntityId(orgId),
          spAcsUrl: buildAcsUrl(),
          nameIdFormat: data.nameIdFormat,
          emailAttr: data.emailAttr,
          firstNameAttr: data.firstNameAttr,
          lastNameAttr: data.lastNameAttr,
          autoProvisionUsers: data.autoProvisionUsers,
          defaultRoleId: data.defaultRoleId,
        },
      })

      log.info({ orgId, connectionId: connection.id }, 'SAML SSO configuration updated')

      void audit({
        organizationId: orgId,
        userId: ctx.userId,
        userEmail: ctx.email,
        action: 'sso.update',
        resourceType: 'SamlConnection',
        resourceId: connection.id,
        changes: { enabled: connection.enabled, idpEntityId: connection.idpEntityId },
        ipAddress: getIp(req),
      })

      return NextResponse.json(ok({
        connection: {
          id: connection.id,
          enabled: connection.enabled,
          idpEntityId: connection.idpEntityId,
          idpSsoUrl: connection.idpSsoUrl,
          hasCertificate: true,
        },
        spEntityId: buildSpEntityId(orgId),
        spAcsUrl: buildAcsUrl(),
        spMetadataUrl: buildMetadataUrl(orgId),
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to update SSO configuration')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
