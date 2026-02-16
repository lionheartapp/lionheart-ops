import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Search, Check, X } from 'lucide-react'
import { submissionToEvent } from '../data/formsData'
import { platformPatch } from '../services/platformApi'

function escapeCsvCell(s) {
  const str = String(s ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function FormSubmissionsView({
  form,
  submissions,
  setFormSubmissions,
  currentUser,
  onEventCreated,
  users = [],
  onBack,
}) {
  const [search, setSearch] = useState('')

  const workflow = form?.approvalWorkflow
  const hasApproval = workflow?.approverIds?.length > 0
  const currentUserId = currentUser?.id

  const handleApprove = useCallback(
    async (sub, approved) => {
      if (!setFormSubmissions || !currentUserId) return
      const myApproval = sub.approvals?.find((a) => a.approverId === currentUserId)
      if (myApproval?.approved != null) return

      const now = new Date().toISOString()
      const nextApprovals = sub.approvals.map((a) =>
        a.approverId === currentUserId ? { ...a, approved, at: now } : a
      )
      const allApproved = nextApprovals.every((a) => a.approved === true)
      const anyRejected = nextApprovals.some((a) => a.approved === false)

      const updated = {
        ...sub,
        approvals: nextApprovals,
        status: anyRejected ? 'rejected' : allApproved ? 'approved' : 'pending',
        eventId: allApproved && form.submissionType === 'event-request' ? `ev_${sub.id}` : sub.eventId,
      }

      const isDbSub = sub.id && !String(sub.id).startsWith('sub_')
      if (isDbSub) {
        try {
          const r = await platformPatch(`/api/forms/submissions/${sub.id}`, {
            status: updated.status,
            approvals: nextApprovals,
            eventId: updated.eventId ?? null,
          })
          if (!r.ok) return
          const saved = await r.json()
          updated.submittedAt = saved.submittedAt
        } catch {
          return
        }
      }

      setFormSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? updated : s))
      )

      if (allApproved && form.submissionType === 'event-request' && onEventCreated) {
        const event = submissionToEvent(form, updated)
        if (event) onEventCreated(event)
      }
    },
    [setFormSubmissions, currentUserId, form, onEventCreated]
  )

  const canApprove = (sub) =>
    hasApproval &&
    sub.status === 'pending' &&
    workflow.approverIds.includes(currentUserId) &&
    sub.approvals?.find((a) => a.approverId === currentUserId)?.approved == null

  const fields = form.fields || []
  const columns = fields
    .filter((f) => !['hidden', 'section', 'table'].includes(f.type))
    .map((f) => ({ id: f.id, label: f.label }))

  const filtered = useMemo(() => {
    if (!search.trim()) return submissions
    const q = search.trim().toLowerCase()
    return submissions.filter((sub) => {
      const data = sub.data || {}
      return Object.values(data).some((v) => String(v).toLowerCase().includes(q))
    })
  }, [submissions, search])

  const exportCsv = () => {
    const headers = ['Submitted at', ...(hasApproval ? ['Status'] : []), ...columns.map((c) => c.label)]
    const rows = filtered.map((sub) => {
      const date = sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleString()
        : ''
      const statusCell = hasApproval ? [sub.status || '—'] : []
      const cells = columns.map((c) => {
        const v = sub.data?.[c.id]
        if (v == null) return ''
        if (typeof v === 'object') return JSON.stringify(v)
        return v
      })
      return [date, ...statusCell, ...cells]
    })
    const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(form.title || 'form').replace(/[^a-z0-9-_]/gi, '_')}_responses.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Responses: {form.title || 'Untitled form'}
        </h2>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search responses..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {filtered.length} response{filtered.length !== 1 ? 's' : ''}
          {search.trim() && ` (filtered from ${submissions.length})`}
        </p>

        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
            No responses yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-600">
                  <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Submitted
                  </th>
                  {hasApproval && (
                    <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Status
                    </th>
                  )}
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      {c.label}
                    </th>
                  ))}
                  {hasApproval && (
                    <th className="text-left py-2 px-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleString()
                        : '—'}
                    </td>
                    {hasApproval && (
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            sub.status === 'approved'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : sub.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {sub.status || 'pending'}
                        </span>
                      </td>
                    )}
                    {columns.map((c) => {
                      const v = sub.data?.[c.id]
                      let display = v == null ? '—' : Array.isArray(v) ? v.join(', ') : String(v)
                      if (typeof v === 'string' && v.startsWith('data:image')) {
                        display = '[Signature]'
                      }
                      return (
                        <td key={c.id} className="py-2 px-3 max-w-[200px] truncate" title={display}>
                          {display}
                        </td>
                      )
                    })}
                    {hasApproval && (
                      <td className="py-2 px-3">
                        {canApprove(sub) ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleApprove(sub, true)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/15 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-500/25"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(sub, false)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-500/25"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
