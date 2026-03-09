'use client'

import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryOptions } from '@/lib/queries'
import { fetchApi } from '@/lib/api-client'
import {
  ShieldAlert, Plus, ChevronRight, Clock, Eye, Users,
  AlertTriangle, FileText, Send, X, CheckCircle, Lock, Activity,
} from 'lucide-react'
import ITSearchFilterBar from './ITSearchFilterBar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Incident {
  id: string
  incidentNumber: string
  type: string
  severity: string
  status: string
  title: string
  description: string
  affectedSystems: string[]
  affectedDeviceIds: string[]
  affectedUserIds: string[]
  piiInvolved: boolean
  reportedById: string
  responderIds: string[]
  evidenceFiles: { url: string; fileName: string; fileHash: string; uploadedAt: string }[]
  externalNotifications: { recipientType: string; method: string; sentAt: string; notes?: string }[]
  resolutionSummary: string | null
  lessonsLearned: string | null
  createdAt: string
  closedAt: string | null
  retainUntil: string
  reportedBy: { id: string; firstName: string | null; lastName: string | null; email: string }
  school: { id: string; name: string } | null
  _count: { activities: number }
  activities?: ActivityEntry[]
}

interface ActivityEntry {
  id: string
  type: string
  fromStatus?: string | null
  toStatus?: string | null
  fromSeverity?: string | null
  toSeverity?: string | null
  content?: string | null
  createdAt: string
  actor?: { id: string; firstName: string | null; lastName: string | null } | null
}

interface Props {
  canCreate: boolean
  canManage: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  INVESTIGATING: 'bg-purple-100 text-purple-700',
  CONTAINED: 'bg-teal-100 text-teal-700',
  REMEDIATING: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

const TYPE_LABELS: Record<string, string> = {
  PHISHING: 'Phishing',
  DEVICE_LOST_STOLEN: 'Device Lost/Stolen',
  UNAUTHORIZED_ACCESS: 'Unauthorized Access',
  MALWARE: 'Malware',
  DATA_BREACH: 'Data Breach',
  ACCOUNT_COMPROMISE: 'Account Compromise',
  RANSOMWARE: 'Ransomware',
  POLICY_VIOLATION: 'Policy Violation',
  OTHER: 'Other',
}

const SEVERITY_LABELS: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }
const STATUS_LABELS: Record<string, string> = { OPEN: 'Open', INVESTIGATING: 'Investigating', CONTAINED: 'Contained', REMEDIATING: 'Remediating', CLOSED: 'Closed' }

const INCIDENT_TYPES = Object.keys(TYPE_LABELS)
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const STATUSES = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'REMEDIATING', 'CLOSED']

// ─── Component ───────────────────────────────────────────────────────────────

export default function ITSecurityIncidentsTab({ canCreate, canManage }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  // ─── List Query ──────────────────────────────────────────────────────────
  const filters: Record<string, string> = {}
  if (search) filters.search = search
  if (severityFilter) filters.severity = severityFilter
  if (statusFilter) filters.status = statusFilter

  const opts = queryOptions.securityIncidents(filters)
  const { data, isLoading } = useQuery<{ incidents: Incident[]; total: number }>({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn as () => Promise<{ incidents: Incident[]; total: number }>,
    staleTime: opts.staleTime,
  })
  const incidents = data?.incidents ?? []
  const total = data?.total ?? 0

  // ─── Detail Query ────────────────────────────────────────────────────────
  const detailOpts = detailId ? queryOptions.securityIncidentDetail(detailId) : null
  const { data: detailData } = useQuery<Incident>({
    queryKey: detailOpts?.queryKey ?? ['noop'],
    queryFn: detailOpts?.queryFn as () => Promise<Incident>,
    staleTime: detailOpts?.staleTime,
    enabled: !!detailId,
  })

  // ─── Stats ───────────────────────────────────────────────────────────────
  const openCount = incidents.filter((i) => i.status !== 'CLOSED').length
  const investigatingCount = incidents.filter((i) => i.status === 'INVESTIGATING').length
  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length

  // ─── Create Mutation ─────────────────────────────────────────────────────
  const [formType, setFormType] = useState('PHISHING')
  const [formSeverity, setFormSeverity] = useState('MEDIUM')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSystems, setFormSystems] = useState('')
  const [formPii, setFormPii] = useState(false)

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetchApi('/api/it/incidents', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.securityIncidents.all })
      setShowCreate(false)
      setFormTitle('')
      setFormDesc('')
      setFormSystems('')
      setFormPii(false)
    },
  })

  // ─── Status Update ───────────────────────────────────────────────────────
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchApi(`/api/it/incidents/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.securityIncidents.all })
      if (detailId) qc.invalidateQueries({ queryKey: queryKeys.securityIncidentDetail.byId(detailId) })
    },
  })

  // ─── Close Mutation ──────────────────────────────────────────────────────
  const [closeResolution, setCloseResolution] = useState('')
  const [closeLessons, setCloseLessons] = useState('')
  const [showCloseForm, setShowCloseForm] = useState(false)

  const closeMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetchApi(`/api/it/incidents/${id}/close`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.securityIncidents.all })
      if (detailId) qc.invalidateQueries({ queryKey: queryKeys.securityIncidentDetail.byId(detailId) })
      setShowCloseForm(false)
      setCloseResolution('')
      setCloseLessons('')
    },
  })

  const handleCreate = () => {
    const systems = formSystems.split(',').map((s) => s.trim()).filter(Boolean)
    createMut.mutate({
      type: formType,
      severity: formSeverity,
      title: formTitle,
      description: formDesc,
      affectedSystems: systems,
      piiInvolved: formPii,
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <ITSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search incidents..."
        filters={[
          { label: 'Severity', value: severityFilter, onChange: setSeverityFilter, options: [
            { value: '', label: 'All Severities' },
            ...SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] })),
          ]},
          { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: [
            { value: '', label: 'All Statuses' },
            ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]},
        ]}
        trailing={canCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-[0.97] transition-all flex items-center gap-2 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            Report Incident
          </button>
        ) : undefined}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ui-glass p-4 text-center">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{openCount}</div>
          <div className="text-xs text-gray-500">Open Incidents</div>
        </div>
        <div className="ui-glass p-4 text-center">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-2">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{investigatingCount}</div>
          <div className="text-xs text-gray-500">Investigating</div>
        </div>
        <div className="ui-glass p-4 text-center">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>{criticalCount}</div>
          <div className="text-xs text-gray-500">Critical Active</div>
        </div>
        <div className="ui-glass p-4 text-center">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">Total Incidents</div>
        </div>
      </div>

      {/* Incidents table */}
      {isLoading ? (
        <div className="ui-glass-table animate-pulse p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-4 flex-1 bg-gray-100 rounded" />
              <div className="h-5 w-20 bg-gray-100 rounded-md" />
              <div className="h-5 w-16 bg-gray-100 rounded-md" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="ui-glass p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No incidents found</h3>
          <p className="text-sm text-gray-500">No security incidents match your current filters.</p>
        </div>
      ) : (
        <div className="ui-glass-table overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-3 pl-4 font-medium text-gray-500">ID</th>
                <th className="text-left p-3 font-medium text-gray-500">Title</th>
                <th className="text-left p-3 font-medium text-gray-500">Type</th>
                <th className="text-left p-3 font-medium text-gray-500">Severity</th>
                <th className="text-left p-3 font-medium text-gray-500">Status</th>
                <th className="text-left p-3 font-medium text-gray-500">Reported</th>
                <th className="text-left p-3 font-medium text-gray-500">Responders</th>
                <th className="p-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => setDetailId(inc.id)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <td className="p-3 pl-4 font-mono text-xs text-gray-500">{inc.incidentNumber}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {inc.piiInvolved && <Lock className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      <span className="font-medium text-gray-900 truncate max-w-xs">{inc.title}</span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{TYPE_LABELS[inc.type] || inc.type}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${SEVERITY_COLORS[inc.severity]} ${inc.severity === 'CRITICAL' ? 'animate-pulse' : ''}`}>
                      {SEVERITY_LABELS[inc.severity]}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[inc.status]}`}>
                      {STATUS_LABELS[inc.status]}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{new Date(inc.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs">{inc.responderIds.length}</span>
                    </div>
                  </td>
                  <td className="p-3 pr-4">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Create Drawer ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-[fadeIn_200ms_ease-out]">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900">Report Security Incident</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Incident Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm cursor-pointer">
                  {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
                <div className="flex gap-2">
                  {SEVERITIES.map((s) => (
                    <button key={s} onClick={() => setFormSeverity(s)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${formSeverity === s ? SEVERITY_COLORS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                      {SEVERITY_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Brief incident title" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={4} placeholder="What happened? When was it discovered?" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected Systems (comma-separated)</label>
                <input type="text" value={formSystems} onChange={(e) => setFormSystems(e.target.value)} placeholder="e.g. Email, Student Portal, WiFi" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={formPii} onChange={(e) => setFormPii(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <div>
                  <span className="text-sm font-medium text-gray-900">PII Involved</span>
                  <p className="text-xs text-gray-500">Personally identifiable information may have been compromised</p>
                </div>
              </label>
              <button
                onClick={handleCreate}
                disabled={!formTitle || !formDesc || createMut.isPending}
                className="w-full px-5 py-3 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {createMut.isPending ? 'Submitting...' : 'Report Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Drawer ──────────────────────────────────────────────────── */}
      {detailId && detailData && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setDetailId(null); setShowCloseForm(false) }} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto animate-[fadeIn_200ms_ease-out]">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-500">{detailData.incidentNumber}</span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${SEVERITY_COLORS[detailData.severity]} ${detailData.severity === 'CRITICAL' ? 'animate-pulse' : ''}`}>
                    {SEVERITY_LABELS[detailData.severity]}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[detailData.status]}`}>
                    {STATUS_LABELS[detailData.status]}
                  </span>
                  {detailData.piiInvolved && <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">PII</span>}
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-1">{detailData.title}</h2>
              </div>
              <button onClick={() => { setDetailId(null); setShowCloseForm(false) }} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info section */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Type:</span> <span className="ml-1 font-medium">{TYPE_LABELS[detailData.type]}</span></div>
                <div><span className="text-gray-500">Reported by:</span> <span className="ml-1 font-medium">{detailData.reportedBy?.firstName} {detailData.reportedBy?.lastName}</span></div>
                <div><span className="text-gray-500">Created:</span> <span className="ml-1">{new Date(detailData.createdAt).toLocaleString()}</span></div>
                {detailData.closedAt && <div><span className="text-gray-500">Closed:</span> <span className="ml-1">{new Date(detailData.closedAt).toLocaleString()}</span></div>}
                <div><span className="text-gray-500">Retain until:</span> <span className="ml-1">{new Date(detailData.retainUntil).toLocaleDateString()}</span></div>
                {detailData.school && <div><span className="text-gray-500">School:</span> <span className="ml-1">{detailData.school.name}</span></div>}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-xl">{detailData.description}</p>
              </div>

              {/* Affected systems */}
              {detailData.affectedSystems.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Affected Systems</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detailData.affectedSystems.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution */}
              {detailData.resolutionSummary && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Resolution Summary</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-green-50 p-3 rounded-xl border border-green-100">{detailData.resolutionSummary}</p>
                </div>
              )}
              {detailData.lessonsLearned && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Lessons Learned</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-blue-50 p-3 rounded-xl border border-blue-100">{detailData.lessonsLearned}</p>
                </div>
              )}

              {/* Evidence */}
              {detailData.evidenceFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Evidence Files</h3>
                  <div className="space-y-1.5">
                    {detailData.evidenceFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{f.fileName}</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(f.uploadedAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External notifications */}
              {detailData.externalNotifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">External Notifications</h3>
                  <div className="space-y-1.5">
                    {detailData.externalNotifications.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                        <Send className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{n.recipientType}</span>
                        <span className="text-gray-400">via {n.method}</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(n.sentAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {detailData.status !== 'CLOSED' && (
                <div className="flex flex-wrap gap-2">
                  {detailData.status === 'OPEN' && (
                    <button onClick={() => statusMut.mutate({ id: detailId, status: 'INVESTIGATING' })} className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 active:scale-[0.97] transition-all cursor-pointer">Begin Investigation</button>
                  )}
                  {detailData.status === 'INVESTIGATING' && (
                    <>
                      <button onClick={() => statusMut.mutate({ id: detailId, status: 'CONTAINED' })} className="px-4 py-2 rounded-full bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 active:scale-[0.97] transition-all cursor-pointer">Mark Contained</button>
                      <button onClick={() => statusMut.mutate({ id: detailId, status: 'REMEDIATING' })} className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 active:scale-[0.97] transition-all cursor-pointer">Begin Remediation</button>
                    </>
                  )}
                  {detailData.status === 'CONTAINED' && (
                    <button onClick={() => statusMut.mutate({ id: detailId, status: 'REMEDIATING' })} className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 active:scale-[0.97] transition-all cursor-pointer">Begin Remediation</button>
                  )}
                  {canManage && (
                    <button onClick={() => setShowCloseForm(true)} className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer">Close Incident</button>
                  )}
                </div>
              )}

              {/* Close form */}
              {showCloseForm && detailData.status !== 'CLOSED' && (
                <div className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Close Incident</h3>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Resolution Summary *</label>
                    <textarea value={closeResolution} onChange={(e) => setCloseResolution(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none" placeholder="How was this incident resolved?" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Lessons Learned</label>
                    <textarea value={closeLessons} onChange={(e) => setCloseLessons(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none" placeholder="What can be improved?" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => closeMut.mutate({ id: detailId, body: { resolutionSummary: closeResolution, lessonsLearned: closeLessons || undefined } })}
                      disabled={!closeResolution || closeMut.isPending}
                      className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
                    >
                      {closeMut.isPending ? 'Closing...' : 'Confirm Close'}
                    </button>
                    <button onClick={() => setShowCloseForm(false)} className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}

              {/* Chain-of-custody timeline */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Chain of Custody</h3>
                <div className="space-y-0">
                  {(detailData.activities ?? [])
                    .filter((a) => a.type !== 'VIEWED')
                    .map((activity, idx) => (
                      <div key={activity.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            activity.type === 'CREATED' ? 'bg-blue-500' :
                            activity.type === 'STATUS_CHANGE' ? 'bg-purple-500' :
                            activity.type === 'SEVERITY_CHANGE' ? 'bg-orange-500' :
                            activity.type === 'CLOSED' ? 'bg-gray-500' :
                            activity.type === 'COMMENT' ? 'bg-green-500' :
                            'bg-gray-300'
                          }`} />
                          {idx < (detailData.activities?.filter((a) => a.type !== 'VIEWED').length ?? 0) - 1 && (
                            <div className="w-px flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-700">
                              {activity.actor ? `${activity.actor.firstName ?? ''} ${activity.actor.lastName ?? ''}`.trim() : 'System'}
                            </span>
                            <span className="text-gray-400">&middot;</span>
                            <span className="text-gray-400">{new Date(activity.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {activity.type === 'STATUS_CHANGE' && `Status: ${STATUS_LABELS[activity.fromStatus ?? ''] ?? activity.fromStatus} → ${STATUS_LABELS[activity.toStatus ?? ''] ?? activity.toStatus}`}
                            {activity.type === 'SEVERITY_CHANGE' && `Severity: ${SEVERITY_LABELS[activity.fromSeverity ?? ''] ?? activity.fromSeverity} → ${SEVERITY_LABELS[activity.toSeverity ?? ''] ?? activity.toSeverity}`}
                            {activity.type === 'CREATED' && (activity.content || 'Incident created')}
                            {activity.type === 'CLOSED' && 'Incident closed'}
                            {activity.type === 'COMMENT' && activity.content}
                            {activity.type === 'RESPONDER_ADDED' && activity.content}
                            {activity.type === 'RESPONDER_REMOVED' && activity.content}
                            {activity.type === 'EVIDENCE_ATTACHED' && activity.content}
                            {activity.type === 'EXTERNAL_NOTIFICATION' && activity.content}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
