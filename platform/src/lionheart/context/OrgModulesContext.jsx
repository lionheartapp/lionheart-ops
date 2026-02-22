import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { platformGet } from '../services/platformApi'
import { PLATFORM_URL } from '../services/platformApi'
import { setOrgContextFromAPI } from '../config/orgContext'

const DEFAULT_MODULES = {
  core: true,
  waterManagement: false,
  visualCampus: { enabled: true, maxBuildings: null },
  advancedInventory: false,
}
const ORG_SETTINGS_CACHE_KEY = 'lionheart_org_settings_v1'

function normalizeOrgSettings(data) {
  if (!data || typeof data !== 'object') return null
  const m = data.modules ?? {}
  return {
    modules: {
      core: m.core ?? DEFAULT_MODULES.core,
      waterManagement: m.waterManagement ?? DEFAULT_MODULES.waterManagement,
      visualCampus: {
        enabled: m.visualCampus?.enabled ?? DEFAULT_MODULES.visualCampus.enabled,
        maxBuildings: m.visualCampus?.maxBuildings ?? DEFAULT_MODULES.visualCampus.maxBuildings,
      },
      advancedInventory: m.advancedInventory ?? DEFAULT_MODULES.advancedInventory,
    },
    inventoryTeamIds: Array.isArray(data?.inventoryTeamIds) ? data.inventoryTeamIds : undefined,
    orgName: data?.name ?? null,
    orgLogoUrl: data?.logoUrl ?? null,
    orgWebsite: data?.website ?? null,
    orgAddress: data?.address ?? null,
    orgLatitude: typeof data?.latitude === 'number' ? data.latitude : null,
    orgLongitude: typeof data?.longitude === 'number' ? data.longitude : null,
    primaryColor: data?.primaryColor ?? null,
    secondaryColor: data?.secondaryColor ?? null,
    trialDaysLeft: typeof data?.trialDaysLeft === 'number' ? data.trialDaysLeft : null,
    allowTeacherEventRequests: typeof data?.allowTeacherEventRequests === 'boolean' ? data.allowTeacherEventRequests : false,
  }
}

function readCachedOrgSettings() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ORG_SETTINGS_CACHE_KEY)
    if (!raw) return null
    return normalizeOrgSettings(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeCachedOrgSettings(data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ORG_SETTINGS_CACHE_KEY, JSON.stringify(data))
  } catch {}
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

const OrgModulesContext = createContext({ modules: DEFAULT_MODULES, loading: true, orgName: null, orgLogoUrl: null, orgWebsite: null, orgAddress: null, orgLatitude: null, orgLongitude: null, primaryColor: null, secondaryColor: null, trialDaysLeft: null, allowTeacherEventRequests: false, hydrateOrgFromBootstrap: () => {} })

export function OrgModulesProvider({ children }) {
  const cachedOrg = useMemo(() => readCachedOrgSettings(), [])
  const [modules, setModules] = useState(cachedOrg?.modules ?? DEFAULT_MODULES)
  const [loading, setLoading] = useState(cachedOrg == null)
  const [orgName, setOrgName] = useState(cachedOrg?.orgName ?? null)
  const [orgLogoUrl, setOrgLogoUrl] = useState(cachedOrg?.orgLogoUrl ?? null)
  const [orgWebsite, setOrgWebsite] = useState(cachedOrg?.orgWebsite ?? null)
  const [orgAddress, setOrgAddress] = useState(cachedOrg?.orgAddress ?? null)
  const [orgLatitude, setOrgLatitude] = useState(cachedOrg?.orgLatitude ?? null)
  const [orgLongitude, setOrgLongitude] = useState(cachedOrg?.orgLongitude ?? null)
  const [primaryColor, setPrimaryColor] = useState(cachedOrg?.primaryColor ?? null)
  const [secondaryColor, setSecondaryColor] = useState(cachedOrg?.secondaryColor ?? null)
  const [brandfetchLogoUrl, setBrandfetchLogoUrl] = useState(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState(cachedOrg?.trialDaysLeft ?? null)
  const [allowTeacherEventRequests, setAllowTeacherEventRequests] = useState(cachedOrg?.allowTeacherEventRequests ?? false)
  const [inventoryTeamIds, setInventoryTeamIds] = useState(cachedOrg?.inventoryTeamIds)
  const [hasHydratedFromBootstrap, setHasHydratedFromBootstrap] = useState(false)

  const hydrateOrgFromBootstrap = useCallback((orgData) => {
    const normalized = normalizeOrgSettings(orgData)
    if (!normalized) return
    setModules(normalized.modules)
    setInventoryTeamIds(normalized.inventoryTeamIds)
    setOrgName(normalized.orgName)
    setOrgLogoUrl(normalized.orgLogoUrl)
    setOrgWebsite(normalized.orgWebsite)
    setOrgAddress(normalized.orgAddress)
    setOrgLatitude(normalized.orgLatitude)
    setOrgLongitude(normalized.orgLongitude)
    setPrimaryColor(normalized.primaryColor)
    setSecondaryColor(normalized.secondaryColor)
    setTrialDaysLeft(normalized.trialDaysLeft)
    setAllowTeacherEventRequests(normalized.allowTeacherEventRequests)
    writeCachedOrgSettings(orgData)
    setOrgContextFromAPI({ name: orgData?.name, website: orgData?.website })

    if (!orgData?.logoUrl && orgData?.website) {
      const domain = extractDomain(orgData.website)
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
    setLoading(false)
    setHasHydratedFromBootstrap(true)
  }, [])

  const fetchOrg = useCallback(({ suppressLoading = false } = {}) => {
    if (!suppressLoading) setLoading(true)
    platformGet('/api/organization/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        const normalized = normalizeOrgSettings(data)
        if (!normalized) return
        hydrateOrgFromBootstrap(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [hydrateOrgFromBootstrap])

  useEffect(() => {
    if (cachedOrg != null) {
      fetchOrg({ suppressLoading: true })
      return undefined
    }
    const timeoutId = setTimeout(() => {
      if (!hasHydratedFromBootstrap) fetchOrg({ suppressLoading: false })
    }, 250)
    return () => clearTimeout(timeoutId)
  }, [fetchOrg, cachedOrg, hasHydratedFromBootstrap])

  // Resolved logo: saved logo, or Brandfetch/Clearbit fallback when no saved logo
  // Use useMemo to prevent unnecessary changes that trigger sidebar logo reset
  const displayLogoUrl = useMemo(() => orgLogoUrl || brandfetchLogoUrl, [orgLogoUrl, brandfetchLogoUrl])

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    modules,
    loading,
    hasWaterManagement: modules.waterManagement === true,
    hasVisualCampus: modules.visualCampus?.enabled === true,
    hasAdvancedInventory: modules.advancedInventory === true,
    inventoryTeamIds,
    orgName,
    orgLogoUrl: displayLogoUrl,
    orgWebsite,
    orgAddress,
    orgLatitude,
    orgLongitude,
    primaryColor: primaryColor || '#3b82f6',
    secondaryColor: secondaryColor || '#f59e0b',
    trialDaysLeft,
    allowTeacherEventRequests,
    hydrateOrgFromBootstrap,
    refreshOrg: fetchOrg,
  }), [
    modules,
    loading,
    inventoryTeamIds,
    displayLogoUrl,
    orgName,
    orgWebsite,
    orgAddress,
    orgLatitude,
    orgLongitude,
    primaryColor,
    secondaryColor,
    trialDaysLeft,
    allowTeacherEventRequests,
    hydrateOrgFromBootstrap,
    fetchOrg,
  ])

  return (
    <OrgModulesContext.Provider value={value}>
      {children}
    </OrgModulesContext.Provider>
  )
}

export function useOrgModules() {
  const ctx = useContext(OrgModulesContext)
  return ctx ?? { modules: DEFAULT_MODULES, loading: false, hasWaterManagement: false, hasVisualCampus: true, hasAdvancedInventory: false, inventoryTeamIds: undefined, orgName: null, orgLogoUrl: null, orgWebsite: null, orgAddress: null, orgLatitude: null, orgLongitude: null, primaryColor: '#3b82f6', secondaryColor: '#f59e0b', trialDaysLeft: null, allowTeacherEventRequests: false, hydrateOrgFromBootstrap: () => {} }
}
