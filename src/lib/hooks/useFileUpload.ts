'use client'

import { useCallback, useRef, useState } from 'react'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

interface AttachmentMeta {
  fileName: string
  fileSize: number
  mimeType: string
  storageUrl: string
}

interface UseFileUploadReturn {
  upload: (file: File) => Promise<AttachmentMeta | null>
  isUploading: boolean
  progress: number
  error: string | null
  reset: () => void
}

export function useFileUpload(channelId: string): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
    setIsUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  const upload = useCallback(async (file: File): Promise<AttachmentMeta | null> => {
    // Client-side size validation
    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 25MB.')
      return null
    }

    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Step 1: Get a signed upload URL from our API
      const urlRes = await fetch('/api/messaging/attachments/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channelId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }),
      })

      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => null)
        const msg = body?.error?.message ?? 'Failed to prepare upload'
        setError(msg)
        setIsUploading(false)
        return null
      }

      const { data } = await urlRes.json()
      const { signedUrl, storagePath } = data as { signedUrl: string; storagePath: string }

      // Step 2: Upload file directly to Supabase Storage via XHR for progress
      const result = await new Promise<AttachmentMeta | null>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
            const storageUrl = `${supabaseUrl}/storage/v1/object/public/messaging-attachments/${storagePath}`

            resolve({
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || 'application/octet-stream',
              storageUrl,
            })
          } else {
            reject(new Error('Upload failed'))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => resolve(null))

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      })

      setIsUploading(false)
      setProgress(100)
      xhrRef.current = null
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setIsUploading(false)
      xhrRef.current = null
      return null
    }
  }, [channelId])

  return { upload, isUploading, progress, error, reset }
}
