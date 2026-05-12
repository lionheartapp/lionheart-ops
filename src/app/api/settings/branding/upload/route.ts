import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { uploadBrandingImage, deleteBrandingImage } from '@/lib/services/storageService'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'
import { logger } from '@/lib/logger'

// SVG removed — can contain <script> tags leading to stored XSS on login page
const ALLOWED_BRANDING_TYPES = new Set([...ALLOWED_IMAGE_TYPES])

const UploadSchema = z.object({
  imageType: z.enum(['logo', 'hero']),
  fileBase64: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
})

const DeleteSchema = z.object({
  imageUrl: z.string().url(),
})

/**
 * POST /api/settings/branding/upload — Upload a branding image (logo or hero)
 */
export const POST = withAuth<z.infer<typeof UploadSchema>>(async ({ orgId, body }) => {
  const fileBuffer = Buffer.from(body.fileBase64, 'base64')
  const uploadCheck = validateFileUpload(
    { type: body.contentType, size: fileBuffer.length, name: `${body.imageType}-branding` },
    { allowedTypes: ALLOWED_BRANDING_TYPES, maxSizeBytes: 5 * 1024 * 1024 }
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  const imageUrl = await uploadBrandingImage(
    orgId,
    body.imageType,
    fileBuffer,
    body.contentType
  )

  return NextResponse.json(ok({ imageUrl }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UploadSchema })

/**
 * DELETE /api/settings/branding/upload — Remove a branding image from storage
 */
export const DELETE = withAuth<z.infer<typeof DeleteSchema>>(async ({ orgId, body }) => {
  // Verify the image URL belongs to this org's branding path
  let imageUrlParsed: URL
  try {
    imageUrlParsed = new URL(body.imageUrl)
  } catch {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid image URL'), { status: 400 })
  }
  const expectedPathPrefix = `/storage/v1/object/public/logos/${orgId}/`
  if (!imageUrlParsed.pathname.startsWith(expectedPathPrefix)) {
    return NextResponse.json(fail('FORBIDDEN', 'Image does not belong to this organization'), { status: 403 })
  }

  try {
    await deleteBrandingImage(body.imageUrl)
  } catch {
    logger.warn('Failed to delete branding image from storage, continuing')
  }

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: DeleteSchema })
