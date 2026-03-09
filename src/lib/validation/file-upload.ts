/**
 * File upload validation utilities.
 *
 * Validates MIME types and file sizes before any storage interaction.
 * Used in upload routes as a first-pass guard against malicious or oversized files.
 */

/** Allowed MIME types for standard image uploads */
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

/** Allowed MIME types for document uploads (images + PDF) */
export const ALLOWED_DOCUMENT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
])

/** Default maximum file size: 10MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export interface FileValidationInput {
  type: string
  size: number
  name: string
}

export interface FileValidationOptions {
  allowedTypes?: Set<string>
  maxSizeBytes?: number
}

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a single file against MIME type allowlist and size limit.
 *
 * @param file - File metadata: MIME type, byte size, and name
 * @param options - Optional overrides for allowedTypes and maxSizeBytes
 * @returns { valid: true } on success, { valid: false, error: string } on failure
 */
export function validateFileUpload(
  file: FileValidationInput,
  options?: FileValidationOptions
): FileValidationResult {
  const allowedTypes = options?.allowedTypes ?? ALLOWED_IMAGE_TYPES
  const maxSizeBytes = options?.maxSizeBytes ?? MAX_FILE_SIZE_BYTES

  // Check MIME type
  if (!allowedTypes.has(file.type)) {
    const acceptedList = [...allowedTypes]
      .map((t) => {
        const sub = t.split('/')[1]
        return sub.toUpperCase()
      })
      .join(', ')
    return {
      valid: false,
      error: `File type '${file.type}' is not allowed. Accepted: ${acceptedList}`,
    }
  }

  // Check size (skip when size is 0 — means we don't have the actual bytes yet, e.g. signed URL routes)
  if (file.size > 0 && file.size > maxSizeBytes) {
    const limitMb = Math.round(maxSizeBytes / (1024 * 1024))
    return {
      valid: false,
      error: `File '${file.name}' exceeds the ${limitMb}MB size limit`,
    }
  }

  return { valid: true }
}

/**
 * Validate multiple files, returning a combined result.
 *
 * @param files - Array of file metadata objects
 * @param options - Optional overrides for allowedTypes and maxSizeBytes
 * @returns { valid: true } if all pass, { valid: false, error: string } on first failure
 */
export function validateMultipleFiles(
  files: FileValidationInput[],
  options?: FileValidationOptions
): FileValidationResult {
  for (const file of files) {
    const result = validateFileUpload(file, options)
    if (!result.valid) return result
  }
  return { valid: true }
}
