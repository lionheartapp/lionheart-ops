import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { uploadCampusImage, deleteCampusImage } from '@/lib/services/storageService'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'

const MAX_IMAGES = 4

const UploadSchema = z.object({
  entityType: z.enum(['building', 'area', 'room']),
  entityId: z.string().min(1),
  fileBase64: z.string().min(1), // base64-encoded image data (without data: prefix)
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
})

const DeleteSchema = z.object({
  entityType: z.enum(['building', 'area', 'room']),
  entityId: z.string().min(1),
  imageUrl: z.string().url(),
})

async function getEntity(entityType: string, entityId: string, orgId: string) {
  const model = entityType === 'building' ? 'building' : entityType === 'area' ? 'area' : 'room'
  return (rawPrisma[model as keyof typeof rawPrisma] as any).findFirst({
    where: { id: entityId, organizationId: orgId, deletedAt: null },
    select: { id: true, images: true },
  })
}

async function updateEntityImages(entityType: string, entityId: string, images: string[]) {
  const model = entityType === 'building' ? 'building' : entityType === 'area' ? 'area' : 'room'
  return (rawPrisma[model as keyof typeof rawPrisma] as any).update({
    where: { id: entityId },
    data: { images },
  })
}

/**
 * POST /api/settings/campus/images -- Upload an image for a building, area, or room
 */
export const POST = withAuth<z.infer<typeof UploadSchema>>(async ({ orgId, body }) => {
  // Decode base64 and validate MIME type + size using shared utility
  const fileBuffer = Buffer.from(body.fileBase64, 'base64')
  const uploadCheck = validateFileUpload(
    { type: body.contentType, size: fileBuffer.length, name: `${body.entityType}-image` },
    { allowedTypes: ALLOWED_IMAGE_TYPES, maxSizeBytes: 5 * 1024 * 1024 }
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  // Verify entity exists and belongs to org
  const entity = await getEntity(body.entityType, body.entityId, orgId)
  if (!entity) {
    return NextResponse.json(fail('NOT_FOUND', `${body.entityType} not found`), { status: 404 })
  }

  // Check max images
  const currentImages: string[] = Array.isArray(entity.images) ? entity.images : []
  if (currentImages.length >= MAX_IMAGES) {
    return NextResponse.json(fail('VALIDATION_ERROR', `Maximum ${MAX_IMAGES} images allowed`), { status: 400 })
  }

  // Upload to Supabase storage
  const imageUrl = await uploadCampusImage(
    orgId,
    body.entityType,
    body.entityId,
    fileBuffer,
    body.contentType
  )

  // Update entity images array
  const updatedImages = [...currentImages, imageUrl]
  await updateEntityImages(body.entityType, body.entityId, updatedImages)

  return NextResponse.json(ok({ imageUrl, images: updatedImages }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UploadSchema })

/**
 * DELETE /api/settings/campus/images -- Remove an image from a building, area, or room
 */
export const DELETE = withAuth<z.infer<typeof DeleteSchema>>(async ({ orgId, body }) => {
  // Verify entity exists and belongs to org
  const entity = await getEntity(body.entityType, body.entityId, orgId)
  if (!entity) {
    return NextResponse.json(fail('NOT_FOUND', `${body.entityType} not found`), { status: 404 })
  }

  const currentImages: string[] = Array.isArray(entity.images) ? entity.images : []
  if (!currentImages.includes(body.imageUrl)) {
    return NextResponse.json(fail('NOT_FOUND', 'Image not found on this entity'), { status: 404 })
  }

  // Delete from Supabase storage
  try {
    await deleteCampusImage(body.imageUrl)
  } catch {
    // Log but don't fail -- the image might already be deleted from storage
    console.warn('Failed to delete image from storage, continuing with DB update')
  }

  // Update entity images array
  const updatedImages = currentImages.filter((url) => url !== body.imageUrl)
  await updateEntityImages(body.entityType, body.entityId, updatedImages)

  return NextResponse.json(ok({ images: updatedImages }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: DeleteSchema })
