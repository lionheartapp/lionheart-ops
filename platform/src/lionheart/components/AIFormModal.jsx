import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Upload, X } from 'lucide-react'
import DrawerModal from './DrawerModal'
import { generateFormWithGemini, generateFormImageWithGemini } from '../services/gemini'
import { createForm } from '../data/formsData'
import { extractDocumentText, renderPdfFirstPageAsImage } from '../utils/extractDocumentText'

export default function AIFormModal({ isOpen, onClose, onFormCreated, users = [] }) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [referenceFile, setReferenceFile] = useState(null)
  const [referenceText, setReferenceText] = useState('')
  const [referenceImageData, setReferenceImageData] = useState(null) // For images or PDFs rendered as image
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const textareaRef = useRef(null)
  const mentionListRef = useRef(null)

  const filteredUsers = users.filter((u) =>
    (u.name || '').toLowerCase().includes((mentionQuery || '').toLowerCase())
  )

  const openMention = (cursorPos) => {
    const text = description
    const beforeCursor = text.slice(0, cursorPos)
    const atIdx = beforeCursor.lastIndexOf('@')
    if (atIdx === -1) {
      setMentionOpen(false)
      return
    }
    const query = beforeCursor.slice(atIdx + 1)
    if (/[\s\n]/.test(query)) {
      setMentionOpen(false)
      return
    }
    setMentionOpen(true)
    setMentionQuery(query)
    setMentionIndex(atIdx)
    setHighlightedIndex(0)
  }

  const closeMention = () => {
    setMentionOpen(false)
    setMentionQuery('')
    setMentionIndex(-1)
  }

  const insertMention = (user) => {
    if (mentionIndex === -1) return
    const before = description.slice(0, mentionIndex)
    const after = description.slice(textareaRef.current?.selectionStart ?? description.length)
    const inserted = `${before}@${user.name} ${after}`
    setDescription(inserted)
    closeMention()
    setTimeout(() => {
      textareaRef.current?.focus()
      const pos = mentionIndex + user.name.length + 2
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value)
    setError(null)
    const pos = e.target.selectionStart
    openMention(pos)
  }

  const handleKeyDown = (e) => {
    if (mentionOpen) {
      if (e.key === 'Escape') {
        closeMention()
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const u = filteredUsers[highlightedIndex]
        if (u) insertMention(u)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filteredUsers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        return
      }
    }
  }

  useEffect(() => {
    if (mentionOpen) {
      setHighlightedIndex(0)
    }
  }, [mentionQuery, mentionOpen])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReferenceFile(file)
    setReferenceText('')
    setReferenceImageData(null)
    setError(null)
    const isImage = /^image\//.test(file.type || '')
    if (isImage) {
      setReferenceImageData({ file }) // Pass File directly to vision
      e.target.value = ''
      return
    }
    const isPdf = (file.name?.toLowerCase() || '').endsWith('.pdf')
    try {
      if (isPdf) {
        const text = await extractDocumentText(file)
        setReferenceText(text)
        if (!text || text.trim().length < 50) {
          const imgData = await renderPdfFirstPageAsImage(file)
          setReferenceImageData(imgData)
        }
      } else {
        const text = await extractDocumentText(file)
        setReferenceText(text)
      }
    } catch (err) {
      setError(err?.message ?? 'Could not read file')
      setReferenceFile(null)
    }
    e.target.value = ''
  }

  const handleGenerate = async () => {
    const text = description.trim()
    if (!text) {
      setError('Please describe what you need.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const imageInput =
        referenceImageData?.file ?? (referenceImageData?.data ? referenceImageData : undefined)
      const { title, description: desc, fields, layout, imagePrompt, submissionType, approverNames } =
        await generateFormWithGemini(text, referenceText || undefined, imageInput, users)
      const newForm = createForm()
      newForm.title = title
      newForm.description = desc
      newForm.fields = fields
      if (layout && layout !== 'default') {
        newForm.layout = layout
      }
      if (submissionType === 'event-request') {
        newForm.submissionType = 'event-request'
      }
      if (approverNames?.length > 0 && users?.length > 0) {
        const approverIds = approverNames
          .map((name) => users.find((u) => (u.name || '').toLowerCase() === name.toLowerCase())?.id)
          .filter(Boolean)
        if (approverIds.length > 0) {
          newForm.approvalWorkflow = { approverIds, type: 'all' }
        }
      }
      if (imagePrompt && (layout === 'header-cover' || layout === 'split')) {
        try {
          const imageDataUrl = await generateFormImageWithGemini(imagePrompt)
          if (imageDataUrl) {
            if (layout === 'header-cover') newForm.headerImage = imageDataUrl
            else newForm.sideImage = imageDataUrl
          }
        } catch (imgErr) {
          // Layout is still applied; user can add image manually
          console.warn('Image generation failed:', imgErr?.message)
        }
      }

      onFormCreated?.(newForm)
      setDescription('')
      setReferenceFile(null)
      setReferenceText('')
      setReferenceImageData(null)
      onClose?.()
    } catch (err) {
      const msg = err?.message ?? 'Something went wrong. Please try again.'
      setError(msg.includes('Gemini API key') || msg.includes('VITE_GEMINI_API_KEY')
        ? "Can't reach AI. Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart."
        : msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Create form with AI">
      <div className="space-y-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Describe what you need—for example: &quot;Event RSVP with name, email, dietary restrictions&quot;. Type @ to mention someone from your team. You can also upload a document for the AI to use as reference.
        </p>

        <div className="relative">
          <label htmlFor="ai-form-desc" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            What do you need?
          </label>
          <textarea
            ref={textareaRef}
            id="ai-form-desc"
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(closeMention, 150)}
            placeholder="e.g. Volunteer form with a header image, or Event RSVP..."
            rows={4}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
          />
          <AnimatePresence>
            {mentionOpen && filteredUsers.length > 0 && (
              <motion.ul
                ref={mentionListRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-10 mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-xl max-h-40 overflow-y-auto min-w-[180px]"
              >
                {filteredUsers.slice(0, 8).map((user, i) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        i === highlightedIndex
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {user.name}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Reference document (optional)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
              <Upload className="w-4 h-4" />
              Upload file
              <input
                type="file"
                accept=".txt,.md,.csv,.json,.pdf,image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {referenceFile && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-sm">
                <span className="truncate flex-1" title={referenceFile.name}>
                  {referenceFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => { setReferenceFile(null); setReferenceText(''); setReferenceImageData(null) }}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            .txt, .md, .csv, .json, .pdf, or images (jpg, png, webp, gif) — AI will analyze the content to build the form
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-amber-600 dark:text-amber-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate form
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </DrawerModal>
  )
}
