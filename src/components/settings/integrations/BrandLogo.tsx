'use client'

/** Brand logo rendered at native size inside a soft container. */
export function BrandLogo({ src, alt, size = 40 }: { src: string; alt: string; size?: number }) {
  return (
    <div
      className="rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, padding: size * 0.15 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </div>
  )
}
