'use client'

import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'

interface Permissions {
  canManageWorkspace: boolean
  canWriteAthletics: boolean
  canManageUsers: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  legacyRole: string | null
}

export function usePermissions() {
  const opts = queryOptions.permissions()
  return useQuery<Permissions>({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn as () => Promise<Permissions>,
    staleTime: opts.staleTime,
  })
}
