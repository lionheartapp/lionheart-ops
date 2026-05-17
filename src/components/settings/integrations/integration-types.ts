// ─── Integration Types & Helpers ─────────────────────────────────────────────

export interface ContentFilterStatus {
  provider: 'GOGUARDIAN' | 'SECURLY' | 'LIGHTSPEED' | 'BARK'
  isEnabled: boolean
  lastSyncAt: string | null
}

export interface IntegrationStatusData {
  institutionType: string
  planningCenter: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    orgName: string | null
  }
  googleCalendar: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    userName: string | null
  }
  microsoftCalendar: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    userName: string | null
  }
  twilio: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    phoneNumber: string | null
  }
  contentFilters: ContentFilterStatus[]
}

export function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}
