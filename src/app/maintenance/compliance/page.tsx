'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, RefreshCw, Loader2, Download } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { ComplianceDomainCard } from '@/components/maintenance/compliance/ComplianceDomainCard'
import { ComplianceSetupWizard } from '@/components/maintenance/compliance/ComplianceSetupWizard'
import { ComplianceCalendar } from '@/components/maintenance/compliance/ComplianceCalendar'
import { ComplianceRecordDrawer } from '@/components/maintenance/compliance/ComplianceRecordDrawer'
import { AuditExportDialog } from '@/components/maintenance/compliance/AuditExportDialog'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { fetchApi } from '@/lib/api-client'
import type { ComplianceDomainCardData } from '@/components/maintenance/compliance/ComplianceDomainCard'
import type { ComplianceDomain } from '@prisma/client'
import type { ComplianceDomainMeta } from '@/lib/types/compliance'

// ─── Compliance record type (shared between Calendar and Drawer) ──────────────
interface ComplianceRecord {
  id: string
  domain: ComplianceDomain
  title: string
  dueDate: string
  inspectionDate?: string | null
  outcome: 'PASSED' | 'FAILED' | 'CONDITIONAL_PASS' | 'PENDING'
  status: 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'NOT_APPLICABLE' | 'PENDING'
  inspector?: string | null
  notes?: string | null
  attachments?: string[]
  generatedTicketId?: string | null
  remediationTicketId?: string | null
  school?: { id: string; name: string } | null
  generatedTicket?: { id: string; ticketNumber: string; status: string } | null
  remediationTicket?: { id: string; ticketNumber: string; status: string } | null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DomainCardSkeleton() {
  return (
    <div className="animate-pulse ui-glass p-4 rounded-2xl">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100" />
        <div className="w-9 h-5 rounded-full bg-gray-100" />
      </div>
      <div className="h-4 w-3/4 bg-gray-100 rounded mb-1.5" />
      <div className="h-3 w-full bg-gray-100 rounded mb-1" />
      <div className="h-3 w-2/3 bg-gray-100 rounded mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function ComplianceContent() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )
  const [isClient, setIsClient] = useState(false)

  // Auth guard
  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  // Fetch org logo if not cached
  useEffect(() => {
    if (orgLogoUrl || !token) return
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/onboarding/school-info', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.data?.logoUrl) {
            setOrgLogoUrl(data.data.logoUrl)
            localStorage.setItem('org-logo-url', data.data.logoUrl)
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  const handleLogout = () => {
    ;[
      'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
      'user-team', 'user-school-scope', 'user-role', 'org-name', 'org-school-type', 'org-logo-url',
    ].forEach((k) => localStorage.removeItem(k))
    router.push('/login')
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  const { data: domainsData, isLoading: domainsLoading } = useQuery<{ data: ComplianceDomainCardData[] }>({
    queryKey: ['compliance-domains'],
    queryFn: () => fetchApi<{ data: ComplianceDomainCardData[] }>('/api/maintenance/compliance/domains'),
    enabled: isClient && !!token,
  })

  const domains: ComplianceDomainCardData[] = domainsData?.data ?? []

  // ─── Populate calendar mutation ────────────────────────────────────────────

  const populateMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/maintenance/compliance/domains/populate', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
      queryClient.invalidateQueries({ queryKey: ['compliance-domains'] })
    },
  })

  // ─── Toggle domain ─────────────────────────────────────────────────────────

  const [togglingDomains, setTogglingDomains] = useState<Set<ComplianceDomain>>(new Set())

  const handleToggle = async (domain: ComplianceDomain, isEnabled: boolean) => {
    setTogglingDomains((prev) => new Set([...prev, domain]))
    try {
      await fetchApi('/api/maintenance/compliance/domains', {
        method: 'POST',
        body: JSON.stringify({ domain, isEnabled }),
      })
      queryClient.invalidateQueries({ queryKey: ['compliance-domains'] })
    } catch (err) {
      console.error('Failed to toggle domain:', err)
    } finally {
      setTogglingDomains((prev) => {
        const next = new Set(prev)
        next.delete(domain)
        return next
      })
    }
  }

  // ─── Wizard state ──────────────────────────────────────────────────────────

  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<ComplianceDomainCardData | null>(null)

  const openWizard = (data: ComplianceDomainCardData) => {
    setSelectedDomain(data)
    setWizardOpen(true)
  }

  // ─── Record drawer state ────────────────────────────────────────────────────

  const [drawerRecord, setDrawerRecord] = useState<ComplianceRecord | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = (record: ComplianceRecord) => {
    setDrawerRecord(record)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => setDrawerRecord(null), 300) // clear after animation
  }

  // ─── Export dialog state ────────────────────────────────────────────────────

  const [exportOpen, setExportOpen] = useState(false)

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || 'user@school.edu'}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      <ModuleGate moduleId="maintenance">
        <MotionConfig reducedMotion="user">
          <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">Regulatory Compliance</h1>
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500 ml-12">
                Configure compliance domains and track regulatory deadlines for your school
              </motion.p>
            </motion.div>

            {/* ── Section 1: Regulatory Domains ── */}
            <motion.section
              className="mb-10"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.04, 0.1)}
            >
              <motion.div variants={fadeInUp} className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Regulatory Domains</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure which regulations apply to your school
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Export Audit PDF
                  </button>
                  <button
                    onClick={() => populateMutation.mutate()}
                    disabled={populateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {populateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Populate Calendar for This Year
                  </button>
                </div>
              </motion.div>

              {/* Domain cards grid */}
              {domainsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[...Array(10)].map((_, i) => <DomainCardSkeleton key={i} />)}
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
                  variants={staggerContainer(0.05)}
                  initial="hidden"
                  animate="visible"
                >
                  {domains.map((domain) => (
                    <ComplianceDomainCard
                      key={domain.domain}
                      data={domain}
                      onToggle={handleToggle}
                      onClick={openWizard}
                      isUpdating={togglingDomains.has(domain.domain)}
                    />
                  ))}
                </motion.div>
              )}

              {populateMutation.isSuccess && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-emerald-600 mt-2"
                >
                  Calendar populated successfully. Scroll down to see your compliance deadlines.
                </motion.p>
              )}
            </motion.section>

            {/* ── Section 2: Compliance Calendar ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Compliance Calendar</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All regulatory deadlines for the current school year
                  </p>
                </div>
              </div>

              <ComplianceCalendar onEditRecord={openDrawer} />
            </motion.section>
          </div>
        </MotionConfig>
      </ModuleGate>

      {/* Setup Wizard */}
      <ComplianceSetupWizard
        domainData={selectedDomain}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* Record Drawer */}
      {drawerOpen && drawerRecord && (
        <ComplianceRecordDrawer
          record={drawerRecord}
          onClose={closeDrawer}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
          }}
        />
      )}

      {/* Export Dialog */}
      <AuditExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </DashboardLayout>
  )
}

export default function CompliancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ComplianceContent />
    </Suspense>
  )
}
