'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  LogOut,
  HelpCircle,
  Eye,
  MoreVertical,
} from 'lucide-react'

interface UserMenuProps {
  userName: string
  userEmail: string
  userAvatar?: string
  isSuperAdmin: boolean
  isImpersonating: boolean
  onSettingsClick: () => void
  onLogout?: () => void
  onBugDialogOpen: () => void
  onViewAsOpen: () => void
  setIsOpen: (open: boolean) => void
}

export default function UserMenu({
  userName,
  userEmail,
  userAvatar,
  isSuperAdmin,
  isImpersonating,
  onSettingsClick,
  onLogout,
  onBugDialogOpen,
  onViewAsOpen,
  setIsOpen,
}: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div className="pb-3 px-3">
      <div className="mx-3 mb-4 border-t border-slate-200/40" />
      <div className="relative" ref={menuRef}>
        <div className="flex items-center gap-3 px-3 py-2 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold overflow-hidden text-sm flex-shrink-0 ring-2 ring-white/50">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          </div>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/30 hover:text-slate-700 transition-colors duration-200 cursor-pointer flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            aria-label="User menu"
            title="More options"
          >
            <MoreVertical className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onSettingsClick()
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
              >
                <Settings className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                Settings
              </button>

              {isSuperAdmin && !isImpersonating && (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onViewAsOpen()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                >
                  <Eye className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  View As
                </button>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false)
                  onBugDialogOpen()
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                Help & Support
              </button>

              <div className="border-t border-slate-100 my-1" />

              <button
                onClick={() => {
                  setMenuOpen(false)
                  onLogout?.()
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 cursor-pointer"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                Log Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
