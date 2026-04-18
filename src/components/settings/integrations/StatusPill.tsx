'use client'

export function StatusPill({ isConnected, label }: { isConnected: boolean; label?: string }) {
  const text = label || (isConnected ? 'Connected' : 'Not connected')
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
        isConnected
          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
          : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
      />
      {text}
    </span>
  )
}
