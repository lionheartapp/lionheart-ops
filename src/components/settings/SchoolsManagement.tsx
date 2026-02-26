'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Edit2, Trash2, X, ChevronDown } from 'lucide-react'
import type { School } from '@prisma/client'
import DetailDrawer from '@/components/DetailDrawer'

type SchoolData = Pick<School, 'id' | 'name' | 'gradeLevel' | 'principalName' | 'principalEmail' | 'principalPhone' | 'principalPhoneExt' | 'createdAt' | 'updatedAt'>

type SchoolFormData = {
  name: string
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
}

type PrincipalOption = {
  id: string
  name: string
  email: string
  phone: string | null
  jobTitle: string
}

type SuccessModalData = {
  schoolId: string
  schoolName: string
  principalId: string | null
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
  principalJobTitle: string
}

type PrincipalEditorData = {
  schoolId: string
  principalId: string | null
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
  principalJobTitle: string
}

const EMPTY_FORM: SchoolFormData = {
  name: '',
  gradeLevel: 'ELEMENTARY',
  principalName: '',
  principalEmail: '',
  principalPhone: '',
  principalPhoneExt: '',
}

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (!digits) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const normalizeExtensionInput = (value: string) => value.replace(/\D/g, '').slice(0, 6)

const normalizeSearchText = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ')

const splitSearchTokens = (value: string) => normalizeSearchText(value).split(' ').filter(Boolean)

const matchesWordPrefixSequence = (name: string, query: string) => {
  const nameTokens = splitSearchTokens(name)
  const queryTokens = splitSearchTokens(query)
  if (queryTokens.length === 0) return false
  if (queryTokens.length > nameTokens.length) return false

  let nameIndex = 0
  for (const queryToken of queryTokens) {
    let found = false
    while (nameIndex < nameTokens.length) {
      if (nameTokens[nameIndex].startsWith(queryToken)) {
        found = true
        nameIndex += 1
        break
      }
      nameIndex += 1
    }
    if (!found) return false
  }

  return true
}

const isValidPhoneValue = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export default function SchoolsManagement() {
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
  
  // Principal search/create
  const [principalSearch, setPrincipalSearch] = useState('')
  const [principalOptions, setPrincipalOptions] = useState<PrincipalOption[]>([])
  const [showPrincipalDropdown, setShowPrincipalDropdown] = useState(false)
  const [searchingPrincipals, setSearchingPrincipals] = useState(false)
  const [creatingPrincipal, setCreatingPrincipal] = useState(false)
  const [createdPrincipalInFlow, setCreatedPrincipalInFlow] = useState(false)
  
  // Success modal
  const [successData, setSuccessData] = useState<SuccessModalData | null>(null)
  const [principalEditor, setPrincipalEditor] = useState<PrincipalEditorData | null>(null)
  const [principalEditorOpen, setPrincipalEditorOpen] = useState(false)
  const [savingPrincipalEditor, setSavingPrincipalEditor] = useState(false)
  const [principalEditorError, setPrincipalEditorError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    if (orgId) {
      headers['x-org-id'] = orgId
    }
    return headers
  }

  // Search for principals by name
  const searchPrincipals = async (query: string) => {
    if (!query.trim()) {
      setPrincipalOptions([])
      return
    }

    setSearchingPrincipals(true)
    try {
      const response = await fetch(`/api/settings/principals?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        console.error('Search failed:', data)
        setPrincipalOptions([])
      } else {
        setPrincipalOptions(data.data || [])
      }
    } catch (err) {
      console.error('Principal search error:', err)
      setPrincipalOptions([])
    } finally {
      setSearchingPrincipals(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const normalizedSearch = principalSearch.trim()
      if (normalizedSearch) {
        searchPrincipals(normalizedSearch)
      } else {
        setPrincipalOptions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [principalSearch])

  const rankedPrincipalOptions = useMemo(() => {
    const query = normalizeSearchText(principalSearch)
    if (!query) return principalOptions

    const queryTokens = splitSearchTokens(query)

    const scored = principalOptions
      .map((principal) => {
        const name = normalizeSearchText(principal.name)
        const email = normalizeSearchText(principal.email)

        const exactNamePrefix = name.startsWith(query)
        const phraseInName = name.includes(query)
        const wordPrefixSequence = matchesWordPrefixSequence(principal.name, query)
        const allTokensInName = queryTokens.every((token) => name.includes(token))
        const allTokensInEmail = queryTokens.every((token) => email.includes(token))

        let score = 0
        if (exactNamePrefix) score = 500
        else if (wordPrefixSequence) score = 450
        else if (phraseInName) score = 300
        else if (allTokensInName) score = 200
        else if (allTokensInEmail) score = 100

        return { principal, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.principal.name.localeCompare(b.principal.name))

    const strictPrefixMatches = scored.filter((entry) => entry.score >= 450)
    if (queryTokens.length >= 2 && strictPrefixMatches.length > 0) {
      return strictPrefixMatches.map((entry) => entry.principal)
    }

    return scored.map((entry) => entry.principal)
  }, [principalOptions, principalSearch])

  // Create a new principal
  const createNewPrincipal = async () => {
    if (!principalSearch.trim()) return

    setCreatingPrincipal(true)
    try {
      const response = await fetch('/api/settings/principals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: principalSearch.trim(),
          phone: form.principalPhone || null,
          phoneExt: form.principalPhoneExt || null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Failed to create principal')
      }

      // Update form with the newly created principal
      const principal = data.data
      setForm((prev) => ({
        ...prev,
        principalName: principal.name,
        principalEmail: principal.email,
        principalPhone: principal.phone || '',
      }))
      setSelectedPrincipalId(principal.id)
      setCreatedPrincipalInFlow(true)
      setPrincipalSearch(principal.name)
      setShowPrincipalDropdown(false)
      setPrincipalOptions([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create principal'
      console.error('Create principal error:', message, err)
    } finally {
      setCreatingPrincipal(false)
    }
  }

  // Select an existing principal
  const selectPrincipal = (principal: PrincipalOption) => {
    setForm((prev) => ({
      ...prev,
      principalName: principal.name,
      principalEmail: principal.email,
      principalPhone: principal.phone || '',
    }))
    setSelectedPrincipalId(principal.id)
    setCreatedPrincipalInFlow(false)
    setPrincipalSearch(principal.name)
    setShowPrincipalDropdown(false)
    setPrincipalOptions([])
  }

  const loadSchools = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/settings/schools', {
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
  }, [])

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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(form),
      })

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('Failed to parse response JSON:', jsonError)
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
                  gradeLevel: form.gradeLevel,
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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save school'
      console.error('Save error:', message, err)
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
        headers: getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to delete school')
      }

      setSchools((prev) => prev.filter((s) => s.id !== id))
      setDeleteConfirmId(null)
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
      gradeLevel: school.gradeLevel as any,
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
    setShowPrincipalDropdown(false)
  }

  const handleSuccessClose = (goToEditPrincipal: boolean = false) => {
    if (goToEditPrincipal && successData) {
      setPrincipalEditor({
        schoolId: successData.schoolId,
        principalId: successData.principalId,
        principalName: successData.principalName,
        principalEmail: successData.principalEmail,
        principalPhone: successData.principalPhone,
        principalPhoneExt: successData.principalPhoneExt,
        principalJobTitle: successData.principalJobTitle || 'Principal',
      })
      setPrincipalEditorError('')
      setPrincipalEditorOpen(true)
    }
    setSuccessData(null)
  }

  const handlePrincipalEditorClose = () => {
    if (savingPrincipalEditor) return
    setPrincipalEditorOpen(false)
    setPrincipalEditor(null)
    setPrincipalEditorError('')
  }

  const handleSavePrincipalEditor = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!principalEditor) return

    setSavingPrincipalEditor(true)
    setPrincipalEditorError('')

    try {
      if (!principalEditor.principalName.trim()) {
        throw new Error('Principal name is required')
      }

      if (!principalEditor.principalEmail.trim()) {
        throw new Error('Principal email is required')
      }

      if (principalEditor.principalPhone && !isValidPhoneValue(principalEditor.principalPhone)) {
        throw new Error('Principal phone must be a valid phone number')
      }

      if (principalEditor.principalPhoneExt && !/^\d{1,6}$/.test(principalEditor.principalPhoneExt)) {
        throw new Error('Extension must be numeric and up to 6 digits')
      }

      const schoolResponse = await fetch(`/api/settings/schools/${principalEditor.schoolId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          principalName: principalEditor.principalName.trim(),
          principalEmail: principalEditor.principalEmail.trim(),
          principalPhone: principalEditor.principalPhone || null,
          principalPhoneExt: principalEditor.principalPhoneExt || null,
        }),
      })

      const schoolData = await schoolResponse.json()
      if (!schoolResponse.ok || !schoolData.ok) {
        throw new Error(schoolData?.error?.message || 'Failed to update school principal details')
      }

      if (principalEditor.principalId) {
        const principalResponse = await fetch(`/api/settings/principals/${principalEditor.principalId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            name: principalEditor.principalName.trim(),
            email: principalEditor.principalEmail.trim(),
            phone: principalEditor.principalPhone || null,
            jobTitle: principalEditor.principalJobTitle || 'Principal',
          }),
        })

        const principalData = await principalResponse.json()
        if (!principalResponse.ok || !principalData.ok) {
          throw new Error(principalData?.error?.message || 'Failed to update principal details')
        }
      }

      setSchools((prev) => prev.map((school) => (school.id === principalEditor.schoolId ? schoolData.data : school)))
      setPrincipalEditorOpen(false)
      setPrincipalEditor(null)
      setPrincipalEditorError('')
    } catch (err) {
      setPrincipalEditorError(err instanceof Error ? err.message : 'Failed to update principal details')
    } finally {
      setSavingPrincipalEditor(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading schools...</div>
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Schools in Campus</h4>
        <button
          type="button"
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add School
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Grade Level</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Principal</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No schools yet
                </td>
              </tr>
            ) : (
              schools.map((school) => (
                <tr key={school.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{school.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {school.gradeLevel.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {school.principalName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(school)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 transition"
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
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(school.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* School Drawer */}
      <DetailDrawer
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingId ? 'Edit School' : 'Add New School'}
        width="lg"
      >
        <form onSubmit={handleSaveSchool} className="p-8 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">School Details</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name</label>
              <input
                className="ui-input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade Level</label>
              <select
                className="ui-select w-full"
                value={form.gradeLevel}
                onChange={(e) => setForm((prev) => ({ ...prev, gradeLevel: e.target.value as any }))}
              >
                <option value="ELEMENTARY">Elementary</option>
                <option value="MIDDLE_SCHOOL">Middle School</option>
                <option value="HIGH_SCHOOL">High School</option>
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Principal</h3>
            </div>

            {/* Principal Search/Create */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <div className="relative">
                <input
                  type="text"
                  className="ui-input w-full pr-10"
                  placeholder="Search or add a principal..."
                  value={principalSearch}
                  onChange={(e) => {
                    const value = e.target.value
                    setPrincipalSearch(value)
                    setSelectedPrincipalId(null)
                    setCreatedPrincipalInFlow(false)
                    setForm((prev) => ({ ...prev, principalName: value }))
                    setShowPrincipalDropdown(true)
                  }}
                  onFocus={() => setShowPrincipalDropdown(true)}
                  disabled={creatingPrincipal}
                />
                {showPrincipalDropdown && (
                  <button
                    type="button"
                    onClick={() => setShowPrincipalDropdown(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showPrincipalDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                  {searchingPrincipals ? (
                    <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
                  ) : rankedPrincipalOptions.length > 0 ? (
                    <>
                      {rankedPrincipalOptions.map((principal) => (
                        <button
                          key={principal.id}
                          type="button"
                          onClick={() => selectPrincipal(principal)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 transition"
                        >
                          <div className="font-medium text-gray-900">{principal.name}</div>
                          <div className="text-xs text-gray-500">{principal.email}</div>
                        </button>
                      ))}
                      <div className="border-t border-gray-200" />
                    </>
                  ) : null}

                  {principalSearch.trim() && (
                    <button
                      type="button"
                      onClick={createNewPrincipal}
                      disabled={creatingPrincipal}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 transition text-green-600 font-medium"
                    >
                      {creatingPrincipal ? '+ Creating...' : `+ Add new principal: "${principalSearch}"`}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                className="ui-input"
                type="email"
                value={form.principalEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, principalEmail: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  className="ui-input"
                  type="tel"
                  inputMode="tel"
                  pattern="\(\d{3}\) \d{3}-\d{4}"
                  placeholder="(555) 123-4567"
                  value={form.principalPhone}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value)
                    setForm((prev) => ({ ...prev, principalPhone: formatted }))
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Extension</label>
                <input
                  className="ui-input"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{1,6}"
                  placeholder="123"
                  value={form.principalPhoneExt}
                  onChange={(e) => {
                    const extension = normalizeExtensionInput(e.target.value)
                    setForm((prev) => ({ ...prev, principalPhoneExt: extension }))
                  }}
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={saving || searchingPrincipals || creatingPrincipal}
              className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || searchingPrincipals || creatingPrincipal}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add School'}
            </button>
          </div>
        </form>
      </DetailDrawer>

      {/* Success Modal */}
      {successData && mounted
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">New principal created</h3>
                  <p className="text-gray-600">
                    <strong>{successData.schoolName}</strong> has been added and <strong>{successData.principalName}</strong> was created as a new principal.
                  </p>
                </div>

                <p className="text-gray-600 mb-6 text-sm">
                  Would you like to edit this new principal’s information now?
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleSuccessClose(true)}
                    className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuccessClose(false)}
                    className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <DetailDrawer
        isOpen={principalEditorOpen}
        onClose={handlePrincipalEditorClose}
        title="Edit Principal Information"
        width="md"
      >
        {principalEditor && (
          <form onSubmit={handleSavePrincipalEditor} className="space-y-4">
            {principalEditorError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {principalEditorError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Principal Name</label>
              <input
                className="ui-input"
                value={principalEditor.principalName}
                onChange={(e) => setPrincipalEditor((prev) => (prev ? { ...prev, principalName: e.target.value } : prev))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Principal Email</label>
              <input
                className="ui-input"
                type="email"
                value={principalEditor.principalEmail}
                onChange={(e) => setPrincipalEditor((prev) => (prev ? { ...prev, principalEmail: e.target.value } : prev))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Principal Phone</label>
                <input
                  className="ui-input"
                  type="tel"
                  inputMode="tel"
                  pattern="\(\d{3}\) \d{3}-\d{4}"
                  placeholder="(555) 123-4567"
                  value={principalEditor.principalPhone}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value)
                    setPrincipalEditor((prev) => (prev ? { ...prev, principalPhone: formatted } : prev))
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Extension</label>
                <input
                  className="ui-input"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{1,6}"
                  placeholder="123"
                  value={principalEditor.principalPhoneExt}
                  onChange={(e) => {
                    const extension = normalizeExtensionInput(e.target.value)
                    setPrincipalEditor((prev) => (prev ? { ...prev, principalPhoneExt: extension } : prev))
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
              <input
                className="ui-input"
                value={principalEditor.principalJobTitle}
                onChange={(e) => setPrincipalEditor((prev) => (prev ? { ...prev, principalJobTitle: e.target.value } : prev))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={savingPrincipalEditor}
                className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {savingPrincipalEditor ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handlePrincipalEditorClose}
                disabled={savingPrincipalEditor}
                className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </DetailDrawer>
    </div>
  )
}
