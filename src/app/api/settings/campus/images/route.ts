import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { uploadCampusImage, deleteCampusImage } from '@/lib/services/storageService'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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
  return (rawPrisma as any)[model].findFirst({
    where: { id: entityId, organizationId: orgId, deletedAt: null },
    select: { id: true, images: true },
  })
}

async function updateEntityImages(entityType: string, entityId: string, images: string[]) {
  const model = entityType === 'building' ? 'building' : entityType === 'area' ? 'area' : 'room'
  return (rawPrisma as any)[model].update({
    where: { id: entityId },
    data: { images },
  })
}

/**
 * POST /api/settings/campus/images — Upload an image for a building, area, or room
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const body = await req.json()
    const input = UploadSchema.parse(body)

    // Decode base64 and check size
    const fileBuffer = Buffer.from(input.fileBase64, 'base64')
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'File size exceeds 5MB limit'), { status: 400 })
    }

    // Verify entity exists and belongs to org
    const entity = await getEntity(input.entityType, input.entityId, orgId)
    if (!entity) {
      return NextResponse.json(fail('NOT_FOUND', `${input.entityType} not found`), { status: 404 })
    }

    // Check max images
    const currentImages: string[] = Array.isArray(entity.images) ? entity.images : []
    if (currentImages.length >= MAX_IMAGES) {
      return NextResponse.json(fail('VALIDATION_ERROR', `Maximum ${MAX_IMAGES} images allowed`), { status: 400 })
    }

    // Upload to Supabase storage
    const imageUrl = await uploadCampusImage(
      orgId,
      input.entityType,
      input.entityId,
      fileBuffer,
      input.contentType
    )

    // Update entity images array
    const updatedImages = [...currentImages, imageUrl]
    await updateEntityImages(input.entityType, input.entityId, updatedImages)

    return NextResponse.json(ok({ imageUrl, images: updatedImages }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Image upload error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to upload image'), { status: 500 })
  }
}

/**
 * DELETE /api/settings/campus/images — Remove an image from a building, area, or room
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const body = await req.json()
    const input = DeleteSchema.parse(body)

    // Verify entity exists and belongs to org
    const entity = await getEntity(input.entityType, input.entityId, orgId)
    if (!entity) {
      return NextResponse.json(fail('NOT_FOUND', `${input.entityType} not found`), { status: 404 })
    }

    const currentImages: string[] = Array.isArray(entity.images) ? entity.images : []
    if (!currentImages.includes(input.imageUrl)) {
      return NextResponse.json(fail('NOT_FOUND', 'Image not found on this entity'), { status: 404 })
    }

    // Delete from Supabase storage
    try {
      await deleteCampusImage(input.imageUrl)
    } catch {
      // Log but don't fail — the image might already be deleted from storage
      console.warn('Failed to delete image from storage, continuing with DB update')
    }

    // Update entity images array
    const updatedImages = currentImages.filter((url) => url !== input.imageUrl)
    await updateEntityImages(input.entityType, input.entityId, updatedImages)

    return NextResponse.json(ok({ images: updatedImages }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Image delete error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete image'), { status: 500 })
  }
}
