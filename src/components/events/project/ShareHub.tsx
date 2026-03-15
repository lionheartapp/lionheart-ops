'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useToast } from '@/components/Toast'
import {
  Link2,
  Copy,
  Download,
  QrCode,
  Calendar,
  Users,
  Palette,
  ExternalLink,
  CheckCheck,
  Clock,
  Check,
} from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ShareConfig {
  shareUrl: string
  qrCodeSvg: string
  qrCodeDataUrl: string
  openAt: string | null
  closeAt: string | null
  maxCapacity: number | null
  waitlistEnabled: boolean
  brandingOverride: Record<string, unknown> | null
  registeredCount: number
  waitlistedCount: number
  isOpen: boolean
}

interface ShareHubProps {
  eventProjectId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function getOpenStatus(config: ShareConfig): { label: string; color: string } {
  const now = new Date()
  if (config.openAt && now < new Date(config.openAt)) {
    const openDate = new Date(config.openAt)
    const formatted = openDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label: `Opens ${formatted}`, color: 'text-amber-600 bg-amber-50' }
  }
  if (config.closeAt && now > new Date(config.closeAt)) {
    return { label: 'Registration Closed', color: 'text-red-600 bg-red-50' }
  }
  return { label: 'Open', color: 'text-green-600 bg-green-50' }
}

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.div variants={listItem} className="ui-glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ShareHub({ eventProjectId }: ShareHubProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // ─── Fetch share config ──────────────────────────────────────────────────────

  const { data: configData, isLoading, isError } = useQuery({
    queryKey: ['share-config', eventProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/events/projects/${eventProjectId}/share`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? 'Failed to load share config')
      }
      const body = await res.json() as { data: ShareConfig }
      return body.data
    },
  })

  // Initialize local state from fetched data (once only)
  useEffect(() => {
    if (configData && !initialized) {
      setOpenAt(formatDatetimeLocal(configData.openAt))
      setCloseAt(formatDatetimeLocal(configData.closeAt))
      setMaxCapacity(configData.maxCapacity != null ? String(configData.maxCapacity) : '')
      setWaitlistEnabled(configData.waitlistEnabled)
      setInitialized(true)
    }
  }, [configData, initialized])

  // ─── Save window mutation ───────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      openAt?: string | null
      closeAt?: string | null
      maxCapacity?: number | null
      waitlistEnabled?: boolean
    }) => {
      const res = await fetch(`/api/events/projects/${eventProjectId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? 'Failed to save')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-config', eventProjectId] })
      toast('Registration settings saved', 'success')
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to save settings', 'error')
    },
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleCopyLink() {
    if (!configData?.shareUrl) return
    navigator.clipboard.writeText(configData.shareUrl)
      .then(() => {
        setCopied(true)
        toast('Link copied to clipboard', 'success')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast('Failed to copy link', 'error'))
  }

  function handleDownloadQR() {
    if (!configData?.qrCodeDataUrl) return
    const link = document.createElement('a')
    link.href = configData.qrCodeDataUrl
    link.download = 'registration-qr.png'
    link.click()
  }

  function handleSaveWindow() {
    saveMutation.mutate({
      openAt: openAt ? new Date(openAt).toISOString() : null,
      closeAt: closeAt ? new Date(closeAt).toISOString() : null,
    })
  }

  function handleSaveCapacity() {
    saveMutation.mutate({
      maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
      waitlistEnabled,
    })
  }

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-5 h-32 rounded-2xl bg-gray-100" />
        ))}
      </div>
    )
  }

  // ─── Registration not set up ───────────────────────────────────────────────

  if (isError || !configData) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="text-center py-12"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
          <QrCode className="w-6 h-6 text-indigo-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Registration Not Set Up</h3>
        <p className="text-sm text-gray-500">
          Create a registration form in the Registration tab first.
        </p>
      </motion.div>
    )
  }

  const statusBadge = getOpenStatus(configData)
  const capacityPct = configData.maxCapacity
    ? Math.min(100, Math.round((configData.registeredCount / configData.maxCapacity) * 100))
    : null

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Share Link */}
      <SectionCard icon={<Link2 className="w-4 h-4" />} title="Share Link">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-mono truncate">
            {configData.shareUrl}
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            {copied ? (
              <><CheckCheck className="w-4 h-4" /> Copied</>
            ) : (
              <><Copy className="w-4 h-4" /> Copy</>
            )}
          </button>
        </div>

        {/* Registration status badge */}
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {statusBadge.label}
        </span>
      </SectionCard>

      {/* QR Code */}
      <SectionCard icon={<QrCode className="w-4 h-4" />} title="QR Code for Flyers">
        <div className="flex items-start gap-4">
          <div
            className="w-28 h-28 flex-shrink-0 p-2 bg-white border border-gray-200 rounded-xl"
            dangerouslySetInnerHTML={{ __html: configData.qrCodeSvg }}
          />
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-3">
              Print this QR code on flyers, posters, and handouts. Parents can scan it to go directly to the registration page.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDownloadQR}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer w-fit"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <a
                href={configData.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer w-fit"
              >
                <ExternalLink className="w-4 h-4" />
                Preview Public Page
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Registration Window */}
      <SectionCard icon={<Calendar className="w-4 h-4" />} title="Registration Window">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Opens
            </label>
            <input
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Closes
            </label>
            <input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 transition-all"
            />
          </div>
        </div>
        <button
          onClick={handleSaveWindow}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Window'}
        </button>
      </SectionCard>

      {/* Capacity */}
      <SectionCard icon={<Users className="w-4 h-4" />} title="Capacity">
        {/* Progress bar */}
        {configData.maxCapacity && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{configData.registeredCount} registered</span>
              <span>{configData.maxCapacity} max</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${capacityPct}%`,
                  background: capacityPct && capacityPct >= 90
                    ? 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                    : 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                }}
              />
            </div>
            {configData.waitlistedCount > 0 && (
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {configData.waitlistedCount} on waitlist
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Max Capacity</label>
            <input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              min={1}
              placeholder="Unlimited"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <button
              role="switch"
              aria-checked={waitlistEnabled}
              onClick={() => setWaitlistEnabled(!waitlistEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${waitlistEnabled ? 'bg-indigo-500' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${waitlistEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className="text-xs text-gray-600">Waitlist</span>
          </div>
        </div>

        <button
          onClick={handleSaveCapacity}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Capacity'}
        </button>
      </SectionCard>

      {/* Branding */}
      <SectionCard icon={<Palette className="w-4 h-4" />} title="Branding">
        <p className="text-xs text-gray-500 mb-3">
          The public registration page uses your organization logo and colors by default.
          Custom overrides coming in a future release.
        </p>
        <a
          href={configData.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer w-fit"
        >
          <ExternalLink className="w-4 h-4" />
          View Public Page
        </a>
      </SectionCard>
    </motion.div>
  )
}
