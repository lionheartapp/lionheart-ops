// Export all shared utilities from core package
export { apiFetch } from './lib/apiFetch'
export { logAction, type AuditAction } from './lib/audit'
export { hashPassword, verifyPassword, createToken, verifyToken } from './lib/auth'
export { getCachedBootstrap, setCachedBootstrap, clearBootstrapCache } from './lib/cacheBootstrap'
export { corsHeaders } from './lib/cors'
export {
  checkHVACOverride,
  checkInventoryStock,
  suggestSetupWindow,
  analyzeEventIntelligence,
  type EventIntelligenceResult,
} from './lib/eventIntelligence'
export { geocodeAddress } from './lib/geocode'
export {
  getModules,
  hasWaterManagement,
  hasVisualCampus,
  hasAdvancedInventory,
  DEFAULT_MODULES,
  type ModulesConfig,
} from './lib/modules'
export {
  orgStorage,
  getOrgId,
  getOrgIdFromRequest,
  runWithOrg,
  withOrg,
  requireModule,
} from './lib/orgContext'
export { parseMembersCsv, type ParsedMember } from './lib/parseMembersCsv'
export { requireActivePlan, PlanRestrictedError } from './lib/planCheck'
export * from './lib/pondConstants'
export { prisma, prismaBase } from './lib/prisma'
export * from './lib/roles'
export { supabase } from './lib/supabase'
export { getOrgConfig, type OrgConfig as TenantOrgConfig } from './lib/tenant'
export {
  get3DayForecast,
  getProactiveAlerts,
  type ForecastDay,
  type ProactiveAlert,
} from './lib/weatherOps'
