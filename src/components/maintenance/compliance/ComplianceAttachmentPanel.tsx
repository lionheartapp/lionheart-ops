'use client'

import { useRef, useState } from 'react'
import { Paperclip, X, FileText, Image, Loader2, UploadCloud } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'

interface ComplianceRecord {
  id: string
  attachments: string[]
}

interface ComplianceAttachmentPanelProps {
  record: ComplianceRecord
  onAttachmentsUpdated: (attachments: string[]) => void
}

const MAX_ATTACHMENTS = 10

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.includes('.pdf')) return <FileText className="w-4 h-4 text-red-500" />
  if (lower.match(/\.(png|jpg|jpeg|gif|webp)/)) return <Image className="w-4 h-4 text-blue-500" />
  return <FileText className="w-4 h-4 text-slate-400" />
}

function getFileName(url: string): string {
  try {
    const parts = url.split('/')
    const last = parts[parts.length - 1] || 'document'
    // Strip timestamp prefix (e.g. "1234567890-filename.pdf" -> "filename.pdf")
    return last.replace(/^\d+-/, '')
  } catch {
    return 'document'
  }
}

export function ComplianceAttachmentPanel({ record, onAttachmentsUpdated }: ComplianceAttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<string[]>(record.attachments ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (attachments.length >= MAX_ATTACHMENTS) {
      setUploadError(`Maximum ${MAX_ATTACHMENTS} attachments allowed`)
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      // Step 1: Get signed upload URL
      const headers = getAuthHeaders()
      const urlRes = await fetch(`/api/maintenance/compliance/records/${record.id}/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })

      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}))
        throw new Error(errData?.error?.message || 'Failed to get upload URL')
      }

      const urlData = await urlRes.json()
      const { uploadUrl, fileUrl } = urlData.data

      // Step 2: PUT file to Supabase signed URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!putRes.ok) {
        throw new Error('File upload failed')
      }

      // Step 3: PATCH record to append fileUrl to attachments
      const newAttachments = [...attachments, fileUrl]
      const patchRes = await fetch(`/api/maintenance/compliance/records/${record.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ attachments: newAttachments }),
      })

      if (!patchRes.ok) {
        throw new Error('Failed to update record attachments')
      }

      setAttachments(newAttachments)
      onAttachmentsUpdated(newAttachments)
    } catch (err) {
      console.error('[ComplianceAttachmentPanel] Upload error:', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (urlToDelete: string) => {
    const newAttachments = attachments.filter((a) => a !== urlToDelete)
    const headers = getAuthHeaders()

    try {
      const patchRes = await fetch(`/api/maintenance/compliance/records/${record.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ attachments: newAttachments }),
      })

      if (!patchRes.ok) {
        throw new Error('Failed to update record attachments')
      }

      setAttachments(newAttachments)
      onAttachmentsUpdated(newAttachments)
    } catch (err) {
      console.error('[ComplianceAttachmentPanel] Delete error:', err)
    }
  }

  const canAddMore = attachments.length < MAX_ATTACHMENTS && !uploading

  return (
    <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Attachments</span>
        </div>
        <span className="text-xs text-slate-400">
          {attachments.length}/{MAX_ATTACHMENTS} documents
        </span>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {attachments.map((url, idx) => (
            <li key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 group">
              {getFileIcon(url)}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-slate-700 hover:text-primary-600 truncate cursor-pointer transition-colors"
                title={getFileName(url)}
              >
                {getFileName(url)}
              </a>
              <button
                onClick={() => handleDelete(url)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      {canAddMore && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary-300 text-primary-600 text-xs font-medium hover:bg-primary-50/50 transition-colors cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Attach Document
        </button>
      )}

      {uploading && (
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
          Uploading...
        </div>
      )}

      {uploadError && (
        <p className="mt-2 text-xs text-red-500">{uploadError}</p>
      )}

      {attachments.length >= MAX_ATTACHMENTS && (
        <p className="text-xs text-slate-400 mt-2">Maximum {MAX_ATTACHMENTS} attachments reached.</p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
