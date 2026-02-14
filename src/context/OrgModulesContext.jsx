import { createContext, useContext, useEffect, useState } from 'react'
import { platformGet } from '../services/platformApi'

const DEFAULT_MODULES = {
  core: true,
  waterManagement: false,
  visualCampus: { enabled: true, maxBuildings: null },
  advancedInventory: false,
}

const OrgModulesContext = createContext({ modules: DEFAULT_MODULES, loading: true })

export function OrgModulesProvider({ children }) {
  const [modules, setModules] = useState(DEFAULT_MODULES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    platformGet('/api/organization/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.modules) return
        const m = data.modules
        setModules({
          core: m.core ?? DEFAULT_MODULES.core,
          waterManagement: m.waterManagement ?? DEFAULT_MODULES.waterManagement,
          visualCampus: {
            enabled: m.visualCampus?.enabled ?? DEFAULT_MODULES.visualCampus.enabled,
            maxBuildings: m.visualCampus?.maxBuildings ?? DEFAULT_MODULES.visualCampus.maxBuildings,
          },
          advancedInventory: m.advancedInventory ?? DEFAULT_MODULES.advancedInventory,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => { cancelled = true }
  }, [])

  const value = {
    modules,
    loading,
    hasWaterManagement: modules.waterManagement === true,
    hasVisualCampus: modules.visualCampus?.enabled === true,
    hasAdvancedInventory: modules.advancedInventory === true,
  }

  return (
    <OrgModulesContext.Provider value={value}>
      {children}
    </OrgModulesContext.Provider>
  )
}

export function useOrgModules() {
  const ctx = useContext(OrgModulesContext)
  return ctx ?? { modules: DEFAULT_MODULES, loading: false, hasWaterManagement: false, hasVisualCampus: true, hasAdvancedInventory: false }
}
