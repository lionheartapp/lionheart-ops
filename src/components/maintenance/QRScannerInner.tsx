'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QRScannerInnerProps {
  onClose: () => void
}

// ─── Asset URL pattern ────────────────────────────────────────────────────────

const ASSET_URL_PATTERN = /\/maintenance\/assets\/([^/?#]+)/

// ─── Component ────────────────────────────────────────────────────────────────

export default function QRScannerInner({ onClose }: QRScannerInnerProps) {
  const router = useRouter()
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const containerId = 'html5qr-code-full-region'

    // Ensure container exists
    const container = document.getElementById(containerId)
    if (!container) return

    const scanner = new Html5QrcodeScanner(
      containerId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      /* verbose= */ false
    )

    scannerRef.current = scanner

    scanner.render(
      (decodedText) => {
        // Success: check if it's an asset URL
        const match = decodedText.match(ASSET_URL_PATTERN)
        if (match) {
          const assetId = match[1]
          setScanning(false)
          scanner.clear().catch(() => {})
          onClose()
          router.push(`/maintenance/assets/${assetId}`)
        } else {
          setError('Not a valid asset QR code. Please scan an asset label.')
        }
      },
      (errorMessage) => {
        // Suppress continuous scan errors — only show meaningful ones
        if (errorMessage.includes('No MultiFormat Readers') || errorMessage.includes('NotFoundException')) {
          return // Normal — no QR in view
        }
        // Don't show transient errors to avoid flickering
      }
    )

    return () => {
      scanner.clear().catch(() => {})
    }
  }, [router, onClose])

  return (
    <div className="flex flex-col gap-3">
      {/* Scanner viewport */}
      <div className="relative rounded-xl overflow-hidden bg-black">
        <div id="html5qr-code-full-region" ref={containerRef} />
        {!scanning && (
          <div className="absolute inset-0 bg-primary-900/80 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium">QR Code detected!</p>
              <p className="text-xs text-primary-200 mt-1">Navigating to asset...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Point camera at an asset QR label to navigate to the asset detail page
      </p>
    </div>
  )
}
