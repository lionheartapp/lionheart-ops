import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'
import { validateFileUpload, ALLOWED_DOCUMENT_TYPES } from '@/lib/validation/file-upload'

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

export const CreateAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z.string().min(1),
})

export type CreateAttachmentInput = z.infer<typeof CreateAttachmentSchema>

// ============= Service Functions =============

/**
 * List all attachments for a ticket, ordered newest first.
 * Security: Caller must verify ticket access before calling (e.g., via getTicketById).
 */
export async function listAttachments(ticketId: string) {
  return prisma.ticketAttachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  })
}

/**
 * Upload a file attachment to a ticket.
 * Security: Caller must verify ticket access before calling.
 *
 * @param ticketId - The ticket to attach the file to
 * @param uploadedById - The user uploading the file
 * @param input - File data (base64-encoded) with name and content type
 * @param organizationId - Org ID for multi-tenancy filtering
 */
export async function createAttachment(
  ticketId: string,
  uploadedById: string,
  input: { fileName: string; fileBase64: string; contentType: string },
  organizationId: string
) {
  const validated = CreateAttachmentSchema.parse(input)

  // Decode base64 to Buffer
  const buffer = Buffer.from(validated.fileBase64, 'base64')

  // Validate file type and size
  const validation = validateFileUpload(
    { size: buffer.length, type: validated.contentType, name: validated.fileName },
    { allowedTypes: ALLOWED_DOCUMENT_TYPES, maxSizeBytes: 10 * 1024 * 1024 }
  )
  if (!validation.valid) {
    throw new Error(validation.error ?? 'File validation failed')
  }

  // Upload to Supabase Storage bucket ticket-attachments
  const { client, url } = getSupabaseClient()
  const uploadPath = `${organizationId}/${ticketId}/${Date.now()}-${validated.fileName}`

  const { error: uploadError } = await client.storage
    .from('ticket-attachments')
    .upload(uploadPath, buffer, {
      contentType: validated.contentType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const publicUrl = `${url}/storage/v1/object/public/ticket-attachments/${uploadPath}`

  // Create DB record
  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      uploadedById,
      fileName: validated.fileName,
      fileUrl: publicUrl,
      contentType: validated.contentType,
      sizeBytes: buffer.length,
      organizationId,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  })

  return attachment
}
