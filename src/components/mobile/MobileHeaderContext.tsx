'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

interface HeaderConfig {
  title: string
  showBack?: boolean
  onBack?: () => void
  rightActions?: ReactNode
}

interface MobileHeaderContextValue {
  config: HeaderConfig
  setHeaderConfig: (config: Partial<HeaderConfig>) => void
  resetHeader: () => void
}

/** Derive a default page title from the URL path */
function titleFromPath(pathname: string): string {
  // Remove leading slash and take the first segment
  const segments = pathname.split('/').filter(Boolean)
  const page = segments[0] || 'Dashboard'

  // Map known routes to friendly names
  const routeNames: Record<string, string> = {
    dashboard: 'Dashboard',
    events: 'Events',
    calendar: 'Calendar',
    athletics: 'Athletics',
    maintenance: 'Facilities',
    it: 'IT',
    facilities: 'Facilities',
    settings: 'Settings',
    planning: 'Planning',
  }

  return routeNames[page] || page.charAt(0).toUpperCase() + page.slice(1)
}

const defaultConfig: HeaderConfig = { title: 'Dashboard' }

const MobileHeaderContext = createContext<MobileHeaderContextValue>({
  config: defaultConfig,
  setHeaderConfig: () => {},
  resetHeader: () => {},
})

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [config, setConfig] = useState<HeaderConfig>(() => ({
    title: titleFromPath(pathname),
  }))

  // Reset title when route changes (pages can override with setHeaderConfig)
  useEffect(() => {
    setConfig({ title: titleFromPath(pathname) })
  }, [pathname])

  const setHeaderConfig = useCallback((partial: Partial<HeaderConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [])

  const resetHeader = useCallback(() => {
    setConfig({ title: titleFromPath(pathname) })
  }, [pathname])

  return (
    <MobileHeaderContext.Provider value={{ config, setHeaderConfig, resetHeader }}>
      {children}
    </MobileHeaderContext.Provider>
  )
}

export function useMobileHeader() {
  return useContext(MobileHeaderContext)
}
