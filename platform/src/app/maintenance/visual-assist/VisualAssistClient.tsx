'use client'

import { useState, useRef } from 'react'
import { apiFetch } from '@/lib/apiFetch'

export function VisualAssistClient() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    partName: string
    condition?: string
    manualUrl: string | null
    manualLinked: boolean
    repairSteps: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setResult(null)
    setError(null)
    if (!f) {
      setFile(null)
      return
    }
    if (!f.type.startsWith('image/')) {
      setError('Please select an image (JPEG, PNG, etc.)')
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await apiFetch('/api/maintenance/visual-assist', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
          Upload photo
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Take or select a photo of the broken part. The AI will identify it and provide repair steps.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            <span className="text-lg" aria-hidden>📷</span>
            {file ? 'Change photo' : 'Choose photo'}
          </button>
          {file && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <span className="text-lg" aria-hidden>🖼️</span>
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          )}
        </div>
        {preview && (
          <div className="mt-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 max-w-xs">
            <img src={preview} alt="Upload preview" className="w-full h-auto" />
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
      </section>

      {result && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Results
          </h2>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Identified part
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
              {result.partName}
            </p>
            {result.condition && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{result.condition}</p>
            )}
          </div>

          {result.manualUrl && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Knowledge Base manual
              </p>
              <a
                href={result.manualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <span aria-hidden>↗</span>
                Open manual
              </a>
            </div>
          )}

          {result.repairSteps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span aria-hidden>🔧</span>
                3-step repair summary
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {result.repairSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
