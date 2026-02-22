/**
 * Tiered packaging: Lionheart Core + add-on modules.
 * Gates features based on Organization.settings.modules JSON.
 */

export const DEFAULT_MODULES = {
  core: true,
  waterManagement: false,
  visualCampus: { enabled: true, maxBuildings: null as number | null },
  advancedInventory: false,
} as const

export type ModulesConfig = {
  core: boolean
  waterManagement: boolean
  visualCampus: { enabled: boolean; maxBuildings: number | null }
  advancedInventory: boolean
}

export function getModules(settings: unknown): ModulesConfig {
  const raw = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).modules : undefined
  const mod = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const vc = mod.visualCampus && typeof mod.visualCampus === 'object' ? (mod.visualCampus as Record<string, unknown>) : {}
  return {
    core: typeof mod.core === 'boolean' ? mod.core : DEFAULT_MODULES.core,
    waterManagement: typeof mod.waterManagement === 'boolean' ? mod.waterManagement : DEFAULT_MODULES.waterManagement,
    visualCampus: {
      enabled: typeof vc.enabled === 'boolean' ? vc.enabled : DEFAULT_MODULES.visualCampus.enabled,
      maxBuildings: typeof vc.maxBuildings === 'number' ? vc.maxBuildings : DEFAULT_MODULES.visualCampus.maxBuildings,
    },
    advancedInventory: typeof mod.advancedInventory === 'boolean' ? mod.advancedInventory : DEFAULT_MODULES.advancedInventory,
  }
}

export function hasWaterManagement(modules: ModulesConfig): boolean {
  return modules.waterManagement === true
}

export function hasVisualCampus(modules: ModulesConfig): boolean {
  return modules.visualCampus?.enabled === true
}

export function hasAdvancedInventory(modules: ModulesConfig): boolean {
  return modules.advancedInventory === true
}
