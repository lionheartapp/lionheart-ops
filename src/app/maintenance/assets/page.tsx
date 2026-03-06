'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { Plus, QrCode } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import AssetRegisterFilters, {
  DEFAULT_ASSET_FILTERS,
  type AssetFilterState,
} from '@/components/maintenance/AssetRegisterFilters'
import AssetRegisterTable from '@/components/maintenance/AssetRegisterTable'
import AssetCreateDrawer from '@/components/maintenance/AssetCreateDrawer'
import QRScannerModal from '@/components/maintenance/QRScannerModal'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import type { MaintenanceAsset } from '@/components/maintenance/AssetRegisterTable'

function AssetRegisterContent() {
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

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  const [filters, setFilters] = useState<AssetFilterState>(DEFAULT_ASSET_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleAssetCreated(asset: MaintenanceAsset & { assetNumber: string }) {
    setSuccessMessage(`Asset ${asset.assetNumber} created successfully`)
    setTimeout(() => setSuccessMessage(''), 4000)
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
              className="flex items-start justify-between mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <div>
                <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-gray-900">
                  Asset Register
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-sm text-gray-500">
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
              className="ui-glass p-4 mb-4"
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
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function AssetRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AssetRegisterContent />
    </Suspense>
  )
}
