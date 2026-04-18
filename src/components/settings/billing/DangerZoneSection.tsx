'use client'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

interface DangerZoneSectionProps {
  orgName: string
  deleteDialogOpen: boolean
  deleteConfirmationText: string
  deleteLoading: boolean
  deleteError: string
  onOpenDialog: () => void
  onCloseDialog: () => void
  onConfirmationTextChange: (text: string) => void
  onDeleteOrganization: () => void
}

export function DangerZoneSection({
  orgName,
  deleteDialogOpen,
  deleteConfirmationText,
  deleteLoading,
  deleteError,
  onOpenDialog,
  onCloseDialog,
  onConfirmationTextChange,
  onDeleteOrganization,
}: DangerZoneSectionProps) {
  return (
    <>
      <section className="bg-red-50/50 border-2 border-red-200 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-700 mt-0.5">Permanently delete your organization and all its data.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm text-red-900 max-w-lg">
            <p className="font-medium">Delete Organization</p>
            <p className="text-red-700 text-xs mt-1">
              This will schedule your organization for deletion. You have 30 days to restore by contacting support.
              After that, all data is permanently erased and cannot be recovered.
            </p>
          </div>
          <button
            onClick={onOpenDialog}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer active:scale-[0.97] shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Delete Organization
          </button>
        </div>
      </section>

      {/* ── Delete Organization Dialog ───────────────────────────────────────── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border-2 border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-red-900">Delete Organization</h3>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-sm text-slate-700">
                This will <span className="font-semibold text-red-700">permanently delete</span> your organization,
                cancel your subscription, and remove all users, data, and settings.
              </p>
              <p className="text-sm text-slate-700">
                You have <span className="font-semibold">30 days</span> to restore by contacting support.
                After that, everything is erased and cannot be recovered.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
                To confirm, type the organization name below:
                <div className="mt-1 font-mono font-semibold text-red-700">{orgName || '(loading…)'}</div>
              </div>
            </div>

            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => onConfirmationTextChange(e.target.value)}
              placeholder="Type organization name to confirm"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-sm mb-3"
              disabled={deleteLoading}
            />

            {deleteError && (
              <p className="text-sm text-red-600 mb-3">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onCloseDialog}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-full bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteOrganization}
                disabled={deleteLoading || !orgName || deleteConfirmationText.trim() !== orgName}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
