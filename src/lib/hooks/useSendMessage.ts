'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

interface SendMessageInput {
  content: string
  parentId?: string
}

interface MessageWithAuthor {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  parentId: string | null
  replyCount: number
  editedAt: string | null
  pinnedAt: string | null
  createdAt: string
}

async function postMessage(
  channelId: string,
  input: SendMessageInput,
): Promise<MessageWithAuthor> {
  const res = await fetch(`/api/messaging/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Failed to send message')
  }

  const json = await res.json()
  return json.data as MessageWithAuthor
}

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: SendMessageInput) => postMessage(channelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] })
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
    },
  })

  return {
    sendMessage: mutation.mutate,
    sendMessageAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
