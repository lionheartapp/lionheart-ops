'use client'

import { useState, useRef, useCallback } from 'react'
import { Plus, X, Upload, Link2, Image as ImageIcon } from 'lucide-react'
import { AV_EQUIPMENT_TAGS, DOC_LINK_TYPES } from '@/lib/constants/inventory'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DocLink {
  id: string
  url: string
  title: string
  type: string
}

interface StepDetailsProps {
  manufacturer: string
  model: string
  serialNumbers: string[]
  imageUrl: string | null
  documentationLinks: DocLink[]
  tags: string[]
  onManufacturerChange: (v: string) => void
  onModelChange: (v: string) => void
  onSerialNumbersChange: (v: string[]) => void
  onImageChange: (v: string | null) => void
  onDocumentationLinksChange: (v: DocLink[]) => void
  onTagsChange: (v: string[]) => void
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function StepDetails({
  manufacturer,
  model,
  serialNumbers,
  imageUrl,
  documentationLinks,
  tags,
  onManufacturerChange,
  onModelChange,
  onSerialNumbersChange,
  onImageChange,
  onDocumentationLinksChange,
  onTagsChange,
}: StepDetailsProps) {
  // Serial number input state
  const [serialInput, setSerialInput] = useState('')

  // Doc link input state
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkType, setLinkType] = useState('manual')

  // New tag input state
  const [newTagInput, setNewTagInput] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const inputClass =
    'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus:border-slate-400 transition-colors'

  // ── Serial Numbers ──

  const handleAddSerial = () => {
    const trimmed = serialInput.trim()
    if (!trimmed || serialNumbers.includes(trimmed)) return
    onSerialNumbersChange([...serialNumbers, trimmed])
    setSerialInput('')
  }

  const handleSerialKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSerial()
    }
  }

  const handleRemoveSerial = (sn: string) => {
    onSerialNumbersChange(serialNumbers.filter((s) => s !== sn))
  }

  // ── Image Upload ──

  const handleImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return
      if (file.size > 5 * 1024 * 1024) return // 5MB limit

      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        onImageChange(result)
      }
      reader.readAsDataURL(file)
    },
    [onImageChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleImageFile(file)
    },
    [handleImageFile]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) handleImageFile(file)
          break
        }
      }
    },
    [handleImageFile]
  )

  // ── Documentation Links ──

  const handleAddLink = () => {
    if (!linkUrl.trim() || !linkTitle.trim()) return
    const newLink: DocLink = {
      id: crypto.randomUUID(),
      url: linkUrl.trim(),
      title: linkTitle.trim(),
      type: linkType,
    }
    onDocumentationLinksChange([...documentationLinks, newLink])
    setLinkUrl('')
    setLinkTitle('')
    setLinkType('manual')
  }

  const handleRemoveLink = (id: string) => {
    onDocumentationLinksChange(documentationLinks.filter((l) => l.id !== id))
  }

  // ── Tags ──

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag))
    } else {
      onTagsChange([...tags, tag])
    }
  }

  const handleAddNewTag = () => {
    const trimmed = newTagInput.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    onTagsChange([...tags, trimmed])
    setNewTagInput('')
    setShowNewTag(false)
  }

  return (
    <div className="space-y-8" onPaste={handlePaste}>
      {/* ── Product Details ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Product details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="av-manufacturer" className="block text-sm font-medium text-slate-700 mb-1">
              Manufacturer
            </label>
            <input
              id="av-manufacturer"
              type="text"
              value={manufacturer}
              onChange={(e) => onManufacturerChange(e.target.value)}
              className={inputClass}
              placeholder="e.g., Chauvet, Shure"
            />
          </div>
          <div>
            <label htmlFor="av-model" className="block text-sm font-medium text-slate-700 mb-1">
              Model
            </label>
            <input
              id="av-model"
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className={inputClass}
              placeholder="e.g., COLORado 1-Quad"
            />
          </div>
        </div>

        {/* Serial Numbers */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Serial numbers</label>
          <p className="text-xs text-slate-500 mb-2">
            Add one serial number per item (e.g., 6 speakers = 6 serial numbers).
          </p>

          {/* Existing serials as chips */}
          {serialNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {serialNumbers.map((sn) => (
                <span
                  key={sn}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  {sn}
                  <button
                    type="button"
                    onClick={() => handleRemoveSerial(sn)}
                    className="ml-0.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label={`Remove ${sn}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              onKeyDown={handleSerialKeyDown}
              className={`flex-1 ${inputClass}`}
              placeholder="Enter serial number and press Enter"
            />
            <button
              type="button"
              onClick={handleAddSerial}
              disabled={!serialInput.trim()}
              className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      </section>

      {/* ── Media & Documents ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-slate-900">Media &amp; documents</h3>

        {/* Product Image */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Image</label>
          <p className="text-xs text-slate-500 mb-2">
            Upload an image file or paste an image from your clipboard (Cmd+V / Ctrl+V)
          </p>

          {imageUrl ? (
            <div className="relative w-[200px] h-[200px] rounded-lg overflow-hidden border border-slate-200 group">
              <img
                src={imageUrl}
                alt="Product"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onImageChange(null)}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-10 h-10 text-slate-300" />
              <span className="text-xs text-slate-500">Upload Image</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageFile(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* Documentation */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Documentation</label>
          <p className="text-xs text-slate-500 mb-3">
            Upload files or add links to manuals, specifications, and other documentation
          </p>

          {/* Existing links */}
          {documentationLinks.length > 0 && (
            <div className="space-y-2 mb-3">
              {documentationLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">{link.title}</p>
                    <p className="text-xs text-slate-500 truncate">{link.url}</p>
                  </div>
                  <span className="text-xs text-slate-400 capitalize flex-shrink-0">
                    {DOC_LINK_TYPES.find((t) => t.value === link.type)?.label || link.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove link"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add External Link */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Link2 className="w-4 h-4" /> Add External Link
            </div>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className={inputClass}
              placeholder="Documentation URL (e.g., https://example.com/manual.pdf)"
            />
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className={inputClass}
              placeholder="Title (e.g., User Manual)"
            />
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {DOC_LINK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!linkUrl.trim() || !linkTitle.trim()}
              className="w-full px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Link
            </button>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {AV_EQUIPMENT_TAGS.map((tag) => {
              const isActive = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                  {isActive && (
                    <X className="w-3 h-3 ml-1.5 inline-block" />
                  )}
                </button>
              )
            })}

            {/* Custom tags not in the default list */}
            {tags
              .filter((t) => !AV_EQUIPMENT_TAGS.includes(t as any))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer transition-all"
                >
                  {tag}
                  <X className="w-3 h-3 ml-1.5 inline-block" />
                </button>
              ))}

            {/* New Tag button/input */}
            {showNewTag ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddNewTag()
                    }
                    if (e.key === 'Escape') setShowNewTag(false)
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-full bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 w-28"
                  placeholder="Tag name"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewTag}
                  disabled={!newTagInput.trim()}
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-700 cursor-pointer disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTag(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewTag(true)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New Tag
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
