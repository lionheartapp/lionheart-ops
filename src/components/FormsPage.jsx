import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  FileText,
  BarChart3,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { createForm, submissionToEvent } from '../data/formsData'
import { platformPost, platformPatch, platformFetch } from '../services/platformApi'
import { buildApproversMailtoUrl } from '../utils/pendingApprovals'
import FormBuilderModal from './FormBuilderModal'
import FormFillView from './FormFillView'
import FormSubmissionsView from './FormSubmissionsView'

export default function FormsPage({
  forms,
  setForms,
  formSubmissions,
  setFormSubmissions,
  currentUser,
  users = [],
  canEdit,
  formIdToFill,
  onClearFormIdToFill,
  formIdToPreview,
  onClearFormIdToPreview,
  formIdToViewResponses,
  onClearFormIdToViewResponses,
  onEventCreated,
  onCreateForm,
}) {
  const [view, setView] = useState('list') // 'list' | 'fill' | 'submissions'
  const [selectedFormId, setSelectedFormId] = useState(null)
  const [formBuilderOpen, setFormBuilderOpen] = useState(false)
  const [formToEdit, setFormToEdit] = useState(null)
  const [fillViewSource, setFillViewSource] = useState('list') // 'list' | 'editor'

  useEffect(() => {
    if (formIdToFill && forms.some((f) => f.id === formIdToFill)) {
      setSelectedFormId(formIdToFill)
      setView('fill')
      setFillViewSource('list')
      onClearFormIdToFill?.()
    }
  }, [formIdToFill, forms])

  useEffect(() => {
    if (formIdToPreview && forms.some((f) => f.id === formIdToPreview)) {
      setSelectedFormId(formIdToPreview)
      setView('fill')
      setFillViewSource('editor')
      onClearFormIdToPreview?.()
    }
  }, [formIdToPreview, forms])

  useEffect(() => {
    if (formIdToViewResponses && forms.some((f) => f.id === formIdToViewResponses)) {
      setSelectedFormId(formIdToViewResponses)
      setView('submissions')
      onClearFormIdToViewResponses?.()
    }
  }, [formIdToViewResponses, forms])

  const selectedForm = forms.find((f) => f.id === selectedFormId)

  const handleCreateForm = () => {
    const newForm = createForm(currentUser?.name)
    setForms((prev) => [...prev, newForm])
    setFormToEdit(newForm)
    setFormBuilderOpen(true)
  }

  const handleEditForm = (form) => {
    setFormToEdit(form)
    setFormBuilderOpen(true)
  }

  const handleCloseFormBuilder = () => {
    setFormBuilderOpen(false)
    setFormToEdit(null)
  }

  const handleDeleteForm = async (form) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return
    const isDbForm = form.id && !form.id.startsWith('form_')
    if (isDbForm) {
      try {
        const r = await platformFetch(`/api/forms/${form.id}`, { method: 'DELETE' })
        if (!r.ok) return
      } catch {
        return
      }
    }
    setForms((prev) => prev.filter((f) => f.id !== form.id))
    setFormSubmissions((prev) => prev.filter((s) => s.formId !== form.id))
    if (selectedFormId === form.id) {
      setSelectedFormId(null)
      setView('list')
    }
  }

  const handleSaveForm = async (updated) => {
    const isNew = updated.id && updated.id.startsWith('form_')
    try {
      const payload = {
        title: updated.title,
        description: updated.description ?? '',
        showTitle: updated.showTitle,
        fields: updated.fields,
        layout: updated.layout,
        formWidth: updated.formWidth,
        headerImage: updated.headerImage ?? '',
        sideImage: updated.sideImage ?? '',
        steps: updated.steps ?? [],
        approvalWorkflow: updated.approvalWorkflow,
        submissionType: updated.submissionType ?? 'general',
      }
      let saved
      if (isNew) {
        const r = await platformPost('/api/forms', payload)
        if (!r.ok) return
        saved = await r.json()
      } else {
        const r = await platformPatch(`/api/forms/${updated.id}`, payload)
        if (!r.ok) return
        saved = await r.json()
      }
      setForms((prev) =>
        prev.map((f) => (f.id === updated.id ? saved : f))
      )
      if (formToEdit?.id === updated.id) {
        setFormToEdit(saved)
      }
    } catch {
      // Fallback to local state on API error
      const saved = { ...updated, updatedAt: new Date().toISOString() }
      setForms((prev) => prev.map((f) => (f.id === updated.id ? saved : f)))
      if (formToEdit?.id === updated.id) setFormToEdit(saved)
    }
  }

  const handleBackToList = () => {
    setView('list')
    setSelectedFormId(null)
  }

  const handleBackFromFill = () => {
    if (fillViewSource === 'editor' && selectedForm && canEdit) {
      setFormToEdit(selectedForm)
      setFormBuilderOpen(true)
    }
    setView('list')
    setSelectedFormId(null)
  }

  const handlePreviewForm = (form) => {
    setSelectedFormId(form.id)
    setView('fill')
    setFillViewSource('editor')
    setFormBuilderOpen(false)
  }

  const handleFormSubmit = async (form, data) => {
    const workflow = form.approvalWorkflow
    const hasApproval = workflow?.approverIds?.length > 0
    const isDbForm = form.id && !form.id.startsWith('form_')
    if (isDbForm) {
      try {
        const r = await platformPost('/api/forms/submissions', {
          formId: form.id,
          data,
        })
        if (!r.ok) return
        const sub = await r.json()
        setFormSubmissions((prev) => [...prev, sub])
        if (!hasApproval && form.submissionType === 'event-request' && onEventCreated) {
          const event = submissionToEvent(form, sub)
          if (event) onEventCreated(event)
        }
        if (hasApproval && workflow.approverIds?.length) {
          const names = workflow.approverIds
            .map((id) => users.find((u) => u.id === id)?.name)
            .filter(Boolean)
            .join(', ')
          const mailtoUrl = buildApproversMailtoUrl(workflow.approverIds, users, form, sub)
          const message = `Request submitted! It's pending approval from ${names || 'the approvers'}.`
          if (mailtoUrl && window.confirm(`${message}\n\nWould you like to open your email client to notify them?`)) {
            window.location.href = mailtoUrl
          } else if (!mailtoUrl) {
            alert(message)
          }
        }
        return
      } catch {
        // Fall through to local-only path
      }
    }
    const sub = {
      id: `sub_${Date.now()}`,
      formId: form.id,
      data,
      submittedAt: new Date().toISOString(),
      submittedBy: currentUser?.name || 'Unknown',
      status: hasApproval ? 'pending' : 'approved',
      approvals: hasApproval
        ? workflow.approverIds.map((id) => ({ approverId: id, approved: null, at: null }))
        : null,
    }
    setFormSubmissions((prev) => [...prev, sub])
    if (!hasApproval && form.submissionType === 'event-request' && onEventCreated) {
      const event = submissionToEvent(form, sub)
      if (event) onEventCreated(event)
    }
    if (hasApproval && workflow.approverIds?.length) {
      const names = workflow.approverIds
        .map((id) => users.find((u) => u.id === id)?.name)
        .filter(Boolean)
        .join(', ')
      const mailtoUrl = buildApproversMailtoUrl(workflow.approverIds, users, form, sub)
      const message = `Request submitted! It's pending approval from ${names || 'the approvers'}.`
      if (mailtoUrl && window.confirm(`${message}\n\nWould you like to open your email client to notify them?`)) {
        window.location.href = mailtoUrl
      } else if (!mailtoUrl) {
        alert(message)
      }
    }
  }

  const submissions = selectedForm
    ? formSubmissions.filter((s) => s.formId === selectedForm.id)
    : []

  return (
    <>
      <FormBuilderModal
        isOpen={formBuilderOpen}
        onClose={handleCloseFormBuilder}
        form={formToEdit}
        onSave={handleSaveForm}
        canEdit={canEdit}
        users={users}
        onPreview={handlePreviewForm}
        onPreviewSubmit={(form, data) => handleFormSubmit(form, data)}
      />

      {view === 'submissions' && selectedForm ? (
        <FormSubmissionsView
          form={selectedForm}
          submissions={submissions}
          setFormSubmissions={setFormSubmissions}
          currentUser={currentUser}
          onEventCreated={onEventCreated}
          users={users}
          onBack={handleBackToList}
        />
      ) : view === 'fill' && selectedForm ? (
        <FormFillView
          form={selectedForm}
          isPreview={fillViewSource === 'editor'}
          onSubmit={(data) => {
            handleFormSubmit(selectedForm, data)
            setView('list')
            setSelectedFormId(null)
          }}
          onBack={handleBackFromFill}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {forms.length === 0 ? (
            <div className="glass-card p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">No forms yet</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
            {canEdit ? 'Create a form to start collecting responses.' : 'No forms have been shared with you.'}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => (onCreateForm ?? handleCreateForm)?.()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Create your first form
            </button>
            )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => {
            const count = formSubmissions.filter((s) => s.formId === form.id).length
            return (
              <div
                key={form.id}
                className="glass-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1">
                    {form.title || 'Untitled form'}
                  </h3>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteForm(form)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                        aria-label="Delete form"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {form.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{form.description}</p>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {form.fields?.length ?? 0} fields · {count} response{count !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleEditForm(form)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSelectedFormId(form.id); setView('fill'); setFillViewSource('list') }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-300 text-sm font-medium hover:bg-blue-500/25"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Fill out
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => { setSelectedFormId(form.id); setView('submissions') }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Responses ({count})
                    </button>
                  )}
                </div>
              </div>
            )
            })}
            </div>
          )}
        </motion.div>
      )}
    </>
  )
}
