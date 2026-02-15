import { createContext, useContext, useEffect, useState } from 'react'
import { platformGet } from '../services/platformApi'

const DEFAULT_MODULES = {
  core: true,
  waterManagement: false,
  visualCampus: { enabled: true, maxBuildings: null },
  advancedInventory: false,
}

const OrgModulesContext = createContext({ modules: DEFAULT_MODULES, loading: true, orgName: null, orgLogoUrl: null, trialDaysLeft: null })

export function OrgModulesProvider({ children }) {
  const [modules, setModules] = useState(DEFAULT_MODULES)
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState(null)
  const [orgLogoUrl, setOrgLogoUrl] = useState(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState(null)

  useEffect(() => {
    let cancelled = false
    platformGet('/api/organization/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.modules) {
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
        }
        if (data?.name != null) setOrgName(data.name)
        if (data?.logoUrl != null) setOrgLogoUrl(data.logoUrl)
        if (typeof data?.trialDaysLeft === 'number') setTrialDaysLeft(data.trialDaysLeft)
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
    orgName,
    orgLogoUrl,
    trialDaysLeft,
  }

  return (
    <OrgModulesContext.Provider value={value}>
      {children}
    </OrgModulesContext.Provider>
  )
}

export function useOrgModules() {
  const ctx = useContext(OrgModulesContext)
  return ctx ?? { modules: DEFAULT_MODULES, loading: false, hasWaterManagement: false, hasVisualCampus: true, hasAdvancedInventory: false, orgName: null, orgLogoUrl: null, trialDaysLeft: null }
}
