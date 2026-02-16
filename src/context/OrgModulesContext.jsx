import { createContext, useContext, useEffect, useState } from 'react'
import { platformGet } from '../services/platformApi'
import { PLATFORM_URL } from '../services/platformApi'
import { setOrgContextFromAPI } from '../config/orgContext'

const DEFAULT_MODULES = {
  core: true,
  waterManagement: false,
  visualCampus: { enabled: true, maxBuildings: null },
  advancedInventory: false,
}

function extractDomain(website) {
  if (!website || typeof website !== 'string') return null
  const s = website.trim()
  if (!s) return null
  try {
    const url = s.startsWith('http') ? new URL(s) : new URL(`https://${s}`)
    const host = url.hostname.replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

const OrgModulesContext = createContext({ modules: DEFAULT_MODULES, loading: true, orgName: null, orgLogoUrl: null, orgWebsite: null, orgAddress: null, orgLatitude: null, orgLongitude: null, primaryColor: null, secondaryColor: null, trialDaysLeft: null })

export function OrgModulesProvider({ children }) {
  const [modules, setModules] = useState(DEFAULT_MODULES)
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState(null)
  const [orgLogoUrl, setOrgLogoUrl] = useState(null)
  const [orgWebsite, setOrgWebsite] = useState(null)
  const [orgAddress, setOrgAddress] = useState(null)
  const [orgLatitude, setOrgLatitude] = useState(null)
  const [orgLongitude, setOrgLongitude] = useState(null)
  const [primaryColor, setPrimaryColor] = useState(null)
  const [secondaryColor, setSecondaryColor] = useState(null)
  const [brandfetchLogoUrl, setBrandfetchLogoUrl] = useState(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState(null)

  const fetchOrg = () => {
    platformGet('/api/organization/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
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
        else setOrgLogoUrl(null)
        if (data?.website != null) setOrgWebsite(data.website)
        else setOrgWebsite(null)
        if (data?.address != null) setOrgAddress(data.address)
        else setOrgAddress(null)
        if (typeof data?.latitude === 'number') setOrgLatitude(data.latitude)
        else setOrgLatitude(null)
        if (typeof data?.longitude === 'number') setOrgLongitude(data.longitude)
        else setOrgLongitude(null)
        if (data?.primaryColor != null) setPrimaryColor(data.primaryColor)
        else setPrimaryColor(null)
        if (data?.secondaryColor != null) setSecondaryColor(data.secondaryColor)
        else setSecondaryColor(null)
        if (typeof data?.trialDaysLeft === 'number') setTrialDaysLeft(data.trialDaysLeft)
        setOrgContextFromAPI({ name: data?.name, website: data?.website })

        // When no saved logo but we have website, try Brandfetch/Clearbit
        if (!data?.logoUrl && data?.website) {
          const domain = extractDomain(data.website)
          if (domain) {
            fetch(`${PLATFORM_URL}/api/setup/logo-url?domain=${encodeURIComponent(domain)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((json) => {
                if (json?.url) setBrandfetchLogoUrl(json.url)
              })
              .catch(() => {})
          }
        } else {
          setBrandfetchLogoUrl(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    platformGet('/api/organization/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
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
        else setOrgLogoUrl(null)
        if (data?.website != null) setOrgWebsite(data.website)
        else setOrgWebsite(null)
        if (data?.address != null) setOrgAddress(data.address)
        else setOrgAddress(null)
        if (typeof data?.latitude === 'number') setOrgLatitude(data.latitude)
        else setOrgLatitude(null)
        if (typeof data?.longitude === 'number') setOrgLongitude(data.longitude)
        else setOrgLongitude(null)
        if (data?.primaryColor != null) setPrimaryColor(data.primaryColor)
        else setPrimaryColor(null)
        if (data?.secondaryColor != null) setSecondaryColor(data.secondaryColor)
        else setSecondaryColor(null)
        if (typeof data?.trialDaysLeft === 'number') setTrialDaysLeft(data.trialDaysLeft)
        setOrgContextFromAPI({ name: data?.name, website: data?.website })

        // When no saved logo but we have website, try Brandfetch/Clearbit
        if (!data?.logoUrl && data?.website) {
          const domain = extractDomain(data.website)
          if (domain) {
            fetch(`${PLATFORM_URL}/api/setup/logo-url?domain=${encodeURIComponent(domain)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((json) => {
                if (!cancelled && json?.url) setBrandfetchLogoUrl(json.url)
              })
              .catch(() => {})
          }
        } else {
          setBrandfetchLogoUrl(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => { cancelled = true }
  }, [])

  // Resolved logo: saved logo, or Brandfetch/Clearbit fallback when no saved logo
  const displayLogoUrl = orgLogoUrl || brandfetchLogoUrl

  const value = {
    modules,
    loading,
    hasWaterManagement: modules.waterManagement === true,
    hasVisualCampus: modules.visualCampus?.enabled === true,
    hasAdvancedInventory: modules.advancedInventory === true,
    orgName,
    orgLogoUrl: displayLogoUrl,
    orgWebsite,
    orgAddress,
    orgLatitude,
    orgLongitude,
    primaryColor: primaryColor || '#3b82f6',
    secondaryColor: secondaryColor || '#f59e0b',
    trialDaysLeft,
    refreshOrg: fetchOrg,
  }

  return (
    <OrgModulesContext.Provider value={value}>
      {children}
    </OrgModulesContext.Provider>
  )
}

export function useOrgModules() {
  const ctx = useContext(OrgModulesContext)
  return ctx ?? { modules: DEFAULT_MODULES, loading: false, hasWaterManagement: false, hasVisualCampus: true, hasAdvancedInventory: false, orgName: null, orgLogoUrl: null, orgWebsite: null, orgAddress: null, orgLatitude: null, orgLongitude: null, primaryColor: '#3b82f6', secondaryColor: '#f59e0b', trialDaysLeft: null }
}
