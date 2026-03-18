'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import { Link2, Copy, Check, Loader2, Clock, School } from 'lucide-react'

interface School {
  id: string
  name: string
}

interface GeneratedLink {
  token: string
  url: string
  expiresAt: string
}

export default function ITMagicLinksTab() {
  const [expiresInHours, setExpiresInHours] = useState('8')
  const [schoolId, setSchoolId] = useState('')
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-magic-links'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
    },
    staleTime: 5 * 60_000,
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        expiresInHours: parseInt(expiresInHours) || 8,
      }
      if (schoolId) body.schoolId = schoolId

      const res = await fetch('/api/it/magic-links', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to generate link')
      }
      return res.json()
    },
    onSuccess: (data) => {
      const linkData = data.data as GeneratedLink
      // Build full URL
      const fullUrl = `${window.location.origin}${linkData.url}`
      setGeneratedLink({ ...linkData, url: fullUrl })
    },
  })

  const handleCopy = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = generatedLink.url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Magic Links</h3>
            <p className="text-xs text-slate-500">Generate one-time links for substitute teachers to submit IT requests</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Link expires in
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="4">4 hours</option>
              <option value="8">8 hours (1 school day)</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="120">5 days</option>
            </select>
          </div>

          {/* School */}
          {schools.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <School className="w-3.5 h-3.5 inline mr-1" />
                Campus (optional)
              </label>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
              >
                <option value="">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 transition-all"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Generate Link
          </button>
        </div>

        {generateMutation.isError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {generateMutation.error instanceof Error ? generateMutation.error.message : 'Failed to generate link'}
          </div>
        )}
      </div>

      {/* Generated link display */}
      {generatedLink && (
        <div className="ui-glass p-6 border-blue-200 bg-blue-50/30">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-900">Link generated!</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            This link will only be shown once. Copy it now and share with the substitute teacher.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink.url}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-2">
            Expires: {new Date(generatedLink.expiresAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="ui-glass p-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-2">How it works</h4>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Generate a magic link above</li>
          <li>Share the link with the substitute teacher (print, email, or post in the classroom)</li>
          <li>The sub opens the link and fills out the IT request form — no login required</li>
          <li>The ticket appears in your IT Help Desk board automatically</li>
        </ol>
      </div>
    </div>
  )
}
