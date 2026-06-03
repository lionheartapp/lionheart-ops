// @vitest-environment jsdom

import React from 'react'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AIDiagnosticPanel from '@/components/maintenance/AIDiagnosticPanel'

vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api-client', () => ({
  fetchApi: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}))

function renderPanel(comments: React.ComponentProps<typeof AIDiagnosticPanel>['comments'] = []) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AIDiagnosticPanel
        ticketId="ticket-1"
        ticketNumber="MT-0001"
        title="Flickering lights in classroom"
        description="Lights flicker when the projector is turned on."
        status="IN_PROGRESS"
        priority="HIGH"
        category="ELECTRICAL"
        photos={['https://storage.example/photo-1.jpg']}
        locationLabel="Temecula Campus / Main Hall / Room 101"
        submittedByName="Amy Kim"
        assignedToName="David Garcia"
        comments={comments}
      />
    </QueryClientProvider>
  )
}

describe('AIDiagnosticPanel Leo handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake-image'], { type: 'image/jpeg' })),
      })
    )
  })

  it('opens Leo with ticket context and ticket photo attachments', async () => {
    const openListener = vi.fn()
    window.addEventListener('open-leo-drawer', openListener)

    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /^open$/i }))

    await waitFor(() => {
      expect(openListener).toHaveBeenCalled()
    })

    const event = openListener.mock.calls[0][0] as CustomEvent
    expect(event.detail.prompt).toContain('Ticket: MT-0001 (ticket-1)')
    expect(event.detail.prompt).toContain('Flickering lights in classroom')
    expect(event.detail.prompt).toContain('competent in their trade')
    expect(event.detail.prompt).toContain('Do not mention comments')
    expect(event.detail.images).toHaveLength(1)
    expect(event.detail.images[0]).toMatchObject({
      mimeType: 'image/jpeg',
      name: 'ticket-photo-1',
    })

    window.removeEventListener('open-leo-drawer', openListener)
  })

  it('includes a comment synopsis only when comments exist', async () => {
    const openListener = vi.fn()
    window.addEventListener('open-leo-drawer', openListener)

    renderPanel([
      {
        content: 'Lights flicker only when projector and window AC are both running.',
        createdAt: '2026-06-03T14:00:00.000Z',
        actorName: 'David Garcia',
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /^open$/i }))

    await waitFor(() => {
      expect(openListener).toHaveBeenCalled()
    })

    const event = openListener.mock.calls[0][0] as CustomEvent
    expect(event.detail.prompt).toContain('Comment synopsis:')
    expect(event.detail.prompt).toContain('projector and window AC')
    expect(event.detail.prompt).toContain('summarize only what matters')

    window.removeEventListener('open-leo-drawer', openListener)
  })
})
