'use client'

import { FileText, Download } from 'lucide-react'

interface AttachmentPreviewProps {
  attachment: {
    fileName: string
    fileSize: number
    mimeType: string
    storageUrl: string
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const { fileName, fileSize, mimeType, storageUrl } = attachment
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'

  // Image: inline thumbnail
  if (isImage) {
    return (
      <a
        href={storageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1 cursor-pointer"
      >
        <img
          src={storageUrl}
          alt={fileName}
          loading="lazy"
          className="max-w-[300px] max-h-[200px] rounded-lg border border-slate-200 object-cover"
        />
      </a>
    )
  }

  // PDF: file card with PDF icon
  if (isPdf) {
    return (
      <a
        href={storageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-[300px] hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 truncate">{fileName}</p>
          <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
        </div>
      </a>
    )
  }

  // Generic file: download card
  return (
    <a
      href={storageUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex items-center gap-3 mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-[300px] hover:bg-slate-100 transition-colors cursor-pointer"
    >
      <Download className="w-6 h-6 text-slate-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 truncate">{fileName}</p>
        <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
      </div>
    </a>
  )
}
