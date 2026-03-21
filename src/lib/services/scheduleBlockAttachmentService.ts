import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'

// ============= Constants =============

const BUCKET_NAME = 'schedule-attachments'
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

// ============= Supabase client =============

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new Error('Supabase storage not configured')
  }

  return { client: createClient(url, key), url }
}

// ============= Validation Schemas =============

export const CreateBlockAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z.string().min(1),
})

export type CreateBlockAttachmentInput = z.infer<typeof CreateBlockAttachmentSchema>

// ============= Service Functions =============

/**
 * List all attachments for a schedule block, ordered newest first.
 */
export async function listAttachments(blockId: string) {
  return prisma.scheduleBlockAttachment.findMany({
    where: { blockId },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true, firstName: true, lastName: true } },
    },
  })
}

/**
 * Get attachment count for a block (used in block list display).
 */
export async function countAttachments(blockId: string) {
  return prisma.scheduleBlockAttachment.count({
    where: { blockId },
  })
}

/**
 * Upload a file attachment to a schedule block.
 * Accepts any file type up to 50MB.
 *
 * @param blockId - The schedule block to attach the file to
 * @param uploadedById - The user uploading the file
 * @param input - File data (base64-encoded) with name and content type
 * @param organizationId - Org ID for multi-tenancy filtering
 */
export async function createAttachment(
  blockId: string,
  uploadedById: string,
  input: { fileName: string; fileBase64: string; contentType: string },
  organizationId: string
) {
  const validated = CreateBlockAttachmentSchema.parse(input)

  // Decode base64 to Buffer
  const buffer = Buffer.from(validated.fileBase64, 'base64')

  // Validate file size only (any file type allowed)
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))
    throw new Error(`File '${validated.fileName}' exceeds the ${limitMb}MB size limit`)
  }

  if (buffer.length === 0) {
    throw new Error('File is empty')
  }

  // Upload to Supabase Storage
  const { client, url } = getSupabaseClient()
  const uploadPath = `${organizationId}/${blockId}/${Date.now()}-${validated.fileName}`

  const { error: uploadError } = await client.storage
    .from(BUCKET_NAME)
    .upload(uploadPath, buffer, {
      contentType: validated.contentType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const publicUrl = `${url}/storage/v1/object/public/${BUCKET_NAME}/${uploadPath}`

  // Create DB record
  const attachment = await prisma.scheduleBlockAttachment.create({
    data: {
      blockId,
      uploadedById,
      fileName: validated.fileName,
      fileUrl: publicUrl,
      contentType: validated.contentType,
      sizeBytes: buffer.length,
      organizationId,
    },
    include: {
      uploadedBy: { select: { id: true, name: true, firstName: true, lastName: true } },
    },
  })

  return attachment
}

/**
 * Delete a file attachment from a schedule block.
 * Removes from both Supabase Storage and the database.
 *
 * @param attachmentId - The attachment record to delete
 * @param blockId - Verify the attachment belongs to this block
 */
export async function deleteAttachment(attachmentId: string, blockId: string) {
  // Verify attachment exists and belongs to this block
  const attachment = await prisma.scheduleBlockAttachment.findFirst({
    where: { id: attachmentId, blockId },
  })

  if (!attachment) {
    throw new Error('Attachment not found')
  }

  // Delete from Supabase Storage
  try {
    const { client } = getSupabaseClient()
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`
    const idx = attachment.fileUrl.indexOf(marker)
    if (idx !== -1) {
      const path = decodeURIComponent(attachment.fileUrl.slice(idx + marker.length))
      await client.storage.from(BUCKET_NAME).remove([path])
    }
  } catch (err) {
    // Log but don't fail — DB record cleanup is more important
    console.error('Failed to delete file from storage:', err)
  }

  // Delete DB record
  await prisma.scheduleBlockAttachment.delete({
    where: { id: attachmentId },
  })

  return { deleted: true }
}
