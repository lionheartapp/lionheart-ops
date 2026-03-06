'use client'

import { useState } from 'react'
import { X, Printer, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { scaleIn } from '@/lib/animations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QRCodeThumbnailProps {
  assetId: string
  assetNumber: string
  assetName: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QRCodeThumbnail({ assetId, assetNumber, assetName }: QRCodeThumbnailProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)

  const qrSrc = `/api/maintenance/assets/${assetId}/qr`
  const labelSrc = `/api/maintenance/assets/${assetId}/label`

  const handlePrintSingle = async () => {
    setPrintLoading(true)
    try {
      const res = await fetch(labelSrc, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to get label data')
      const json = await res.json()
      const labelData = json.data

      // Dynamic import — browser only
      const [{ jsPDF }, { generateSingleLabel }] = await Promise.all([
        import('jspdf'),
        import('@/lib/label-utils'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = generateSingleLabel(jsPDF as any, labelData)
      doc.save(`${assetNumber}-label.pdf`)
    } catch (err) {
      console.error('Print single label failed:', err)
    } finally {
      setPrintLoading(false)
    }
  }

  return (
    <>
      {/* Thumbnail */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="group relative w-20 h-20 border border-gray-200 rounded-xl bg-white flex items-center justify-center hover:border-primary-300 transition-colors cursor-pointer overflow-hidden"
          title="View QR code"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR code for ${assetNumber}`}
            className="w-16 h-16 object-contain"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-primary-50/0 group-hover:bg-primary-50/60 transition-colors" />
        </button>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handlePrintSingle}
            disabled={printLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Print label"
          >
            <Printer className="w-3 h-3" />
            {printLoading ? 'Generating...' : 'Label'}
          </button>
        </div>
      </div>

      {/* QR modal */}
      <AnimatePresence>
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2 }}
              className="ui-glass-overlay rounded-2xl p-6 max-w-xs w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">{assetNumber}</p>
                  <p className="text-xs text-gray-500 truncate max-w-48">{assetName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code for ${assetNumber}`}
                  className="w-48 h-48 object-contain"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintSingle}
                  disabled={printLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  {printLoading ? 'Generating...' : 'Print Label'}
                </button>
                <a
                  href={qrSrc}
                  download={`${assetNumber}-qr.svg`}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                  title="Download QR SVG"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
