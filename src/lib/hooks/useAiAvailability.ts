import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

interface AiAvailability {
  available: boolean
  reason?: 'DISABLED' | 'QUOTA_EXHAUSTED' | 'NO_API_KEY'
  used: number
  limit: number
  resetAt: string | null
}

export function useAiAvailability() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-availability'],
    queryFn: () => fetchApi<AiAvailability>('/api/ai/availability'),
    staleTime: 60_000, // recheck every minute
    retry: false,
  })

  return {
    aiAvailable: data?.available ?? false,
    aiReason: data?.reason,
    aiUsed: data?.used ?? 0,
    aiLimit: data?.limit ?? 0,
    aiResetAt: data?.resetAt,
    isLoading,
  }
}
