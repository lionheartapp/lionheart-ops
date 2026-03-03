import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { uploadBrandingImage, deleteBrandingImage } from '@/lib/services/storageService'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const UploadSchema = z.object({
  imageType: z.enum(['logo', 'hero']),
  fileBase64: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
})

const DeleteSchema = z.object({
  imageUrl: z.string().url(),
})

/**
 * POST /api/settings/branding/upload — Upload a branding image (logo or hero)
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    if (!orgId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Organization ID is required'), { status: 400 })
    }
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const body = await req.json()
    const input = UploadSchema.parse(body)

    const fileBuffer = Buffer.from(input.fileBase64, 'base64')
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'File size exceeds 5MB limit'), { status: 400 })
    }

    const imageUrl = await uploadBrandingImage(
      orgId,
      input.imageType,
      fileBuffer,
      input.contentType
    )

    return NextResponse.json(ok({ imageUrl }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Branding upload error:', error instanceof Error ? error.message : error, error)
    const msg = error instanceof Error ? error.message : 'Failed to upload image'
    return NextResponse.json(fail('INTERNAL_ERROR', msg), { status: 500 })
  }
}

/**
 * DELETE /api/settings/branding/upload — Remove a branding image from storage
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    if (!orgId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Organization ID is required'), { status: 400 })
    }
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const body = await req.json()
    const input = DeleteSchema.parse(body)

    // Verify the image URL belongs to this org's branding path
    let imageUrlParsed: URL
    try {
      imageUrlParsed = new URL(input.imageUrl)
    } catch {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid image URL'), { status: 400 })
    }
    const expectedPathPrefix = `/storage/v1/object/public/logos/${orgId}/`
    if (!imageUrlParsed.pathname.includes(expectedPathPrefix)) {
      return NextResponse.json(fail('FORBIDDEN', 'Image does not belong to this organization'), { status: 403 })
    }

    try {
      await deleteBrandingImage(input.imageUrl)
    } catch {
      console.warn('Failed to delete branding image from storage, continuing')
    }

    return NextResponse.json(ok({ deleted: true }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Branding delete error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete image'), { status: 500 })
  }
}
