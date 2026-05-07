'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export interface OrgMember {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
  status: string
}

/**
 * Fetch active members of the current org for assignee pickers.
 *
 * Backed by `/api/settings/users` (requires USERS_READ). We default to ACTIVE
 * status only and pull the maximum page size (100) — the picker is meant for
 * smaller orgs/schools. If we ever need to support orgs with hundreds of
 * staff, swap this for a typeahead-backed search endpoint.
 */
export function useOrgMembers(options?: { enabled?: boolean }) {
  return useQuery<OrgMember[]>({
    queryKey: ['org-members', { status: 'ACTIVE' }],
    queryFn: () =>
      fetchApi<OrgMember[]>('/api/settings/users?status=ACTIVE&limit=100'),
    staleTime: 5 * 60_000,
    enabled: options?.enabled ?? true,
  })
}

export function formatMemberLabel(member: { firstName: string | null; lastName: string | null; email: string }): string {
  const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
  return name || member.email
}

/**
 * Filtered subset of org members matching a search query (by name or email).
 * Returns at most 6 results for use in autocomplete dropdowns.
 */
export function useFilteredMembers(query: string): OrgMember[] {
  const { data: members } = useOrgMembers()

  return useMemo(() => {
    if (!members) return []
    if (!query) return members.slice(0, 6)

    const lower = query.toLowerCase()
    return members
      .filter((m) => {
        const name = formatMemberLabel(m).toLowerCase()
        const email = m.email.toLowerCase()
        return name.includes(lower) || email.includes(lower)
      })
      .slice(0, 6)
  }, [members, query])
}
