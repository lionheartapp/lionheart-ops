'use client'

import { useState, useRef } from 'react'
import { format } from 'date-fns'
import {
  Upload,
  FileText,
  FileAudio,
  FileVideo,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  FolderOpen,
  Loader2,
} from 'lucide-react'
import {
  useBlockAttachments,
  useUploadBlockAttachment,
  useDeleteBlockAttachment,
  type ScheduleBlockAttachment,
} from '@/lib/hooks/useEventSchedule'
import { useToast } from '@/components/Toast'
import { formatFileSize } from '@/lib/schedule-utils'

// ─── File icon helper ────────────────────────────────────────────────────────

export function getFileIcon(contentType: string, fileName: string) {
  if (contentType.startsWith('audio/') || fileName.match(/\.(mp3|wav|aac|flac|ogg|m4a)$/i))
    return <FileAudio className="w-5 h-5 text-purple-500" />
  if (contentType.startsWith('video/') || fileName.match(/\.(mp4|mov|avi|mkv|webm)$/i))
    return <FileVideo className="w-5 h-5 text-blue-500" />
  if (contentType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
    return <FileImage className="w-5 h-5 text-green-500" />
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || fileName.match(/\.(xlsx|xls|csv)$/i))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
  if (contentType.includes('pdf') || fileName.match(/\.pdf$/i))
    return <FileText className="w-5 h-5 text-red-500" />
  if (contentType.includes('presentation') || contentType.includes('powerpoint') || fileName.match(/\.(pptx|ppt|key)$/i))
    return <FileText className="w-5 h-5 text-orange-500" />
  if (fileName.match(/\.(pro[4-7]?|pro6x|pro6plx)$/i))
    return <FileText className="w-5 h-5 text-indigo-500" />
  return <File className="w-5 h-5 text-slate-400" />
}

// ─── Block Files Tab ─────────────────────────────────────────────────────────

interface BlockFilesTabProps {
  eventProjectId: string
  blockId: string
}

export function BlockFilesTab({ eventProjectId, blockId }: BlockFilesTabProps) {
  const { data: attachments, isLoading } = useBlockAttachments(eventProjectId, blockId)
  const uploadMutation = useUploadBlockAttachment(eventProjectId, blockId)
  const deleteMutation = useDeleteBlockAttachment(eventProjectId, blockId)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ name: string; progress: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      if (file.size > 50 * 1024 * 1024) {
        toast(`${file.name} exceeds 50MB limit`, 'error')
        continue
      }

      setUploadProgress({ name: file.name, progress: 30 })

      try {
        // Convert to base64
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        setUploadProgress({ name: file.name, progress: 60 })

        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type || 'application/octet-stream',
        })

        setUploadProgress({ name: file.name, progress: 100 })
        toast(`${file.name} uploaded`, 'success')
      } catch (err) {
        toast(
          `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        )
      } finally {
        setUploadProgress(null)
      }
    }
  }

  async function handleDelete(attachmentId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return
    try {
      await deleteMutation.mutateAsync(attachmentId)
      toast(`${fileName} deleted`, 'success')
    } catch {
      toast(`Failed to delete ${fileName}`, 'error')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  function getUploaderName(att: ScheduleBlockAttachment): string {
    if (!att.uploadedBy) return 'Unknown'
    const { firstName, lastName, name } = att.uploadedBy
    if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ')
    return name || 'Unknown'
  }

  return (
    <div className="space-y-4">
      {/* Upload dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        {/* eslint-disable-next-line no-restricted-syntax -- hidden native file picker triggered by the styled drop zone above */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />
        <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center ${isDragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload className={`w-5 h-5 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
        </div>
        <p className="text-sm font-medium text-slate-700">
          <span className="text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-slate-400 mt-1">Any file type up to 50MB</p>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{uploadProgress.name}</p>
            <div className="w-full bg-blue-100 rounded-full h-1 mt-1.5">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !attachments?.length ? (
        <div className="text-center py-8">
          <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No files attached yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Chord charts, audio, presentations, and more</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
            >
              {/* File icon */}
              <div className="flex-shrink-0">
                {getFileIcon(att.contentType, att.fileName)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{att.fileName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatFileSize(att.sizeBytes)} · {format(new Date(att.createdAt), 'MMM d, yyyy')} · {getUploaderName(att)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(att.id, att.fileName)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
