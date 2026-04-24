'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { Plus, QrCode } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import AssetRegisterFilters, {
  DEFAULT_ASSET_FILTERS,
  type AssetFilterState,
} from '@/components/maintenance/AssetRegisterFilters'
import AssetRegisterTable from '@/components/maintenance/AssetRegisterTable'
import AssetCreateDrawer from '@/components/maintenance/AssetCreateDrawer'
import QRScannerModal from '@/components/maintenance/QRScannerModal'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import type { MaintenanceAsset } from '@/components/maintenance/AssetRegisterTable'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api-client'

function AssetRegisterContent() {
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
        // Silently fail
      })
    return () => {
      cancelled = true
    }
  }, [orgLogoUrl, isReady])

  const handleLogout = () => {
    logout()
  }

  const [filters, setFilters] = useState<AssetFilterState>(DEFAULT_ASSET_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleAssetCreated(asset: MaintenanceAsset & { assetNumber: string }) {
    setSuccessMessage(`Asset ${asset.assetNumber} created successfully`)
    setTimeout(() => setSuccessMessage(''), 4000)
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
      <MotionConfig reducedMotion="user">
        <div>
            {/* Page header */}
            <motion.div
              className="flex items-start justify-between mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <div>
                <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
                  Asset Register
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-sm text-slate-500">
                  Track and manage all facilities assets
                </motion.p>
              </div>

              <motion.div variants={fadeInUp} className="flex items-center gap-2">
                <button
                  onClick={() => setQrScannerOpen(true)}
                  className="ui-btn-md ui-btn-outline"
                  title="Scan QR code to navigate to asset"
                >
                  <QrCode className="w-4 h-4" />
                  Scan QR
                </button>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="ui-btn-md ui-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Asset
                </button>
              </motion.div>
            </motion.div>

            {/* Success toast */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-700 font-medium"
              >
                {successMessage}
              </motion.div>
            )}

            {/* Filters */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="ui-glass p-4 mb-4 overflow-visible relative z-10"
            >
              <AssetRegisterFilters filters={filters} onChange={setFilters} />
            </motion.div>

            {/* Table */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
            >
              <AssetRegisterTable filters={filters} onAddAsset={() => setDrawerOpen(true)} />
            </motion.div>
          </div>

          {/* Create drawer */}
          <AssetCreateDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onCreated={handleAssetCreated}
          />

          {/* QR Scanner modal */}
          <QRScannerModal
            isOpen={qrScannerOpen}
            onClose={() => setQrScannerOpen(false)}
          />
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function AssetRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <AssetRegisterContent />
    </Suspense>
  )
}
