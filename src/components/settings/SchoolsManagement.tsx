'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { getAuthHeaders as getCookieAuthHeaders, fetchApi } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Plus, Edit2, Trash2, Check } from 'lucide-react'
import type { School } from '@prisma/client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { IllustrationCampus } from '@/components/illustrations'
import PrincipalSearch from '@/components/settings/schools/PrincipalSearch'
import PrincipalEditorDrawer from '@/components/settings/schools/PrincipalEditorDrawer'
import SchoolSuccessModal from '@/components/settings/schools/SchoolSuccessModal'
import {
  GRADE_LEVEL_DEFAULTS,
  COLOR_PRESETS,
  EMPTY_FORM,
  formatPhoneInput,
  normalizeExtensionInput,
  isValidPhoneValue,
} from '@/lib/school-utils'
import type { SchoolFormData, SuccessModalData, PrincipalEditorData } from '@/lib/school-utils'

type SchoolData = Pick<School, 'id' | 'name' | 'color' | 'principalName' | 'principalEmail' | 'principalPhone' | 'principalPhoneExt' | 'createdAt' | 'updatedAt'>

export type SchoolsManagementHandle = {
  openNew: () => void
  openEdit: (schoolId: string) => void | Promise<void>
  promptDelete: (schoolId: string) => void
  /** Called after any change so parent can refresh facility views */
  reload: () => void
}

interface SchoolsManagementProps {
  campusId?: string
  /** Hide the default Schools table + header; only render drawers/modals. Use the ref API to drive CRUD. */
  hideTable?: boolean
  /** Called whenever schools list changes so parent components can refresh. */
  onSchoolsChanged?: () => void
}

const SchoolsManagement = forwardRef<SchoolsManagementHandle, SchoolsManagementProps>(function SchoolsManagement(
  { campusId: campusIdProp, hideTable = false, onSchoolsChanged }: SchoolsManagementProps,
  ref
) {
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SchoolFormData>(EMPTY_FORM)
  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  // Auto-resolve campusId when not provided
  const [resolvedCampusId, setResolvedCampusId] = useState<string | null>(null)
  const campusId = campusIdProp || resolvedCampusId

  // Fetch first campus if no campusId prop provided, auto-create one if none exist
  useEffect(() => {
    if (campusIdProp) return
    const resolveOrCreateCampus = async () => {
      try {
        // Use fetchApi so CSRF cookie-bootstrap + one-time retry is handled transparently.
        const campuses = await fetchApi<Array<{ id: string }>>(
          '/api/settings/campus/campuses'
        )
        if (Array.isArray(campuses) && campuses.length > 0) {
          setResolvedCampusId(campuses[0].id)
          return
        }

        // No campuses exist — auto-create "Main Campus" with org address
        let orgAddress: string | null = null
        try {
          const orgData = await fetchApi<{ physicalAddress?: string | null }>(
            '/api/onboarding/school-info'
          )
          orgAddress = orgData?.physicalAddress ?? null
        } catch { /* silent — fall back to no address */ }

        const created = await fetchApi<{ id: string }>(
          '/api/settings/campus/campuses',
          {
            method: 'POST',
            body: JSON.stringify({
              name: 'Main Campus',
              campusKind: 'HEADQUARTERS',
              address: orgAddress,
            }),
          }
        )
        if (created?.id) {
          setResolvedCampusId(created.id)
        }
      } catch { /* silent */ }
    }
    resolveOrCreateCampus()
  }, [campusIdProp])

  // Principal search/create
  const [principalSearch, setPrincipalSearch] = useState('')
  const [createdPrincipalInFlow, setCreatedPrincipalInFlow] = useState(false)

  // Success modal
  const [successData, setSuccessData] = useState<SuccessModalData | null>(null)
  const [principalEditor, setPrincipalEditor] = useState<PrincipalEditorData | null>(null)
  const [principalEditorOpen, setPrincipalEditorOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Expose imperative API so parent components (e.g. SchoolGroupedFacilities
  // inside CampusTab) can drive Add/Edit/Delete from their own buttons while
  // we keep ownership of drawers + modals here.
  useImperativeHandle(
    ref,
    () => ({
      openNew: () => handleOpenNew(),
      openEdit: async (schoolId: string) => {
        // First try local state
        const local = schools.find((s) => s.id === schoolId)
        if (local) {
          handleEdit(local)
          return
        }
        // Fallback: fetch all schools and find the target
        try {
          const allSchools = await fetchApi<SchoolData[]>('/api/settings/schools')
          const found = Array.isArray(allSchools) ? allSchools.find((s) => s.id === schoolId) : undefined
          if (found) {
            setSchools(allSchools)
            handleEdit(found)
          }
        } catch {
          // silent — school not found
        }
      },
      promptDelete: (schoolId: string) => setDeleteConfirmId(schoolId),
      reload: () => loadSchools(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schools]
  )

  const getAuthHeaders = () => getCookieAuthHeaders()

  const loadSchools = async () => {
    setLoading(true)
    setError('')
    try {
      const url = campusId ? `/api/settings/schools?campusId=${campusId}` : '/api/settings/schools'
      const response = await fetch(url, {
        credentials: 'include',
        headers: getAuthHeaders(),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to load schools')
      }

      setSchools(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchools()
  }, [campusId])

  const handleSaveSchool = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (form.principalPhone && !isValidPhoneValue(form.principalPhone)) {
        throw new Error('Principal phone must be a valid phone number')
      }

      if (form.principalPhoneExt && !/^\d{1,6}$/.test(form.principalPhoneExt)) {
        throw new Error('Extension must be numeric and up to 6 digits')
      }

      const url = editingId ? `/api/settings/schools/${editingId}` : '/api/settings/schools'
      const method = editingId ? 'PATCH' : 'POST'

      if (!editingId && !campusId) {
        throw new Error('No campus available. Please create a campus first.')
      }
      const body = !editingId ? { ...form, campusId } : form

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      })

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        logger.error({ error: String(jsonError) }, 'Failed to parse response JSON')
        throw new Error(`Server error (${response.status}): Failed to parse response`)
      }

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.error || `Server error (${response.status})`
        throw new Error(errorMessage)
      }

      if (!data.ok) {
        throw new Error(data?.error?.message || `Failed to ${editingId ? 'update' : 'create'} school`)
      }

      if (editingId) {
        // Update existing school
        setSchools((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  name: form.name,
                  color: form.color,
                  principalName: form.principalName || null,
                  principalEmail: form.principalEmail || null,
                  principalPhone: form.principalPhone || null,
                  principalPhoneExt: form.principalPhoneExt || null,
                }
              : s
          )
        )
        // Close immediately for edits
        setShowModal(false)
        setEditingId(null)
        setForm(EMPTY_FORM)
        setCreatedPrincipalInFlow(false)
        setPrincipalSearch('')
        onSchoolsChanged?.()
      } else {
        // For new schools, show success modal only when principal was created via Add Principal
        if (createdPrincipalInFlow) {
          setSuccessData({
            schoolId: data.data.id,
            schoolName: form.name,
            principalId: selectedPrincipalId,
            principalName: form.principalName,
            principalEmail: form.principalEmail,
            principalPhone: form.principalPhone,
            principalPhoneExt: form.principalPhoneExt,
            principalJobTitle: 'Principal',
          })
        }
        setSchools((prev) => [...prev, data.data])
        setShowModal(false)
        setEditingId(null)
        setForm(EMPTY_FORM)
        setSelectedPrincipalId(null)
        setCreatedPrincipalInFlow(false)
        setPrincipalSearch('')
        onSchoolsChanged?.()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save school'
      logger.error({ error: message }, 'Save school error')
      setError(message)
      // Do NOT close modal on error
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSchool = async (id: string) => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/settings/schools/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to delete school')
      }

      setSchools((prev) => prev.filter((s) => s.id !== id))
      setDeleteConfirmId(null)
      onSchoolsChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete school')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (school: SchoolData) => {
    setEditingId(school.id)
    setForm({
      name: school.name,
      gradeLevel: 'ELEMENTARY',
      color: school.color || '#3b82f6',
      principalName: school.principalName || '',
      principalEmail: school.principalEmail || '',
      principalPhone: school.principalPhone || '',
      principalPhoneExt: school.principalPhoneExt || '',
    })
    setPrincipalSearch(school.principalName || '')
    setSelectedPrincipalId(null)
    setCreatedPrincipalInFlow(false)
    setShowModal(true)
  }

  const handleOpenNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSelectedPrincipalId(null)
    setCreatedPrincipalInFlow(false)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSelectedPrincipalId(null)
    setCreatedPrincipalInFlow(false)
    setPrincipalSearch('')
  }

  const handleSuccessClose = () => {
    setSuccessData(null)
  }

  const handleSuccessEditPrincipal = () => {
    if (successData) {
      setPrincipalEditor({
        schoolId: successData.schoolId,
        principalId: successData.principalId,
        principalName: successData.principalName,
        principalEmail: successData.principalEmail,
        principalPhone: successData.principalPhone,
        principalPhoneExt: successData.principalPhoneExt,
        principalJobTitle: successData.principalJobTitle || 'Principal',
      })
      setPrincipalEditorOpen(true)
    }
    setSuccessData(null)
  }

  const handlePrincipalEditorClose = () => {
    setPrincipalEditorOpen(false)
    setPrincipalEditor(null)
  }

  const handlePrincipalEditorSaved = (schoolId: string, updatedSchool: SchoolData) => {
    setSchools((prev) => prev.map((school) => (school.id === schoolId ? updatedSchool : school)))
    setPrincipalEditorOpen(false)
    setPrincipalEditor(null)
  }

  if (loading && !hideTable) {
    return <div className="text-sm text-slate-500">Loading schools...</div>
  }

  const deletingSchool = deleteConfirmId ? schools.find((s) => s.id === deleteConfirmId) : null

  return (
    <div className={hideTable ? '' : 'space-y-3'}>
      {error && !hideTable && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!hideTable && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Schools</h3>
              <p className="text-sm text-slate-500 mt-0.5">Schools operating from this campus</p>
            </div>
            <button
              type="button"
              onClick={handleOpenNew}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[36px] text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition"
            >
              <Plus className="w-4 h-4" />
              Add School
            </button>
          </div>

          <div className="ui-glass-table">
        {schools.length === 0 ? (
          <div className="text-center py-14">
            <IllustrationCampus className="w-48 h-40 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700 mb-1">No schools yet</p>
            <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">Add your schools first so buildings can be associated with the right division.</p>
            <button
              onClick={handleOpenNew}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Add First School
            </button>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b bg-slate-50">
                <th className="py-3 px-4 text-left font-medium">Name</th>
                <th className="py-3 px-4 text-left font-medium">Principal</th>
                <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-4 py-3 text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: school.color }} />
                      {school.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {school.principalName || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(school)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {deleteConfirmId === school.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSchool(school.id)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(school.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      )}

      {/* Modal confirm for deletes triggered externally (when table is hidden) */}
      {hideTable && deletingSchool && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Delete {deletingSchool.name}?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This removes the school from this campus. Buildings and outdoor spaces scoped to this school will become shared.
              </p>
            </div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSchool(deletingSchool.id)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School Drawer */}
      <DetailDrawer
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingId ? 'Edit School' : 'Add New School'}
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="school-form"
              disabled={saving}
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add School'}
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="school-form" onSubmit={handleSaveSchool} className="p-8 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">School Details</h3>
            </div>

            <FloatingInput
              id="sm-schoolName"
              label="School Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <FloatingDropdown
              id="sm-gradeLevel"
              label="Grade Level"
              value={form.gradeLevel}
              onChange={(v) => {
                const gl = v as SchoolFormData['gradeLevel']
                setForm((prev) => ({
                  ...prev,
                  gradeLevel: gl,
                  ...(!editingId && GRADE_LEVEL_DEFAULTS[gl] ? { color: GRADE_LEVEL_DEFAULTS[gl] } : {}),
                }))
              }}
              options={[
                { value: 'ELEMENTARY', label: 'Elementary' },
                { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
                { value: 'HIGH_SCHOOL', label: 'High School' },
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, color: c.value }))}
                    className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {form.color === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Principal</h3>
            </div>

            {/* Principal Search/Create */}
            <PrincipalSearch
              principalSearch={principalSearch}
              onPrincipalSearchChange={setPrincipalSearch}
              form={form}
              onFormChange={setForm}
              onSelectPrincipalId={setSelectedPrincipalId}
              onCreatedInFlow={setCreatedPrincipalInFlow}
            />

            <FloatingInput
              id="sm-principalEmail"
              label="Email"
              type="email"
              value={form.principalEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, principalEmail: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <FloatingInput
                id="sm-principalPhone"
                label="Phone"
                type="tel"
                inputMode="tel"
                pattern="\(\d{3}\) \d{3}-\d{4}"
                value={form.principalPhone}
                onChange={(e) => {
                  const formatted = formatPhoneInput(e.target.value)
                  setForm((prev) => ({ ...prev, principalPhone: formatted }))
                }}
              />
              <FloatingInput
                id="sm-principalPhoneExt"
                label="Extension"
                type="text"
                inputMode="numeric"
                pattern="\d{1,6}"
                value={form.principalPhoneExt}
                onChange={(e) => {
                  const extension = normalizeExtensionInput(e.target.value)
                  setForm((prev) => ({ ...prev, principalPhoneExt: extension }))
                }}
              />
            </div>
          </section>
        </form>
      </DetailDrawer>

      {/* Success Modal */}
      {successData && mounted && (
        <SchoolSuccessModal
          data={successData}
          onClose={handleSuccessClose}
          onEditPrincipal={handleSuccessEditPrincipal}
        />
      )}

      {/* Principal Editor Drawer */}
      <PrincipalEditorDrawer
        isOpen={principalEditorOpen}
        data={principalEditor}
        onClose={handlePrincipalEditorClose}
        onSaved={handlePrincipalEditorSaved}
      />
    </div>
  )
})

export default SchoolsManagement
