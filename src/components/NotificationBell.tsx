'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Calendar, UserPlus, CheckCircle, XCircle, Trash2, X } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'
import { badgePop } from '@/lib/animations'

interface NotificationData {
  id: string
  type: string
  title: string
  body?: string | null
  linkUrl?: string | null
  isRead: boolean
  createdAt: string
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'event_updated':
      return <Calendar className="w-4 h-4 text-blue-500" />
    case 'event_deleted':
      return <Trash2 className="w-4 h-4 text-red-500" />
    case 'event_invite':
      return <UserPlus className="w-4 h-4 text-green-500" />
    case 'event_approved':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />
    case 'event_rejected':
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <Bell className="w-4 h-4 text-slate-500" />
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = Math.max(0, now - date)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
}

/** Notification drawer — slides in from the right, controlled by parent */
export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const [shouldShow, setShouldShow] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Notification list — only fetch when drawer is open
  const { data: listData } = useQuery<{ notifications: NotificationData[]; nextCursor: string | null }>({
    queryKey: queryKeys.notifications.all,
    queryFn: () => fetchApi('/api/notifications?limit=20'),
    enabled: isOpen,
    staleTime: 15_000,
  })
  const notifications = listData?.notifications ?? []

  // Mark single as read
  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/notifications/${id}/read`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
    },
  })

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: () =>
      fetchApi('/api/notifications/read-all', { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
    },
  })

  const unreadInList = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }

    if (isOpen) {
      setIsAnimating(true)
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflowY = 'hidden'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShouldShow(true))
      })
    } else if (isAnimating) {
      setShouldShow(false)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflowY = 'unset'
    }
  }, [isOpen, isAnimating])

  const handleClose = useCallback(() => {
    setShouldShow(false)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 300)
  }, [onClose])

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id)
    }
    if (notification.linkUrl) {
      window.location.href = notification.linkUrl
    }
    handleClose()
  }

  if (!isOpen && !isAnimating) return null

  return createPortal(
    <div className="fixed inset-0 z-modal overflow-hidden" role="presentation" aria-hidden={!isOpen}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 cursor-pointer ${shouldShow ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        role="presentation"
      />

      {/* Drawer — right side slide */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:w-96 bg-white flex flex-col transition-transform duration-300 ease-out z-modal sm:rounded-2xl border border-slate-200 shadow-xl ${
          shouldShow ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-labelledby="notification-drawer-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h2 id="notification-drawer-title" className="text-xs text-slate-400 uppercase tracking-wide font-medium">
            Notifications
          </h2>
          <div className="flex items-center gap-2">
            {unreadInList > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Notification list — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-6 py-4 flex items-start gap-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset cursor-pointer ${
                  !n.isRead ? 'bg-primary-50/40' : ''
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.isRead ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-3">
          <span className="text-xs text-slate-400">
            {notifications.length === 0 ? "You're all caught up" : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Unread badge hook — returns the unread count, refreshes on window focus */
export function useUnreadCount() {
  const { data } = useQuery<{ count: number }>({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => fetchApi('/api/notifications/unread-count'),
    staleTime: 60_000,
  })
  return data?.count ?? 0
}

/** The bell icon with unread badge — render wherever you need the trigger */
export function NotificationBellIcon({ unreadCount, className }: { unreadCount: number; className?: string }) {
  return (
    <span className="relative inline-flex overflow-visible">
      <Bell className={className || 'w-5 h-5 text-slate-800'} />
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            key="badge"
            variants={badgePop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Legacy default export — self-contained bell button + dropdown (kept for backward compatibility) */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = useUnreadCount()

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg hover:bg-white/30 transition"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <NotificationBellIcon unreadCount={unreadCount} />
      </button>
      <NotificationDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
