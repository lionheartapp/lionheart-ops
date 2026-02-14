import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, LayoutTemplate, Workflow, Shield, ArrowLeft, Smartphone, Tablet, Monitor, Trash2 } from 'lucide-react'
import FormBuilder from './FormBuilder'
import FormFillView from './FormFillView'

function WorkflowTab({ form, onSave, canEdit, users }) {
  const workflow = form?.approvalWorkflow
  const approverIds = workflow?.approverIds || []
  const submissionType = form?.submissionType || 'general'

  const handleAddApprover = (userId) => {
    if (!userId || approverIds.includes(userId)) return
    onSave({
      ...form,
      approvalWorkflow: { approverIds: [...approverIds, userId], type: 'all' },
    })
  }

  const handleRemoveApprover = (userId) => {
    onSave({
      ...form,
      approvalWorkflow: {
        approverIds: approverIds.filter((id) => id !== userId),
        type: 'all',
      },
    })
  }

  const handleSetSubmissionType = (type) => {
    onSave({ ...form, submissionType: type })
  }

  const availableApprovers = users.filter((u) => !approverIds.includes(u.id))

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Submission type</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSetSubmissionType('general')}
            disabled={!canEdit}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              submissionType === 'general'
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => handleSetSubmissionType('event-request')}
            disabled={!canEdit}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              submissionType === 'event-request'
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Event request
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Event request forms create calendar events once all approvers approve.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Approvers</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          All listed approvers must approve before the submission is finalized.
        </p>
        <div className="space-y-2">
          {approverIds.map((id) => {
            const user = users.find((u) => u.id === id)
            return (
              <div
                key={id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800"
              >
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{user?.name || id}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveApprover(id)}
                    className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
          {canEdit && availableApprovers.length > 0 && (
            <select
              value=""
              onChange={(e) => { const v = e.target.value; if (v) handleAddApprover(v); e.target.value = '' }}
              className="mt-2 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
            >
              <option value="">Add approver...</option>
              {availableApprovers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          {approverIds.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
              No approvers. Add approvers so submissions require approval before being finalized.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'fields', label: 'Fields', icon: LayoutTemplate },
  { id: 'workflow', label: 'Workflow', icon: Workflow },
  { id: 'permissions', label: 'Permissions', icon: Shield },
]

export default function FormBuilderModal({
  isOpen,
  onClose,
  form,
  onSave,
  canEdit,
  users = [],
  onPreview,
  onPreviewSubmit,
}) {
  const [activeTab, setActiveTab] = useState('fields')
  const [lastSaved, setLastSaved] = useState(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewViewport, setPreviewViewport] = useState('desktop')
  const formBuilderRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setActiveTab('fields')
      setPreviewMode(false)
      setPreviewViewport('desktop')
    }
  }, [isOpen])

  const handleSave = (updated) => {
    onSave(updated)
    setLastSaved(new Date())
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        />
        {/* Top bar with close button */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 h-20 z-[70] flex items-center justify-end px-6 pointer-events-none"
        >
          <button
            onClick={onClose}
            className="pointer-events-auto p-2 rounded-xl bg-zinc-900/80 text-zinc-100 hover:bg-zinc-900 transition-colors shadow-lg shadow-black/30"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
        {/* Full-width sheet - animates to full screen when preview opens */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{
            y: 0,
            top: previewMode ? 0 : 80,
            height: previewMode ? '100vh' : 'calc(100vh - 5rem)',
          }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="form-builder-light fixed inset-x-0 bottom-0 z-[70] flex flex-col bg-zinc-100 shadow-2xl border border-b-0 border-zinc-200 overflow-hidden rounded-t-3xl"
          style={{
            ...(previewMode && { borderRadius: 0 }),
          }}
        >
          {/* Drag handle on mobile - hide in preview */}
          {!previewMode && (
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
              <div className="w-12 h-1 rounded-full bg-zinc-400" aria-hidden />
            </div>
          )}

          <AnimatePresence mode="wait">
            {previewMode ? (
              /* Preview mode: header + form preview */
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col flex-1 min-h-0"
              >
                {/* Preview header – back / device selector / publish */}
                <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 font-medium hover:bg-zinc-50 transition-colors text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Form Builder
                  </button>
                  {/* Device breakpoint selector */}
                  <div className="inline-flex p-1 rounded-lg bg-zinc-200/80" role="group" aria-label="Preview viewport size">
                    {[
                      { id: 'mobile', label: 'Mobile', Icon: Smartphone },
                      { id: 'tablet', label: 'Tablet', Icon: Tablet },
                      { id: 'desktop', label: 'Desktop', Icon: Monitor },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPreviewViewport(id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          previewViewport === id
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-600 hover:text-zinc-800'
                        }`}
                        title={`Preview as ${label}`}
                        aria-pressed={previewViewport === id}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSave(form)
                      onClose()
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors text-sm"
                  >
                    Publish
                  </button>
                </div>
                {/* Form preview – viewport frame for device breakpoints */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 min-h-0 flex flex-col overflow-hidden min-w-0"
                >
                  <div
                    className="form-preview-light w-full h-full flex flex-col min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
                    style={
                      previewViewport === 'mobile'
                        ? { maxWidth: '390px', marginLeft: 'auto', marginRight: 'auto' }
                        : previewViewport === 'tablet'
                          ? { maxWidth: '768px', marginLeft: 'auto', marginRight: 'auto' }
                          : undefined
                    }
                  >
                    {form && (
                      <FormFillView
                        form={form}
                        isPreview
                        previewViewport={previewViewport}
                        hideBackButton
                        onSubmit={onPreviewSubmit ? (data) => onPreviewSubmit(form, data) : () => {}}
                        onBack={() => setPreviewMode(false)}
                      />
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              /* Builder mode: original header + tab content */
              <motion.div
                key="builder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1 min-h-0"
              >
                {/* Header */}
                <div className="flex-shrink-0 px-6 lg:px-8 py-4 border-b border-zinc-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-4 sm:flex-1 sm:min-w-0">
                      <div>
                        <h2 className="form-builder-title text-base font-semibold leading-tight">
                          Form Builder
                        </h2>
                        <p className="form-builder-desc text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Add and customize form fields for your needs.
                        </p>
                      </div>
                      <div className="hidden md:flex items-center flex-1 justify-center">
                        <div className="inline-flex p-1 rounded-lg bg-zinc-300/60">
                          {TABS.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-zinc-900 shadow-sm'
                                    : 'text-zinc-600 hover:text-zinc-800'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lastSaved && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Saved {lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      {onPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            formBuilderRef.current?.save?.()
                            setPreviewMode(true)
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 text-sm font-medium hover:bg-zinc-200"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                      )}
                      {canEdit && activeTab === 'fields' && (
                        <button
                          type="button"
                          onClick={() => formBuilderRef.current?.save?.()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          Save form
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex md:hidden justify-center mt-2">
                    <div className="inline-flex p-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/50">
                      {TABS.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                              isActive
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Tab content - full width */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full">
                  {activeTab === 'fields' && form && (
                    <div className="flex-1 min-h-0 overflow-auto p-6 lg:p-8 w-full">
                      <FormBuilder
                        ref={formBuilderRef}
                        form={form}
                        onSave={handleSave}
                        onBack={onClose}
                        canEdit={canEdit}
                        embedded
                      />
                    </div>
                  )}
                  {activeTab === 'workflow' && (
                    <div className="flex-1 overflow-auto p-6 lg:p-8">
                      <WorkflowTab
                        form={form}
                        onSave={onSave}
                        canEdit={canEdit}
                        users={users}
                      />
                    </div>
                  )}
                  {activeTab === 'permissions' && (
                    <div className="flex-1 overflow-auto p-6 lg:p-8">
                      <div className="glass-card p-12 text-center">
                        <Shield className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-4" />
                        <p className="font-medium text-zinc-700 dark:text-zinc-300">Role-based permissions</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                          Control who can edit, sign, or approve form submissions. Coming soon.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
