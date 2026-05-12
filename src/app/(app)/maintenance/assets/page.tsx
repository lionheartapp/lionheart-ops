'use client'

import { useState, Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { Plus, QrCode } from 'lucide-react'

import AssetRegisterFilters, {
  DEFAULT_ASSET_FILTERS,
  type AssetFilterState,
} from '@/components/maintenance/AssetRegisterFilters'
import AssetRegisterTable from '@/components/maintenance/AssetRegisterTable'
import AssetCreateDrawer from '@/components/maintenance/AssetCreateDrawer'
import QRScannerModal from '@/components/maintenance/QRScannerModal'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import type { MaintenanceAsset } from '@/components/maintenance/AssetRegisterTable'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'
import PagePadding from '@/components/PagePadding'

function AssetRegisterContent() {
  const { isReady, orgId } = useDashboardLayoutProps()

  const [filters, setFilters] = useState<AssetFilterState>(DEFAULT_ASSET_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleAssetCreated(asset: MaintenanceAsset & { assetNumber: string }) {
    setSuccessMessage(`Asset ${asset.assetNumber} created successfully`)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  if (!isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <PagePadding>
    <>
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
    </>
    </PagePadding>
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
