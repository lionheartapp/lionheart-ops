// @vitest-environment jsdom

import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import QACompletionModal from '@/components/maintenance/QACompletionModal'
import { fetchApi } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({
  fetchApi: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}))

vi.mock('@/components/ui/FileInput', () => ({
  FileInput: ({ onFiles, children }: { onFiles: (files: File[] | null) => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => onFiles([new File(['photo'], 'after.jpg', { type: 'image/jpeg' })])}
    >
      {children}
    </button>
  ),
}))

describe('QACompletionModal closeout workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    ;(fetchApi as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/maintenance/tickets/upload-url') {
        return Promise.resolve({
          signedUrl: 'https://storage.example/upload',
          publicUrl: 'https://storage.example/after.jpg',
        })
      }
      return Promise.resolve({})
    })
  })

  it('requires a photo and sends a structured closeout summary to QA status endpoint', async () => {
    const onClose = vi.fn()
    const onComplete = vi.fn()

    render(
      <QACompletionModal
        ticketId="ticket-1"
        open
        onClose={onClose}
        onComplete={onComplete}
      />
    )

    fireEvent.click(screen.getByText('Add Completion Photo'))

    await waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith(
        '/api/maintenance/tickets/upload-url',
        expect.objectContaining({ method: 'POST' })
      )
    })

    fireEvent.change(screen.getByPlaceholderText(/Describe what was repaired/i), {
      target: { value: 'Replaced the worn faucet cartridge and tested for leaks.' },
    })
    fireEvent.change(screen.getByPlaceholderText(/worn cartridge/i), {
      target: { value: 'Worn cartridge seal' },
    })
    fireEvent.change(screen.getByPlaceholderText(/1\/2 inch supply line/i), {
      target: { value: 'Replacement cartridge, plumber tape' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Optional extra context/i), {
      target: { value: 'Monitor for the next school day.' },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit for qa/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /submit for qa/i }))

    await waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith(
        '/api/maintenance/tickets/ticket-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        })
      )
    })

    const statusCall = (fetchApi as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === '/api/maintenance/tickets/ticket-1/status'
    )
    const body = JSON.parse(statusCall?.[1]?.body)

    expect(body.status).toBe('QA')
    expect(body.completionPhotos).toEqual(['https://storage.example/after.jpg'])
    expect(body.completionNote).toContain('Work performed: Replaced the worn faucet cartridge')
    expect(body.completionNote).toContain('Cause found: Worn cartridge seal')
    expect(body.completionNote).toContain('Parts/materials used: Replacement cartridge, plumber tape')
    expect(body.completionNote).toContain('Repair type: Permanent fix')
    expect(body.completionNote).toContain('Follow-up needed: No')
    expect(body.completionNote).toContain('Additional notes: Monitor for the next school day.')
    expect(onComplete).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
