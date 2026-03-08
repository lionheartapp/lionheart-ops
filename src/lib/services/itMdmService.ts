/**
 * MDM Integration Service (Stubs)
 *
 * Jamf Pro, Mosyle, and Microsoft Intune integrations are service stubs
 * since we don't have API keys. The UI will show "Coming Soon" cards
 * for these providers.
 */

export type MdmProvider = 'jamf' | 'mosyle' | 'intune'

export interface MdmConfig {
  provider: MdmProvider | null
  serverUrl: string | null
  configured: boolean
  lastSync: Date | null
}

export interface IntuneConfig {
  tenantId: string | null
  clientId: string | null
  configured: boolean
}

// ─── Get Config ───────────────────────────────────────────────────────────

export async function getConfig(): Promise<MdmConfig> {
  return {
    provider: null,
    serverUrl: null,
    configured: false,
    lastSync: null,
  }
}

// ─── Set Config ───────────────────────────────────────────────────────────

export async function setConfig(_provider: MdmProvider, _credentials: Record<string, string>): Promise<{ status: string; message: string }> {
  return {
    status: 'not_configured',
    message: 'MDM integration requires API credentials. Contact your MDM administrator.',
  }
}

// ─── Test Connection ──────────────────────────────────────────────────────

export async function testConnection(): Promise<{ status: string; message: string }> {
  return {
    status: 'not_configured',
    message: 'No MDM provider configured. Set up Jamf Pro, Mosyle, or Microsoft Intune credentials first.',
  }
}

// ─── Sync Devices ─────────────────────────────────────────────────────────

export async function syncDevices(): Promise<{ status: string; message: string }> {
  return {
    status: 'not_configured',
    message: 'MDM sync requires a configured provider. Connect Jamf Pro, Mosyle, or Microsoft Intune first.',
  }
}

// ─── Intune Types (Graph API stubs) ───────────────────────────────────────

export interface IntuneDevice {
  id: string
  deviceName: string
  managedDeviceOwnerType: 'company' | 'personal'
  operatingSystem: string
  osVersion: string
  complianceState: 'compliant' | 'noncompliant' | 'unknown'
  lastSyncDateTime: string
  serialNumber: string
  model: string
  manufacturer: string
}

export async function getIntuneConfig(): Promise<IntuneConfig> {
  return {
    tenantId: null,
    clientId: null,
    configured: false,
  }
}

export async function syncIntuneDevices(): Promise<{ status: string; message: string }> {
  return {
    status: 'not_configured',
    message: 'Intune sync requires Entra ID app registration with Device.Read.All permission.',
  }
}
