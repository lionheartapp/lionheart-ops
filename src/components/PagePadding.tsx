import { ReactNode } from 'react'

/** Standard content padding for dashboard pages. */
export default function PagePadding({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col min-h-full pl-4 pr-4 sm:px-10 pt-6 lg:pt-8 pb-10">
      {children}
    </div>
  )
}
