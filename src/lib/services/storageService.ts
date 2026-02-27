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
