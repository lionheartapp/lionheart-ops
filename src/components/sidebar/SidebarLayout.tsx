'use client'

// Menu and X icons no longer needed — mobile nav replaced by MobileTabBar

interface SidebarLayoutProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  secondaryOpen: boolean
  secondaryLabel: string
  mainNavContent: React.ReactNode
  secondaryContent: React.ReactNode | null
}

export default function SidebarLayout({
  isOpen,
  setIsOpen,
  secondaryOpen,
  secondaryLabel,
  mainNavContent,
  secondaryContent,
}: SidebarLayoutProps) {
  return (
    <>
      {/* Mobile Menu Toggle — hidden; replaced by MobileTabBar */}

      {/* Mobile Overlay — hidden; replaced by MobileTabBar */}

      {/* Desktop Layout: Main Nav + Secondary Nav.
          `top` + `height` read a CSS variable set by TrialBanner so the
          sidebar slides down out of the way when the trial banner is
          visible instead of being covered by it. */}
      <div
        className={`hidden lg:flex fixed left-0 z-sticky transition-shadow duration-300 ${secondaryOpen ? 'shadow-[4px_0_24px_-4px_rgba(100,116,139,0.18)]' : ''}`}
        style={{
          top: 'var(--trial-banner-h, 0px)',
          height: 'calc(100vh - var(--trial-banner-h, 0px))',
        }}
      >
        <aside
          className="flex flex-col w-64 h-full relative z-10"
          style={{
            background: 'rgba(253, 252, 249, 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRight: secondaryOpen ? 'none' : '1px solid rgba(17, 15, 10, 0.06)',
            color: '#1a1915',
          }}
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        <aside
          className={`flex flex-col w-60 h-full transition-[max-width,opacity] duration-300 ease-in-out overflow-hidden ${
            secondaryOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          style={{
            background: 'rgba(248, 247, 244, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRight: secondaryOpen ? '1px solid rgba(17, 15, 10, 0.06)' : 'none',
            borderLeft: secondaryOpen ? '1px solid rgba(17, 15, 10, 0.04)' : 'none',
            color: '#1a1915',
          }}
          aria-label={secondaryLabel}
          aria-hidden={!secondaryOpen}
        >
          <div className="w-60 h-full">
            {secondaryContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar — hidden; replaced by MobileTabBar */}

      {/* Spacer for desktop layout */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out ${
          secondaryOpen ? 'w-[496px]' : 'w-[256px]'
        }`}
      />
    </>
  )
}
