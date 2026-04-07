'use client'

import { Menu, X } from 'lucide-react'

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
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-mobilenav p-2 min-h-[44px] min-w-[44px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-slate-700" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6 text-slate-700" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-navbar cursor-pointer"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Desktop Layout: Main Nav + Secondary Nav */}
      <div className={`hidden lg:flex fixed left-0 top-0 h-screen z-sticky transition-shadow duration-300 ${secondaryOpen ? 'shadow-[4px_0_24px_-4px_rgba(100,116,139,0.18)]' : ''}`}>
        <aside
          className="flex flex-col w-64 text-slate-700 h-full relative z-10"
          style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: secondaryOpen ? 'none' : '1px solid rgba(200, 210, 225, 0.5)' }}
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        <aside
          className={`flex flex-col w-60 h-full transition-[max-width,opacity] duration-300 ease-in-out overflow-hidden ${
            secondaryOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          style={{ background: 'rgba(245, 247, 250, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: secondaryOpen ? '1px solid rgba(200, 210, 225, 0.5)' : 'none', borderLeft: secondaryOpen ? '1px solid rgba(200, 210, 225, 0.3)' : 'none' }}
          aria-label={secondaryLabel}
          aria-hidden={!secondaryOpen}
        >
          <div className="w-60 h-full">
            {secondaryContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-[85vw] max-w-[320px] text-slate-700 flex flex-col transition-transform duration-300 z-navbar ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255, 255, 255, 0.55)' }}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {mainNavContent}
        {secondaryOpen && secondaryContent && (
          <div className="flex-1 overflow-y-auto border-t border-slate-200/30">
            {secondaryContent}
          </div>
        )}
      </aside>

      {/* Spacer for desktop layout */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out ${
          secondaryOpen ? 'w-[496px]' : 'w-[256px]'
        }`}
      />
    </>
  )
}
