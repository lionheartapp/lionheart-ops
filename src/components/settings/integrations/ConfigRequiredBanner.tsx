'use client'

import { Info } from 'lucide-react'

export function ConfigRequiredBanner({ serviceName }: { serviceName: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-sm text-amber-800 backdrop-blur-sm">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
      <span>
        <strong className="font-semibold">Configuration Required</strong> — Contact your administrator to set up {serviceName} API credentials in the server environment.
      </span>
    </div>
  )
}
