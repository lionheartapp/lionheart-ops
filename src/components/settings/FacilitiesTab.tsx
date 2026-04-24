'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import FacilitiesLanding from './facilities/FacilitiesLanding'
import FacilitiesSchoolDetail from './facilities/FacilitiesSchoolDetail'
import CampusTab from './CampusTab'

interface FacilitiesTabProps {
  onDirtyChange?: (isDirty: boolean) => void
}

type ViewMode =
  | { kind: 'landing' }
  | { kind: 'school-detail'; schoolId: string }
  | { kind: 'campus-detail'; schoolId: string; campusId: string }

export default function FacilitiesTab({ onDirtyChange }: FacilitiesTabProps = {}) {
  const [view, setView] = useState<ViewMode>({ kind: 'landing' })

  if (view.kind === 'campus-detail') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView({ kind: 'school-detail', schoolId: view.schoolId })}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <CampusTab
          onDirtyChange={onDirtyChange}
          embedded
          initialCampusId={view.campusId}
        />
      </div>
    )
  }

  if (view.kind === 'school-detail') {
    return (
      <FacilitiesSchoolDetail
        schoolId={view.schoolId}
        onBack={() => setView({ kind: 'landing' })}
        onOpenCampus={(campusId) =>
          setView({ kind: 'campus-detail', schoolId: view.schoolId, campusId })
        }
      />
    )
  }

  return (
    <FacilitiesLanding
      onSelectSchool={(schoolId) => setView({ kind: 'school-detail', schoolId })}
    />
  )
}
