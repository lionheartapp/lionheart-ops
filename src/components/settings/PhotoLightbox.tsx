'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface PhotoLightboxProps {
  images: string[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

export default function PhotoLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [shouldShow, setShouldShow] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Swipe tracking
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset index when opening with a new initialIndex
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setIsAnimating(true)
      document.body.style.overflowY = 'hidden'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShouldShow(true)
        })
      })
    } else if (isAnimating) {
      setShouldShow(false)
    }
    return () => {
      document.body.style.overflowY = 'unset'
    }
  }, [isOpen, initialIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'ArrowLeft') goToPrev()
      else if (e.key === 'ArrowRight') goToNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, currentIndex, images.length])

  const handleClose = useCallback(() => {
    setShouldShow(false)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 200)
  }, [onClose])

  const goToNext = useCallback(() => {
    if (images.length <= 1) return
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const goToPrev = useCallback(() => {
    if (images.length <= 1) return
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50 // minimum swipe distance
    if (Math.abs(diff) > threshold) {
      if (diff > 0) goToNext()   // swipe left → next
      else goToPrev()             // swipe right → prev
    }
  }

  if (!isOpen && !isAnimating) return null
  if (images.length === 0) return null

  return createPortal(
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center transition-opacity duration-200 ${
        shouldShow ? 'opacity-100' : 'opacity-0'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
        style={{ minHeight: 'auto' }}
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Main image */}
      <div className="relative z-[1] flex items-center justify-center w-full h-full px-4 py-16 sm:px-16">
        {/* Previous arrow (desktop) */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goToPrev() }}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
            style={{ minHeight: 'auto' }}
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <img
          key={currentIndex}
          src={images[currentIndex]}
          alt={`Photo ${currentIndex + 1} of ${images.length}`}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Next arrow (desktop) */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goToNext() }}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
            style={{ minHeight: 'auto' }}
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom section: thumbnails on desktop, dots on mobile */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center">
        {images.length > 1 && (
          <>
            {/* Desktop: thumbnails */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50">
              {images.map((url, idx) => (
                <button
                  key={url}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx) }}
                  className={`w-14 h-10 rounded-md overflow-hidden border-2 transition ${
                    idx === currentIndex
                      ? 'border-white opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                  style={{ minHeight: 'auto' }}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>

            {/* Mobile: dots */}
            <div className="flex sm:hidden items-center gap-2 px-3 py-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx) }}
                  className={`rounded-full transition-all ${
                    idx === currentIndex
                      ? 'w-2.5 h-2.5 bg-white'
                      : 'w-2 h-2 bg-white/50'
                  }`}
                  style={{ minHeight: 'auto' }}
                  aria-label={`View photo ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
