'use client'

import { Suspense, useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import AssetDetailPage from '@/components/maintenance/AssetDetailPage'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api-client'

// ─── Content ─────────────────────────────────────────────────────────────────

function AssetDetailContent({ assetId }: { assetId: string }) {
  // Cookie-based auth via useAuth — no more localStorage JWT reads
  const { user, org, orgId, isReady, logout } = useAuth({ redirectTo: '/login' })
  const userName = user.name
  const userEmail = user.email
  const userAvatar = user.avatar
  const userRole = user.role
  const orgName = org.name
  const orgSchoolType = org.schoolType
  const userSchoolScope = user.campusScope ?? user.schoolScope
  const userTeam = user.team
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(org.logoUrl)
  const isClient = isReady

  // Keep the local logo copy in sync when useAuth refreshes it
  useEffect(() => {
    if (org.logoUrl && org.logoUrl !== orgLogoUrl) {
      setOrgLogoUrl(org.logoUrl)
    }
  }, [org.logoUrl, orgLogoUrl])

  // Fetch org logo via fetchApi (cookie-auth + CSRF) if not already present
  useEffect(() => {
    if (orgLogoUrl || !isReady) return
    let cancelled = false
    fetchApi<{ logoUrl?: string | null }>('/api/onboarding/school-info')
      .then((data) => {
        if (cancelled) return
        if (data?.logoUrl) {
          setOrgLogoUrl(data.logoUrl)
        }
      })
      .catch(() => {
        // Silently fail — logo is non-critical
      })
    return () => {
      cancelled = true
    }
  }, [orgLogoUrl, isReady])

  const handleLogout = () => {
    logout()
  }

  if (!isClient || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
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
      <AssetDetailPage assetId={assetId} />
    </DashboardLayout>
  )
}

// ─── Route ───────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AssetDetailRoute({ params }: PageProps) {
  const [assetId, setAssetId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => setAssetId(id))
  }, [params])

  if (!assetId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <AssetDetailContent assetId={assetId} />
    </Suspense>
  )
}
