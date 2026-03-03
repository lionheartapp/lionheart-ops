'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PlanningSubmissionForm from '@/components/planning/PlanningSubmissionForm'
import MySubmissions from '@/components/planning/MySubmissions'
import PlanningSeasonAdmin from '@/components/planning/PlanningSeasonAdmin'
import CommentThread from '@/components/planning/CommentThread'
import { useSeasons, useSubmissions, useCreateSubmission, useSubmitSubmission, useComments, useAddComment } from '@/lib/hooks/usePlanningSeason'
import type { PlanningSubmission } from '@/lib/hooks/usePlanningSeason'

export default function PlanningPage() {
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
  const activeSeason = seasons.find((s) => s.phase !== 'CLOSED') || seasons[0] || null

  const { data: mySubmissions = [] } = useSubmissions(activeSeason?.id || null)
  const createSubmission = useCreateSubmission()
  const submitSubmission = useSubmitSubmission()
  const addComment = useAddComment()

  const [showForm, setShowForm] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<PlanningSubmission | null>(null)

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Event Planning</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeSeason ? `${activeSeason.name} — ${activeSeason.phase.replace('_', ' ')}` : 'No active planning season'}
            </p>
          </div>
          {activeSeason && !isAdmin && activeSeason.phase === 'COLLECTING' && (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition"
            >
              + New Submission
            </button>
          )}
        </div>

        {seasonsLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {!seasonsLoading && !activeSeason && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No Planning Seasons</p>
            <p className="text-sm mt-1">An administrator needs to create a planning season first.</p>
          </div>
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
              <div className="border border-gray-200 rounded-xl p-6 bg-white">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">New Event Submission</h3>
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
          <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{selectedSubmission.title}</h3>
              <button onClick={() => setSelectedSubmission(null)} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>

            {selectedSubmission.description && (
              <p className="text-sm text-gray-600">{selectedSubmission.description}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(selectedSubmission.preferredDate).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">Duration:</span> <span className="font-medium">{selectedSubmission.duration}min</span></div>
              <div><span className="text-gray-500">Priority:</span> <span className="font-medium">{selectedSubmission.priority.replace('_', ' ')}</span></div>
              {selectedSubmission.expectedAttendance && <div><span className="text-gray-500">Attendance:</span> <span className="font-medium">~{selectedSubmission.expectedAttendance}</span></div>}
            </div>

            {selectedSubmission.adminNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Admin Notes</p>
                <p className="text-sm text-amber-700">{selectedSubmission.adminNotes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Comments</h4>
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
      </div>
    </DashboardLayout>
  )
}
