'use client'

import { createPortal } from 'react-dom'
import type { SuccessModalData } from '@/lib/school-utils'

interface SchoolSuccessModalProps {
  data: SuccessModalData
  onClose: () => void
  onEditPrincipal: () => void
}

export default function SchoolSuccessModal({
  data,
  onClose,
  onEditPrincipal,
}: SchoolSuccessModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">New principal created</h3>
          <p className="text-slate-600">
            <strong>{data.schoolName}</strong> has been added and <strong>{data.principalName}</strong> was created as a new principal.
          </p>
        </div>

        <p className="text-slate-600 mb-6 text-sm">
          Would you like to edit this new principal&apos;s information now?
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onEditPrincipal}
            className="flex-1 px-4 py-2 min-h-[40px] rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 min-h-[40px] rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
