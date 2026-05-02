'use client'

import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import FacilitiesLanding from './facilities/FacilitiesLanding'
import FacilitiesSchoolDetail from './facilities/FacilitiesSchoolDetail'
import SchoolsManagement, { type SchoolsManagementHandle } from './SchoolsManagement'
import CampusTab from './CampusTab'

interface FacilitiesTabProps {
  onDirtyChange?: (isDirty: boolean) => void
}

type ViewMode =
  | { kind: 'landing' }
  | { kind: 'school-detail'; schoolId: string }
  | { kind: 'campus-detail'; schoolId: string; campusId: string; schoolName: string; campusName: string }

export default function FacilitiesTab({ onDirtyChange }: FacilitiesTabProps = {}) {
  const [view, setView] = useState<ViewMode>({ kind: 'landing' })
  const schoolsRef = useRef<SchoolsManagementHandle>(null)
  const [landingKey, setLandingKey] = useState(0)

  if (view.kind === 'campus-detail') {
    return (
      <div className="space-y-4">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <button
            onClick={() => setView({ kind: 'landing' })}
            className="hover:text-slate-800 transition-colors cursor-pointer"
          >
            Facilities
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <button
            onClick={() => setView({ kind: 'school-detail', schoolId: view.schoolId })}
            className="hover:text-slate-800 transition-colors cursor-pointer"
          >
            {view.schoolName}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-900 font-medium truncate">{view.campusName}</span>
        </nav>
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
        onOpenCampus={(campusId, campusName, schoolName) =>
          setView({ kind: 'campus-detail', schoolId: view.schoolId, campusId, campusName, schoolName })
        }
      />
    )
  }

  return (
    <>
      <FacilitiesLanding
        key={landingKey}
        onSelectSchool={(schoolId) => setView({ kind: 'school-detail', schoolId })}
        onAddSchool={() => schoolsRef.current?.openNew()}
      />
      <div className="hidden">
        <SchoolsManagement
          ref={schoolsRef}
          hideTable
          onSchoolsChanged={() => setLandingKey((k) => k + 1)}
        />
      </div>
    </>
  )
}
