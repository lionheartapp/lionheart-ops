'use client'

import { useState, Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { logger } from '@/lib/logger'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Loader2, Download } from 'lucide-react'

import { ComplianceDomainCard } from '@/components/maintenance/compliance/ComplianceDomainCard'
import { ComplianceSetupWizard } from '@/components/maintenance/compliance/ComplianceSetupWizard'
import { ComplianceCalendar } from '@/components/maintenance/compliance/ComplianceCalendar'
import { ComplianceRecordDrawer } from '@/components/maintenance/compliance/ComplianceRecordDrawer'
import { AuditExportDialog } from '@/components/maintenance/compliance/AuditExportDialog'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { fetchApi } from '@/lib/api-client'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'
import PagePadding from '@/components/PagePadding'
import type { ComplianceDomainCardData } from '@/components/maintenance/compliance/ComplianceDomainCard'
import type { ComplianceDomain } from '@prisma/client'
import type { ComplianceDomainMeta } from '@/lib/types/compliance'
import { usePageTitle } from '@/hooks/usePageTitle'

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
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-9 h-5 rounded-full bg-slate-100" />
      </div>
      <div className="h-4 w-3/4 bg-slate-100 rounded mb-1.5" />
      <div className="h-3 w-full bg-slate-100 rounded mb-1" />
      <div className="h-3 w-2/3 bg-slate-100 rounded mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function ComplianceContent() {
  const queryClient = useQueryClient()
  const { isReady, orgId } = useDashboardLayoutProps()
  const isClient = isReady

  // ─── Data ──────────────────────────────────────────────────────────────────

  const { data: domainsData, isLoading: domainsLoading } = useQuery<{ data: ComplianceDomainCardData[] }>({
    queryKey: ['compliance-domains'],
    queryFn: () => fetchApi<{ data: ComplianceDomainCardData[] }>('/api/maintenance/compliance/domains'),
    enabled: isClient,
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
      logger.error({ error: String(err) }, 'Failed to toggle compliance domain')
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

  // F-003: previously this state rendered a bare spinner on blank background
  // with no DashboardLayout — the user saw "completely blank page". Render
  // the layout shell with a content-area skeleton so the shell stays
  // consistent across navigation and the user always knows where they are.
  if (!isClient || !orgId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <DomainCardSkeleton />
          <DomainCardSkeleton />
          <DomainCardSkeleton />
          <DomainCardSkeleton />
          <DomainCardSkeleton />
          <DomainCardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <PagePadding>
    <>
      <MotionConfig reducedMotion="user">
        <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-3">
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-slate-900">Compliance</h1>
                  <p className="text-sm text-slate-500">
                    Configure compliance domains and track regulatory deadlines for your school
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.97]"
                  >
                    <Download className="w-4 h-4" />
                    Export Audit PDF
                  </button>
                  <button
                    onClick={() => populateMutation.mutate()}
                    disabled={populateMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 active:scale-[0.97]"
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
            </motion.div>

            {/* ── Section 1: Regulatory Domains ── */}
            <motion.section
              className="mb-10"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.04, 0.1)}
            >

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
                  className="text-xs text-primary-600 mt-2"
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
                  <h2 className="text-base font-semibold text-slate-800">Compliance Calendar</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All regulatory deadlines for the current school year
                  </p>
                </div>
              </div>

              <ComplianceCalendar onEditRecord={openDrawer} />
            </motion.section>
        </div>
      </MotionConfig>

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
    </>
    </PagePadding>
  )
}

export default function CompliancePage() {
  usePageTitle('Compliance')
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <ComplianceContent />
    </Suspense>
  )
}
