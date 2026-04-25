'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export interface EventInvitation {
  id: string
  eventProjectId: string
  userId: string
  invitedById: string
  status: 'PENDING' | 'ACCEPTED' | 'MAYBE' | 'DECLINED'
  note: string | null
  responseNote: string | null
  respondedAt: string | null
  createdAt: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
    jobTitle: string | null
  }
  invitedBy: {
    id: string
    firstName: string | null
    lastName: string | null
  }
}

export function useEventInvitations(eventProjectId: string | undefined) {
  return useQuery({
    queryKey: ['event-invitations', eventProjectId],
    queryFn: () =>
      fetchApi<EventInvitation[]>(
        `/api/events/projects/${eventProjectId}/invitations`,
      ),
    enabled: !!eventProjectId,
  })
}

export function useRespondToInvitation(eventProjectId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      status: 'ACCEPTED' | 'MAYBE' | 'DECLINED'
      responseNote?: string
    }) =>
      fetchApi(`/api/events/projects/${eventProjectId}/invitations/respond`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-invitations', eventProjectId] })
    },
  })
}
