'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useAnnouncements, useDeleteAnnouncement } from '@/lib/hooks/useEventComms'
import { useToast } from '@/components/Toast'
import { listItem, staggerContainer } from '@/lib/animations'
import type { EventAnnouncementWithAuthor, AnnouncementAudience } from '@/lib/types/events-phase21'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const AUDIENCE_LABELS: Record<AnnouncementAudience, { label: string; style: string }> = {
  ALL: { label: 'All Registrants', style: 'bg-blue-100 text-blue-700' },
  GROUP: { label: 'Group', style: 'bg-purple-100 text-purple-700' },
  INCOMPLETE_DOCS: { label: 'Incomplete Docs', style: 'bg-amber-100 text-amber-700' },
  PAID_ONLY: { label: 'Paid Only', style: 'bg-green-100 text-green-700' },
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse bg-white border border-slate-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single Announcement Card ─────────────────────────────────────────────────

interface AnnouncementCardProps {
  announcement: EventAnnouncementWithAuthor
  onDelete: (id: string) => void
  isDeleting: boolean
}

function AnnouncementCard({ announcement, onDelete, isDeleting }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const BODY_PREVIEW_CHARS = 160
  const needsTruncation = announcement.body.length > BODY_PREVIEW_CHARS
  const displayBody = needsTruncation && !expanded
    ? announcement.body.slice(0, BODY_PREVIEW_CHARS) + '…'
    : announcement.body

  const audienceInfo = AUDIENCE_LABELS[announcement.audience]
  const audienceLabel = announcement.audience === 'GROUP' && announcement.targetGroupName
    ? `${audienceInfo.label}: ${announcement.targetGroupName}`
    : audienceInfo.label

  // Avatar initials fallback
  const initials = announcement.authorName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <motion.div
      variants={listItem}
      className="bg-white border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Author avatar */}
        {announcement.authorAvatar ? (
          <img
            src={announcement.authorAvatar}
            alt={announcement.authorName}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 truncate">{announcement.title}</h4>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                <span className="text-xs text-slate-500">{announcement.authorName}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400">{formatRelativeTime(announcement.createdAt)}</span>
              </div>
            </div>
            {/* Delete button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Delete announcement"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Audience badge */}
          <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${audienceInfo.style}`}>
            {audienceLabel}
          </span>

          {/* Body */}
          <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{displayBody}</p>

          {/* Read more / less toggle */}
          {needsTruncation && (
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="flex items-center gap-1 mt-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Read more
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm inline */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">Delete this announcement?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(announcement.id)
                    setShowDeleteConfirm(false)
                  }}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface AnnouncementFeedProps {
  eventProjectId: string
}

export function AnnouncementFeed({ eventProjectId }: AnnouncementFeedProps) {
  const { toast } = useToast()
  const { data: announcements = [], isLoading } = useAnnouncements(eventProjectId)
  const deleteMutation = useDeleteAnnouncement(eventProjectId)

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to delete announcement', 'error')
      },
    })
  }

  if (isLoading) return <FeedSkeleton />

  if (announcements.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
          <Megaphone className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No announcements sent yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Use the form above to send your first announcement.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-3"
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
    >
      {announcements.map((ann) => (
        <AnnouncementCard
          key={ann.id}
          announcement={ann}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending && deleteMutation.variables === ann.id}
        />
      ))}
    </motion.div>
  )
}
