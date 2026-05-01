'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useOrgLogo } from '@/lib/hooks/useOrgLogo'

/**
 * Builds the standard DashboardLayout props from useAuth + useOrgLogo.
 * Eliminates ~40 lines of boilerplate per maintenance page.
 *
 * Usage:
 *   const { layoutProps, isReady, orgId } = useDashboardLayoutProps()
 *   if (!isReady || !orgId) return <Spinner />
 *   return <DashboardLayout {...layoutProps}>...</DashboardLayout>
 */
export function useDashboardLayoutProps() {
  const { user, org, orgId, isReady, logout } = useAuth({ redirectTo: '/login' })
  const orgLogoUrl = useOrgLogo(org.logoUrl, isReady)

  const layoutProps = {
    userName: user.name || 'User',
    userEmail: user.email || 'user@school.edu',
    userAvatar: user.avatar || undefined,
    organizationName: org.name || 'School',
    organizationLogoUrl: orgLogoUrl || undefined,
    schoolLabel: user.campusScope ?? user.schoolScope ?? org.schoolType ?? org.name ?? 'School',
    teamLabel: user.team || user.role || 'Team',
    onLogout: logout,
  }

  return { layoutProps, isReady, orgId, user, org }
}
