'use client'

import { useState } from 'react'
import { Shield, Settings, ExternalLink, Info } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITMdmConfigSectionProps {
  canManage: boolean
}

// ─── MDM Provider Cards ─────────────────────────────────────────────────

const MDM_PROVIDERS = [
  {
    id: 'jamf',
    name: 'Jamf Pro',
    description: 'Apple device management platform for Mac, iPad, iPhone, and Apple TV.',
    logo: '🍎',
    features: ['Enrollment', 'App deployment', 'Policies', 'Patch management'],
    docsUrl: 'https://docs.jamf.com',
  },
  {
    id: 'mosyle',
    name: 'Mosyle',
    description: 'Apple MDM solution for K-12 education with classroom tools.',
    logo: '📱',
    features: ['Enrollment', 'Classroom tools', 'App management', 'Content filtering'],
    docsUrl: 'https://manager.mosyle.com',
  },
  {
    id: 'intune',
    name: 'Microsoft Intune',
    description: 'Microsoft endpoint management for Windows, iOS, Android, and macOS devices.',
    logo: '🪟',
    features: ['Enrollment', 'Compliance policies', 'App deployment', 'Conditional access'],
    docsUrl: 'https://learn.microsoft.com/en-us/mem/intune/',
  },
] as const

// ─── Component ──────────────────────────────────────────────────────────

export default function ITMdmConfigSection({ canManage }: ITMdmConfigSectionProps) {
  const [tooltipId, setTooltipId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-slate-700" />
        <h3 className="text-sm font-semibold text-slate-900">
          Mobile Device Management (MDM)
        </h3>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Connect your MDM provider to automatically sync device enrollment, push policies, and manage
        apps across your fleet.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MDM_PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className="ui-glass p-5 opacity-75 hover:opacity-90 transition-opacity duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl border border-slate-100">
                  {provider.logo}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {provider.name}
                  </h4>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">
                    Not Connected
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              {provider.description}
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {provider.features.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100"
                >
                  {feature}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onMouseEnter={() => setTooltipId(provider.id)}
                  onMouseLeave={() => setTooltipId(null)}
                  onClick={() => setTooltipId(tooltipId === provider.id ? null : provider.id)}
                  disabled={!canManage}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-500 text-xs font-medium cursor-not-allowed"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure
                </button>

                {/* Tooltip */}
                {tooltipId === provider.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap">
                    <div className="ui-glass-dropdown px-3 py-2 text-xs text-slate-600 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      Coming soon — requires API credentials
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 border-r border-b border-slate-200/30 transform rotate-45 -mt-1" />
                  </div>
                )}
              </div>

              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Docs
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
