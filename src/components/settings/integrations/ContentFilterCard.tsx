'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, Settings, X, Shield } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { IntegrationCard, ScopeLabel } from './IntegrationCard'
import { StatusPill } from './StatusPill'
import { formatRelative } from './integration-types'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'

// ─── Platform metadata ──────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; color: string; description: string }> = {
  GOGUARDIAN: {
    label: 'GoGuardian',
    color: '#4285F4',
    description: 'Monitor student browsing activity, manage unblock requests, and receive safety alerts from GoGuardian.',
  },
  SECURLY: {
    label: 'Securly',
    color: '#00BFA5',
    description: 'Receive web filtering alerts, safety flags, and student activity events from Securly.',
  },
  LIGHTSPEED: {
    label: 'Lightspeed',
    color: '#FF6D00',
    description: 'Integrate with Lightspeed Systems for content filtering events and unblock request management.',
  },
  BARK: {
    label: 'Bark',
    color: '#7C3AED',
    description: 'Get safety alerts and content monitoring notifications from Bark for Schools.',
  },
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ContentFilterCardProps {
  provider: 'GOGUARDIAN' | 'SECURLY' | 'LIGHTSPEED' | 'BARK'
  isEnabled: boolean
  lastSyncAt: string | null
  onRefresh: () => void
}

export function ContentFilterCard({ provider, isEnabled, lastSyncAt, onRefresh }: ContentFilterCardProps) {
  const meta = PLATFORM_META[provider]
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showConfig, setShowConfig] = useState(false)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [enabled, setEnabled] = useState(isEnabled)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const configMutation = useMutation({
    mutationFn: async (body: { webhookSecret: string; isEnabled: boolean }) => {
      return fetchApi(`/api/it/content-filters/config/${provider}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-status'] })
      toast(`${meta.label} configuration saved`, 'success')
      setShowConfig(false)
      onRefresh()
    },
    onError: () => {
      toast(`Failed to save ${meta.label} configuration`, 'error')
    },
  })

  const handleCopyWebhook = useCallback(() => {
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') ?? '{orgId}' : '{orgId}'
    const url = `${window.location.origin}/api/it/content-filters/webhook/${provider.toLowerCase()}?org=${orgId}`
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }, [provider])

  const handleSave = () => {
    configMutation.mutate({ webhookSecret, isEnabled: enabled })
  }

  return (
    <IntegrationCard>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            {meta.label.charAt(0)}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">{meta.label}</h3>
            <ScopeLabel scope="Organization" />
          </div>
        </div>
        <StatusPill isConnected={isEnabled} />
      </div>

      {/* Description */}
      <p className="text-[13px] text-slate-500 leading-relaxed flex-grow">
        {meta.description}
      </p>

      {/* Connected state — show last sync + webhook URL */}
      {isEnabled && (
        <>
          <p className="text-xs text-slate-400">Last sync: {formatRelative(lastSyncAt)}</p>

          {/* Webhook URL */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 font-mono truncate">
              /api/it/content-filters/webhook/{provider.toLowerCase()}?org=...
            </div>
            <button
              onClick={handleCopyWebhook}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
              title="Copy webhook URL"
            >
              {copiedUrl ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </>
      )}

      {/* Configure panel */}
      {showConfig && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Configuration</span>
            <button
              onClick={() => setShowConfig(false)}
              className="p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Webhook Secret
            </label>
            <Input
              type="text"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Paste the secret from your provider..."
              size="sm"
            />
          </div>

          <Checkbox
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            label="Enable integration"
            description="Start receiving webhook events from this platform"
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={configMutation.isPending}
              className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {configMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action button */}
      {!showConfig && (
        <button
          onClick={() => setShowConfig(true)}
          className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 cursor-pointer group/btn"
        >
          <Settings className="w-3.5 h-3.5" />
          {isEnabled ? 'Settings' : 'Configure'}
        </button>
      )}
    </IntegrationCard>
  )
}
