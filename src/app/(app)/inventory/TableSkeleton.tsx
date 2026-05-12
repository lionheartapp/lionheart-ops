'use client'

export default function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-slate-200 rounded w-1/6" />
          <div className="h-4 bg-slate-200 rounded w-1/8" />
          <div className="h-4 bg-slate-200 rounded w-12" />
          <div className="h-4 bg-slate-200 rounded w-12" />
          <div className="h-6 bg-slate-200 rounded-full w-20" />
          <div className="h-8 bg-slate-200 rounded-lg w-20 ml-auto" />
        </div>
      ))}
    </div>
  )
}
