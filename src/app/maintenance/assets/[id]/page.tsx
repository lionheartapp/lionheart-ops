'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AssetDetailPage from '@/components/maintenance/AssetDetailPage'

// ─── Content ─────────────────────────────────────────────────────────────────

function AssetDetailContent({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

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
        // Silently fail — logo is non-critical
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  const handleLogout = () => {
    const keys = [
      'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
      'user-team', 'user-school-scope', 'user-role', 'org-name',
      'org-school-type', 'org-logo-url',
    ]
    keys.forEach((k) => localStorage.removeItem(k))
    router.push('/login')
  }

  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
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
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    }>
      <AssetDetailContent assetId={assetId} />
    </Suspense>
  )
}
