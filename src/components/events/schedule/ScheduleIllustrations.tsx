/** Three stacked horizontal bars — represents a single time block */
export function BlockIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1.5 w-full rounded-full bg-blue-400" />
      <div className="h-1 w-3/4 rounded-full bg-slate-200" />
      <div className="h-1 w-1/2 rounded-full bg-slate-200" />
    </div>
  )
}

/** Multiple stacked rows inside a folder — represents a sequential section */
export function SectionIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1 w-10 rounded-full bg-slate-300" />
      <div className="flex flex-col gap-0.5 pl-1.5">
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-green-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-amber-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 rounded-full bg-purple-400 flex-shrink-0" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

/** 2x2 card grid — represents a parallel / breakout section */
export function BreakoutIllustration() {
  return (
    <div className="w-full flex flex-col gap-1 px-1">
      <div className="h-1 w-10 rounded-full bg-indigo-300" />
      <div className="grid grid-cols-2 gap-1 pl-1.5">
        {[
          'bg-blue-400',
          'bg-green-400',
          'bg-amber-400',
          'bg-purple-400',
        ].map((color) => (
          <div key={color} className="rounded bg-slate-100 border border-slate-200/60 p-0.5">
            <div className={`h-0.5 w-3 rounded-full ${color} mb-0.5`} />
            <div className="h-0.5 w-full rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
