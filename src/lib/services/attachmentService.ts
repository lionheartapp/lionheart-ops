/**
 * Attachment Service
 *
 * Handles file attachment uploads for messaging: signed URL generation,
 * attachment record creation, and batch loading for message display.
 */

import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'attachmentService' })

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

const ALLOWED_MIME_PATTERNS = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^text\/plain$/,
]

const BUCKET_NAME = 'messaging-attachments'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const UploadUrlSchema = z.object({
  channelId: z.string().min(1),
  fileName: z.string().max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
})

export const AttachmentDataSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  storageUrl: z.string(),
})

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AttachmentData {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  storageUrl: string
}

// ─── Supabase Client ────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new Error('Supabase storage not configured')
  }

  return { client: createClient(url, key), url }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Sanitize a file name: strip path separators, limit length, replace dangerous chars. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, '')           // strip path separators
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // replace dangerous chars
    .slice(0, 255)
}

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(mimeType))
}

function getExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()
  if (fromName && fromName !== fileName) return fromName
  const fromMime = mimeType.split('/')[1]
  return fromMime || 'bin'
}

// ─── Create Signed Upload URL ───────────────────────────────────────────────

export async function createSignedUploadUrl(
  orgId: string,
  userId: string,
  channelId: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<{ signedUrl: string; storagePath: string }> {
  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds the 25MB limit`)
  }

  // Validate mime type
  if (!isAllowedMimeType(mimeType)) {
    throw new Error(`File type "${mimeType}" is not supported`)
  }

  // Sanitize file name
  const safeName = sanitizeFileName(fileName)

  // Verify user is a member of the channel
  const db = prisma as unknown as OrgPrismaClient
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  })
  if (!membership) {
    throw new Error('Not a member of this channel')
  }

  // Generate unique storage path
  const ext = getExtension(safeName, mimeType)
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).slice(2, 10)
  const storagePath = `${orgId}/messaging/${channelId}/${timestamp}-${randomId}.${ext}`

  // Create signed upload URL
  const { client } = getSupabaseClient()
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    log.error({ err: error?.message }, 'Failed to create signed upload URL')
    throw new Error('Failed to create upload URL')
  }

  return {
    signedUrl: data.signedUrl,
    storagePath,
  }
}

// ─── Create Attachment Record ───────────────────────────────────────────────

export async function createAttachmentRecord(
  messageId: string,
  orgId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  storageUrl: string,
): Promise<AttachmentData> {
  const db = prisma as unknown as OrgPrismaClient

  const record = await db.messageAttachment.create({
    data: {
      messageId,
      fileName: sanitizeFileName(fileName),
      fileSize,
      mimeType,
      storageUrl,
    },
  })

  return {
    id: record.id as string,
    fileName: record.fileName as string,
    fileSize: record.fileSize as number,
    mimeType: record.mimeType as string,
    storageUrl: record.storageUrl as string,
  }
}

// ─── Batch Load Attachments ─────────────────────────────────────────────────

export async function getAttachmentsForMessages(
  messageIds: string[],
): Promise<Map<string, AttachmentData[]>> {
  if (messageIds.length === 0) return new Map()

  const db = prisma as unknown as OrgPrismaClient

  const attachments = await db.messageAttachment.findMany({
    where: { messageId: { in: messageIds } },
  })

  const result = new Map<string, AttachmentData[]>()

  for (const att of attachments) {
    const a = att as Record<string, unknown>
    const msgId = a.messageId as string
    const data: AttachmentData = {
      id: a.id as string,
      fileName: a.fileName as string,
      fileSize: a.fileSize as number,
      mimeType: a.mimeType as string,
      storageUrl: a.storageUrl as string,
    }

    const existing = result.get(msgId)
    if (existing) {
      existing.push(data)
    } else {
      result.set(msgId, [data])
    }
  }

  return result
}
