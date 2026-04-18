'use client'

/** Shared card wrapper with hover effect. */
export function IntegrationCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-4 h-full transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/80 hover:-translate-y-0.5">
      {children}
    </div>
  )
}

/** Scope label (org-level vs personal). */
export function ScopeLabel({ scope }: { scope: string }) {
  return (
    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{scope}</span>
  )
}
