'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, Download, ExternalLink, Copy, Check, MoreVertical, X } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface AttachmentPreviewProps {
  attachment: {
    id: string
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

// ---------------------------------------------------------------------------
// Image action toolbar
// ---------------------------------------------------------------------------

function ImageActions({ url, fileName }: { url: string; fileName: string }) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const handleCopyLink = () => {
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setShowMenu(false)
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.click()
    setShowMenu(false)
  }

  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
      <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/60 p-0.5">
        <button
          type="button"
          onClick={handleDownload}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            title="More"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors text-left"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                {copied ? 'Copied!' : 'Copy link to file'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors text-left"
              >
                <Download className="w-4 h-4 text-slate-400" />
                Download
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                onClick={() => setShowMenu(false)}
              >
                <ExternalLink className="w-4 h-4 text-slate-400" />
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image lightbox modal
// ---------------------------------------------------------------------------

function ImageLightbox({
  src,
  fileName,
  fileSize,
  onClose,
  onDownload,
}: {
  src: string
  fileName: string
  fileSize: number
  onClose: () => void
  onDownload: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isZoomedIn = zoomed

  const zoomIn = useCallback(() => {
    setZoomed(true)
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 })
  }, [])
  const zoomOut = useCallback(() => setZoomed(false), [])
  const resetZoom = useCallback(() => setZoomed(false), [])
  const zoom = zoomed ? 1 : 1 // kept for percent display

  // Toggle zoom on image click
  const handleImageClick = useCallback(() => {
    if (isZoomedIn) zoomOut()
    else zoomIn()
  }, [isZoomedIn, zoomOut, zoomIn])

  // Keyboard: Escape to close, +/- to zoom
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === '=' || e.key === '+') zoomIn()
      if (e.key === '-') zoomOut()
      if (e.key === '0') resetZoom()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, zoomIn, zoomOut, resetZoom])

  const cursorStyle = isZoomedIn ? 'zoom-out' : 'zoom-in'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-5 py-3 shrink-0">
        <div className="text-white min-w-0">
          <p className="text-sm font-medium truncate max-w-[300px]">{fileName}</p>
          <p className="text-xs text-white/50">{formatFileSize(fileSize)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDownload}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area — scrollable when zoomed in */}
      <div
        ref={scrollRef}
        className={`relative z-10 flex-1 min-h-0 overflow-auto ${isZoomedIn ? '' : 'flex items-center justify-center'}`}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <OptimizedImage
          src={src}
          alt={fileName}
          draggable={false}
          onClick={handleImageClick}
          className="select-none"
          style={{
            cursor: cursorStyle,
            width: isZoomedIn ? '100%' : undefined,
            maxWidth: isZoomedIn ? 'none' : '90vw',
            maxHeight: isZoomedIn ? 'none' : '80vh',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Bottom zoom controls */}
      <div className="relative z-20 flex items-center justify-center py-3 shrink-0">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
          <button
            type="button"
            onClick={resetZoom}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Fit to screen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <div className="w-px h-4 bg-white/20" />

          <button
            type="button"
            onClick={zoomOut}
            disabled={!isZoomedIn}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>

          <span className="text-xs text-white/60 w-14 text-center">{isZoomedIn ? 'Full width' : 'Fit'}</span>

          <button
            type="button"
            onClick={zoomIn}
            disabled={isZoomedIn}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom in"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const { id, fileName, fileSize, mimeType, storageUrl } = attachment
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const [imgError, setImgError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Use the signed proxy URL for serving files
  const proxyUrl = `/api/messaging/attachments/${id}`

  const handleDownload = useCallback(() => {
    const a = document.createElement('a')
    a.href = proxyUrl
    a.download = fileName
    a.target = '_blank'
    a.click()
  }, [proxyUrl, fileName])

  // Image: inline preview with hover actions
  if (isImage && !imgError) {
    return (
      <>
        <div className="group/img relative inline-block mt-2">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block cursor-pointer"
          >
            <OptimizedImage
              src={proxyUrl}
              alt={fileName}
              loading="lazy"
              onError={() => setImgError(true)}
              className="max-w-[360px] max-h-[240px] rounded-lg border border-slate-200 object-cover"
            />
          </button>
          <ImageActions url={proxyUrl} fileName={fileName} />
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate max-w-[200px]">{fileName}</span>
            <span>{formatFileSize(fileSize)}</span>
          </div>
        </div>
        {lightboxOpen && (
          <ImageLightbox
            src={proxyUrl}
            fileName={fileName}
            fileSize={fileSize}
            onClose={() => setLightboxOpen(false)}
            onDownload={handleDownload}
          />
        )}
      </>
    )
  }

  // Fallback for broken images
  if (isImage && imgError) {
    return (
      <div className="group/img relative mt-2">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-[300px]">
          <Download className="w-6 h-6 text-slate-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 truncate">{fileName}</p>
            <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
          </div>
        </div>
        <ImageActions url={proxyUrl} fileName={fileName} />
      </div>
    )
  }

  // PDF: file card
  if (isPdf) {
    return (
      <a
        href={proxyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-[300px] hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 truncate">{fileName}</p>
          <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
        </div>
        <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </a>
    )
  }

  // Generic file
  return (
    <a
      href={proxyUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex items-center gap-3 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 max-w-[300px] hover:bg-slate-100 transition-colors cursor-pointer"
    >
      <Download className="w-6 h-6 text-slate-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 truncate">{fileName}</p>
        <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
      </div>
    </a>
  )
}
