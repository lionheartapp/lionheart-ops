/**
 * Public student photo upload API — no authentication required.
 *
 * POST /api/events/register/[eventSlug]/upload
 *
 * Generates a Supabase signed upload URL for direct client-to-storage upload.
 * The client uploads directly to Supabase (bypasses Next.js body size limits),
 * then includes the returned path when submitting the registration form.
 *
 * SECURITY:
 * - Turnstile token verified first
 * - Rate limited: 5 per IP per hour
 * - Content type validated against image allowlist (JPEG, PNG, WebP)
 * - Registration must belong to this event slug (cross-event upload prevention)
 * - Bucket is private — access is via signed URLs only
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { verifyTurnstile } from '@/lib/turnstile'
import { RateLimiter, getRateLimitHeaders } from '@/lib/rate-limit'
import { validateFileUpload } from '@/lib/validation/file-upload'
import { createSignedPhotoUploadUrl } from '@/lib/services/storageService'
import { rawPrisma } from '@/lib/db'

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

const uploadRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 5,            // 5 uploads per IP per hour
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const schema = z.object({
  turnstileToken: z.string().min(1, 'Turnstile token is required'),
  registrationId: z.string().min(1, 'Registration ID is required'),
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  try {
    const { eventSlug } = await params
    const ip = getClientIp(req)

    // 1. Parse and validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(fail('INVALID_JSON', 'Request body must be valid JSON'), { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request data', parsed.error.errors),
        { status: 400 },
      )
    }

    const data = parsed.data

    // 2. Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstileToken, ip)
    if (!turnstileValid) {
      return NextResponse.json(
        fail('CAPTCHA_FAILED', 'CAPTCHA verification failed. Please try again.'),
        { status: 422 },
      )
    }

    // 3. Validate content type (image only)
    const fileValidation = validateFileUpload(
      { type: data.contentType, size: 0, name: data.fileName },
      { allowedTypes: ALLOWED_PHOTO_TYPES, maxSizeBytes: 10 * 1024 * 1024 },
    )

    if (!fileValidation.valid) {
      return NextResponse.json(
        fail('INVALID_FILE_TYPE', fileValidation.error ?? 'File type not allowed'),
        { status: 422 },
      )
    }

    // 4. Rate limit by IP
    uploadRateLimiter.increment(ip)
    const rateLimitResult = uploadRateLimiter.check(ip)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        fail('RATE_LIMITED', 'Too many upload attempts from this IP. Please try again later.'),
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      )
    }

    // 5. Verify registration belongs to this event slug (cross-event upload prevention)
    // CRITICAL: organizationId resolved from slug, never from URL params
    const form = await rawPrisma.registrationForm.findUnique({
      where: { shareSlug: eventSlug },
      select: { id: true, organizationId: true, eventProjectId: true },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration form not found'), { status: 404 })
    }

    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: data.registrationId },
      select: { id: true, formId: true, organizationId: true },
    })

    if (!registration || registration.formId !== form.id) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Registration not found for this event'),
        { status: 404 },
      )
    }

    // 6. Generate signed upload URL via Supabase Storage
    const { signedUrl, path } = await createSignedPhotoUploadUrl(
      form.organizationId,
      data.registrationId,
      data.fileName,
      data.contentType,
    )

    return NextResponse.json(ok({
      signedUrl,
      path,
      // The client uploads to signedUrl, then submits path as photoUrl in the registration
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        fail('STORAGE_NOT_CONFIGURED', 'File storage is not configured'),
        { status: 503 },
      )
    }
    console.error('[upload POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
