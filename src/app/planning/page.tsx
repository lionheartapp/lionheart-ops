'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Plus, ChevronDown } from 'lucide-react'
import { IllustrationCalendar } from '@/components/illustrations/IllustrationCalendar'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import PlanningSubmissionForm from '@/components/planning/PlanningSubmissionForm'
import MySubmissions from '@/components/planning/MySubmissions'
import PlanningSeasonAdmin from '@/components/planning/PlanningSeasonAdmin'
import CommentThread from '@/components/planning/CommentThread'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { useSeasons, useCreateSeason, useSubmissions, useCreateSubmission, useSubmitSubmission, useComments, useAddComment } from '@/lib/hooks/usePlanningSeason'
import type { PlanningSubmission } from '@/lib/hooks/usePlanningSeason'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function PlanningPage() {
  usePageTitle('Calendar Planning')
  const router = useRouter()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const [orgLogoUrl] = useState<string | null>(typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null)

  const isAdmin = userRole ? (userRole.toLowerCase().includes('admin') || userRole.toLowerCase().includes('super')) : false

  const { data: seasons = [], isLoading: seasonsLoading } = useSeasons()
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)

  // Auto-select: prefer first non-CLOSED season, else first season
  const defaultSeasonId = seasons.find((s) => s.phase !== 'CLOSED')?.id || seasons[0]?.id || null
  const effectiveSeasonId = selectedSeasonId && seasons.some((s) => s.id === selectedSeasonId)
    ? selectedSeasonId
    : defaultSeasonId
  const activeSeason = seasons.find((s) => s.id === effectiveSeasonId) || null

  const { data: mySubmissions = [] } = useSubmissions(activeSeason?.id || null)
  const createSubmission = useCreateSubmission()
  const createSeason = useCreateSeason()
  const submitSubmission = useSubmitSubmission()
  const addComment = useAddComment()

  const [showForm, setShowForm] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<PlanningSubmission | null>(null)

  // Create season form state (admin)
  const [showCreateSeason, setShowCreateSeason] = useState(false)
  const [seasonName, setSeasonName] = useState('')
  const [seasonStart, setSeasonStart] = useState('')
  const [seasonEnd, setSeasonEnd] = useState('')
  const [seasonSubOpen, setSeasonSubOpen] = useState('')
  const [seasonSubClose, setSeasonSubClose] = useState('')
  const [seasonError, setSeasonError] = useState('')

  const handleCreateSeason = () => {
    if (!seasonName.trim() || !seasonStart || !seasonEnd || !seasonSubOpen || !seasonSubClose) {
      setSeasonError('All fields are required')
      return
    }
    setSeasonError('')
    createSeason.mutate({
      name: seasonName.trim(),
      startDate: seasonStart,
      endDate: seasonEnd,
      submissionOpen: seasonSubOpen,
      submissionClose: seasonSubClose,
    }, {
      onSuccess: () => {
        setShowCreateSeason(false)
        setSeasonName('')
        setSeasonStart('')
        setSeasonEnd('')
        setSeasonSubOpen('')
        setSeasonSubClose('')
      },
      onError: (err) => {
        setSeasonError(err.message || 'Failed to create season')
      },
    })
  }

  const { data: comments = [] } = useComments(
    activeSeason?.id || null,
    selectedSubmission?.id || null
  )

  useEffect(() => {
    if (!token || !orgId) router.push('/login')
  }, [token, orgId, router])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  if (!token || !orgId) return null

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || ''}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      <MotionConfig reducedMotion="user">
      <div className="flex-1 min-h-0 overflow-y-auto">
      <motion.div
        className="space-y-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.div variants={fadeInUp} className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-semibold leading-[1.05]"
              style={{ color: '#1a1915', letterSpacing: '-0.025em' }}
            >
              Year Plans
            </h1>
            <p
              className="mt-2 text-[13.5px] font-medium"
              style={{ color: '#6a6864' }}
            >
              Plan next year’s events. Collect proposals from staff, review them, and publish approved events to the calendar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Season Selector (when multiple seasons exist) */}
            {seasons.length > 1 && (
              <div className="relative">
                <select
                  value={effectiveSeasonId || ''}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phase === 'CLOSED' ? '(Closed)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {isAdmin && !activeSeason && (
              <button
                onClick={() => setShowCreateSeason(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-full hover:bg-slate-800 transition-all duration-200 cursor-pointer hover:-translate-y-px"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                Start a Year Plan
              </button>
            )}
            {isAdmin && activeSeason && (
              <button
                onClick={() => setShowCreateSeason(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-slate-700 bg-[#f6f4f0] rounded-full hover:bg-[#ede9e0] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                New Year Plan
              </button>
            )}
            {activeSeason && !isAdmin && activeSeason.phase === 'COLLECTING' && (
              <button
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition"
              >
                + New Submission
              </button>
            )}
          </div>
        </motion.div>

        {seasonsLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {!seasonsLoading && !activeSeason && !showCreateSeason && (
          <motion.div variants={cardEntrance} className="ui-glass p-12 text-center">
            <IllustrationCalendar className="w-48 h-48 mx-auto mb-6 opacity-80" />
            <h2
              className="text-[20px] font-semibold mb-2"
              style={{ color: '#1a1915', letterSpacing: '-0.02em' }}
            >
              No year plans yet
            </h2>
            <p
              className="text-[13.5px] mb-6 max-w-md mx-auto leading-[1.55]"
              style={{ color: '#6a6864' }}
            >
              {isAdmin
                ? 'Start a Year Plan for the upcoming school year. Staff can submit event proposals inside it, you review and approve them, and approved events publish to the calendar.'
                : 'Your administrator hasn\u2019t started a year plan yet. Check back soon or ask them to get started.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowCreateSeason(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-full hover:bg-slate-800 transition-all duration-200 cursor-pointer hover:-translate-y-px"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                Start Your First Year Plan
              </button>
            )}
          </motion.div>
        )}

        {/* Create Year Plan Form (Admin) */}
        {showCreateSeason && (
          <motion.div variants={cardEntrance} className="ui-glass p-6 space-y-4">
            <h3
              className="text-[17px] font-semibold"
              style={{ color: '#1a1915', letterSpacing: '-0.015em' }}
            >
              New Year Plan
            </h3>
            <FloatingInput
              label="Year Plan Name"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder="e.g. 2026–2027 Year Plan"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FloatingInput label="Plan Start Date" type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              <FloatingInput label="Plan End Date" type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FloatingInput label="Submissions Open" type="date" value={seasonSubOpen} onChange={(e) => setSeasonSubOpen(e.target.value)} />
              <FloatingInput label="Submissions Close" type="date" value={seasonSubClose} onChange={(e) => setSeasonSubClose(e.target.value)} />
            </div>
            {seasonError && <p className="text-sm text-red-600">{seasonError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowCreateSeason(false); setSeasonError('') }}
                className="flex-1 py-2.5 text-[13px] font-semibold text-slate-700 bg-[#f6f4f0] rounded-full hover:bg-[#ede9e0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeason}
                disabled={createSeason.isPending}
                className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-all duration-200 cursor-pointer disabled:opacity-50"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)' }}
              >
                {createSeason.isPending ? 'Creating...' : 'Create Year Plan'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Admin View */}
        {activeSeason && isAdmin && (
          <PlanningSeasonAdmin
            season={activeSeason}
            onSelectSubmission={setSelectedSubmission}
          />
        )}

        {/* Teacher View */}
        {activeSeason && !isAdmin && (
          <>
            {showForm ? (
              <div className="ui-glass p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">New Event Submission</h3>
                <PlanningSubmissionForm
                  seasonId={activeSeason.id}
                  isSubmitting={createSubmission.isPending}
                  onSubmit={(data) => {
                    createSubmission.mutate({ seasonId: activeSeason.id, data }, {
                      onSuccess: () => setShowForm(false),
                    })
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            ) : (
              <MySubmissions
                submissions={mySubmissions}
                onSubmit={(id) => submitSubmission.mutate({ seasonId: activeSeason.id, subId: id })}
                onSelect={setSelectedSubmission}
                isSubmitting={submitSubmission.isPending}
              />
            )}
          </>
        )}

        {/* Submission Detail Panel */}
        {selectedSubmission && activeSeason && (
          <div className="ui-glass p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{selectedSubmission.title}</h3>
              <button onClick={() => setSelectedSubmission(null)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>

            {selectedSubmission.description && (
              <p className="text-sm text-slate-600">{selectedSubmission.description}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(selectedSubmission.preferredDate).toLocaleDateString()}</span></div>
              <div><span className="text-slate-500">Duration:</span> <span className="font-medium">{selectedSubmission.duration}min</span></div>
              <div><span className="text-slate-500">Priority:</span> <span className="font-medium">{selectedSubmission.priority.replace('_', ' ')}</span></div>
              {selectedSubmission.expectedAttendance && <div><span className="text-slate-500">Attendance:</span> <span className="font-medium">~{selectedSubmission.expectedAttendance}</span></div>}
            </div>

            {selectedSubmission.adminNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Admin Notes</p>
                <p className="text-sm text-amber-700">{selectedSubmission.adminNotes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-900 mb-2">Comments</h4>
              <CommentThread
                comments={comments}
                onAddComment={(message, isAdminOnly) => addComment.mutate({
                  seasonId: activeSeason.id,
                  subId: selectedSubmission.id,
                  message,
                  isAdminOnly,
                })}
                isSubmitting={addComment.isPending}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        )}
      </motion.div>
      </div>
      </MotionConfig>
    </DashboardLayout>
  )
}
