'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Search } from 'lucide-react'
import { useMobileHeader } from './MobileHeaderContext'
import { haptic } from '@/lib/haptics'

interface MobileHeaderProps {
  onSearchOpen?: () => void
  userAvatar?: string | null
  userName?: string
}

export default function MobileHeader({
  onSearchOpen,
  userAvatar,
  userName,
}: MobileHeaderProps) {
  const router = useRouter()
  const { config } = useMobileHeader()

  const handleBack = () => {
    haptic('light')
    if (config.onBack) {
      config.onBack()
    } else {
      router.back()
    }
  }

  return (
    <header
      className="mobile-header lg:hidden fixed top-0 inset-x-0 z-navbar flex items-end"
      style={{
        height: 'calc(44px + var(--safe-area-top))',
        paddingTop: 'var(--safe-area-top)',
        background: 'rgba(253, 252, 249, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(17, 15, 10, 0.06)',
      }}
    >
      <div className="flex items-center justify-between w-full h-11 px-2">
        {/* Left: Back button or avatar */}
        <div className="flex items-center min-w-[44px]">
          {config.showBack ? (
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer hover:bg-slate-100/60 active:bg-slate-200/60 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-primary-500" />
            </button>
          ) : (
            /* Small avatar in header when on main tab pages */
            <div className="flex items-center justify-center w-8 h-8 ml-1 rounded-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-semibold">
                  {(userName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Title */}
        <h1 className="text-base font-semibold text-slate-900 truncate max-w-[200px] text-center">
          {config.title}
        </h1>

        {/* Right: Actions or search */}
        <div className="flex items-center min-w-[44px] justify-end">
          {config.rightActions || (
            <button
              onClick={onSearchOpen}
              className="flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer hover:bg-slate-100/60 active:bg-slate-200/60 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
