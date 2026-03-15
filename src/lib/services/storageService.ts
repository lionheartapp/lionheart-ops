/**
 * Storage Service
 *
 * Handles file uploads to Supabase Storage.
 * Used for organization logos and other asset uploads.
 *
 * NOTE: Requires `npm install @supabase/supabase-js` to resolve types.
 */

import { createClient } from '@supabase/supabase-js'

interface StorageConfig {
  url: string
  key: string
}

function getStorageConfig(): StorageConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    console.warn('Supabase credentials not configured for storage')
    return null
  }

  return { url, key }
}

function getSupabaseClient() {
  const config = getStorageConfig()
  if (!config) {
    throw new Error('Supabase storage not configured')
  }

  return createClient(config.url, config.key)
}

/**
 * Upload a file buffer to Supabase Storage
 *
 * @param orgId - Organization ID (used in path)
 * @param fileBuffer - File buffer to upload
 * @param contentType - MIME type (e.g., 'image/png')
 * @returns Public URL of the uploaded file
 */
export async function uploadLogo(
  orgId: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const config = getStorageConfig()
    if (!config) {
      throw new Error('Supabase storage not configured')
    }

    const client = getSupabaseClient()
    const fileName = `${orgId}-${Date.now()}-logo`
    const path = `${orgId}/${fileName}`

    const { error } = await client.storage.from('logos').upload(path, fileBuffer, {
      contentType,
      upsert: false,
    })

    if (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }

    // Construct public URL
    const publicUrl = `${config.url}/storage/v1/object/public/logos/${path}`
    return publicUrl
  } catch (error) {
    console.error('Logo upload error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Download an image from a URL and upload it to Supabase Storage
 *
 * @param orgId - Organization ID (used in path)
 * @param imageUrl - URL of the image to download
 * @returns Public URL of the uploaded file
 */
export async function uploadFromUrl(orgId: string, imageUrl: string): Promise<string> {
  try {
    // Download the image
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    // Upload to storage
    return await uploadLogo(orgId, Buffer.from(buffer), contentType)
  } catch (error) {
    console.error('Upload from URL error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Upload a campus image (building, area, or room) to Supabase Storage
 *
 * @param orgId - Organization ID
 * @param entityType - 'building' | 'area' | 'room'
 * @param entityId - ID of the entity
 * @param fileBuffer - File buffer to upload
 * @param contentType - MIME type (e.g., 'image/jpeg')
 * @returns Public URL of the uploaded file
 */
export async function uploadCampusImage(
  orgId: string,
  entityType: 'building' | 'area' | 'room',
  entityId: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const config = getStorageConfig()
    if (!config) {
      throw new Error('Supabase storage not configured')
    }

    const client = getSupabaseClient()
    const ext = contentType.split('/')[1] || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${orgId}/${entityType}/${entityId}/${fileName}`

    const { error } = await client.storage.from('campus-images').upload(path, fileBuffer, {
      contentType,
      upsert: false,
    })

    if (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }

    return `${config.url}/storage/v1/object/public/campus-images/${path}`
  } catch (error) {
    console.error('Campus image upload error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Delete a campus image from Supabase Storage
 *
 * @param imageUrl - Full public URL of the image
 */
export async function deleteCampusImage(imageUrl: string): Promise<void> {
  try {
    const client = getSupabaseClient()

    // Extract path from URL: .../storage/v1/object/public/campus-images/{path}
    const marker = '/storage/v1/object/public/campus-images/'
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) {
      throw new Error('Invalid campus image URL')
    }
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length))

    const { error } = await client.storage.from('campus-images').remove([path])

    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
  } catch (error) {
    console.error('Campus image delete error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Upload a branding image (logo or hero) to Supabase Storage
 *
 * @param orgId - Organization ID
 * @param imageType - 'logo' | 'hero'
 * @param fileBuffer - File buffer to upload
 * @param contentType - MIME type (e.g., 'image/png')
 * @returns Public URL of the uploaded file
 */
export async function uploadBrandingImage(
  orgId: string,
  imageType: 'logo' | 'hero',
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const config = getStorageConfig()
    if (!config) {
      throw new Error('Supabase storage not configured')
    }

    const client = getSupabaseClient()
    const ext = contentType.split('/')[1] || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${orgId}/${imageType}/${fileName}`

    const { error } = await client.storage.from('logos').upload(path, fileBuffer, {
      contentType,
      upsert: false,
    })

    if (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }

    return `${config.url}/storage/v1/object/public/logos/${path}`
  } catch (error) {
    console.error('Branding image upload error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Delete a branding image from Supabase Storage
 *
 * @param imageUrl - Full public URL of the image
 */
export async function deleteBrandingImage(imageUrl: string): Promise<void> {
  try {
    const client = getSupabaseClient()

    const marker = '/storage/v1/object/public/logos/'
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) {
      throw new Error('Invalid branding image URL')
    }
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length))

    const { error } = await client.storage.from('logos').remove([path])

    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
  } catch (error) {
    console.error('Branding image delete error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Delete a file from Supabase Storage
 *
 * @param orgId - Organization ID
 * @param fileName - File name to delete
 */
export async function deleteFile(orgId: string, fileName: string): Promise<void> {
  try {
    const client = getSupabaseClient()
    const path = `${orgId}/${fileName}`

    const { error } = await client.storage.from('logos').remove([path])

    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
  } catch (error) {
    console.error('File delete error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Upload a student registration photo to Supabase Storage.
 * Uses a private 'student-photos' bucket. Access is via signed URLs only (1-hour TTL).
 *
 * @param orgId - Organization ID
 * @param registrationId - Registration ID (used in storage path)
 * @param fileBuffer - File buffer to upload
 * @param contentType - MIME type (e.g., 'image/jpeg')
 * @returns Storage path (not public URL — bucket is private)
 */
export async function uploadRegistrationPhoto(
  orgId: string,
  registrationId: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<string> {
  try {
    const config = getStorageConfig()
    if (!config) throw new Error('Supabase storage not configured')

    const client = getSupabaseClient()
    const ext = contentType.split('/')[1] || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${orgId}/${registrationId}/${fileName}`

    const { error } = await client.storage.from('student-photos').upload(path, fileBuffer, {
      contentType,
      upsert: false,
    })

    if (error) throw new Error(`Upload failed: ${error.message}`)

    // Return the storage path — callers use getSignedPhotoUrl to generate access URLs
    return path
  } catch (error) {
    console.error('Student photo upload error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Generate a signed URL for viewing a student photo (private bucket).
 * Default TTL: 1 hour.
 *
 * @param photoPath - Storage path returned by uploadRegistrationPhoto
 * @param expiresIn - Expiry seconds (default 3600)
 * @returns Temporary signed URL
 */
export async function getSignedPhotoUrl(photoPath: string, expiresIn = 3600): Promise<string> {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client.storage
      .from('student-photos')
      .createSignedUrl(photoPath, expiresIn)

    if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)

    return data.signedUrl
  } catch (error) {
    console.error('Signed photo URL error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Generate a signed upload URL for direct client-to-Supabase uploads.
 * Returns the signed URL and the storage path for the upload.
 * Used by the public registration upload endpoint.
 *
 * @param orgId - Organization ID
 * @param registrationId - Registration ID
 * @param fileName - Original file name (used to derive extension)
 * @param contentType - MIME type
 * @returns { signedUrl, path }
 */
export async function createSignedPhotoUploadUrl(
  orgId: string,
  registrationId: string,
  fileName: string,
  contentType: string,
): Promise<{ signedUrl: string; path: string; token: string }> {
  try {
    const client = getSupabaseClient()
    const config = getStorageConfig()
    if (!config) throw new Error('Supabase storage not configured')

    const ext = fileName.split('.').pop() || contentType.split('/')[1] || 'jpg'
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${orgId}/${registrationId}/${uniqueName}`

    const { data, error } = await client.storage
      .from('student-photos')
      .createSignedUploadUrl(path)

    if (error || !data) throw new Error(`Signed upload URL failed: ${error?.message}`)

    return {
      signedUrl: data.signedUrl,
      path,
      token: data.token,
    }
  } catch (error) {
    console.error('Signed upload URL error:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Get the public URL for a file in storage
 *
 * @param orgId - Organization ID
 * @param fileName - File name
 * @returns Public URL
 */
export function getPublicUrl(orgId: string, fileName: string): string {
  const config = getStorageConfig()
  if (!config) {
    throw new Error('Supabase storage not configured')
  }

  const path = `${orgId}/${fileName}`
  return `${config.url}/storage/v1/object/public/logos/${path}`
}
