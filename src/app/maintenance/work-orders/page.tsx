'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import WorkOrdersView from '@/components/maintenance/WorkOrdersView'

interface Campus {
  id: string
  name: string
  isActive: boolean
}

function WorkOrdersContent() {
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
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  useEffect(() => {
    if (orgLogoUrl || !token) return
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/onboarding/school-info', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.data?.logoUrl) {
            setOrgLogoUrl(data.data.logoUrl)
            localStorage.setItem('org-logo-url', data.data.logoUrl)
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  const { data: modules = [] } = useModules()
  const { data: rawCampuses } = useQuery(queryOptions.campuses())
  const campuses = (rawCampuses as Campus[] | undefined) ?? []

  const enabledCampusIds = modules
    .filter((m) => m.moduleId === 'maintenance' && m.campusId)
    .map((m) => m.campusId as string)

  const enabledCampuses = campuses.filter((c) => enabledCampusIds.includes(c.id))

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const activeCampusId = selectedCampusId ?? enabledCampuses[0]?.id ?? null
  const activeCampusName = enabledCampuses.find((c) => c.id === activeCampusId)?.name

  const handleLogout = () => {
    localStorage.removeItem('auth-token')
    localStorage.removeItem('org-id')
    localStorage.removeItem('user-name')
    localStorage.removeItem('user-email')
    localStorage.removeItem('user-avatar')
    localStorage.removeItem('user-team')
    localStorage.removeItem('user-school-scope')
    localStorage.removeItem('user-role')
    localStorage.removeItem('org-name')
    localStorage.removeItem('org-school-type')
    localStorage.removeItem('org-logo-url')
    router.push('/login')
  }

  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || 'user@school.edu'}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      <ModuleGate moduleId="maintenance">
        <MotionConfig reducedMotion="user">
          <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-gray-900">
                Work Orders
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500">
                {activeCampusName || 'Manage and track maintenance work orders'}
              </motion.p>
            </motion.div>

            {/* Campus selector — shown when multiple campuses have maintenance enabled */}
            {enabledCampuses.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                {enabledCampuses.map((campus) => (
                  <button
                    key={campus.id}
                    onClick={() => setSelectedCampusId(campus.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      activeCampusId === campus.id
                        ? 'bg-gray-900 text-white font-medium border border-gray-900'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {campus.name}
                  </button>
                ))}
              </div>
            )}

            {/* Work Orders content */}
            <WorkOrdersView
              activeCampusId={activeCampusId}
              campuses={enabledCampuses}
            />
          </div>
        </MotionConfig>
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <WorkOrdersContent />
    </Suspense>
  )
}
