'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import type { School } from '@prisma/client'

type SchoolData = Pick<School, 'id' | 'name' | 'gradeLevel' | 'principalName' | 'principalEmail' | 'principalPhone' | 'principalPhoneExt' | 'createdAt' | 'updatedAt'>

type SchoolFormData = {
  name: string
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
}

const EMPTY_FORM: SchoolFormData = {
  name: '',
  gradeLevel: 'ELEMENTARY',
  principalName: '',
  principalEmail: '',
  principalPhone: '',
  principalPhoneExt: '',
}

export default function SchoolsManagement() {
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SchoolFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
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
      } else {
        setSchools((prev) => [...prev, data.data])
      }

      setShowModal(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
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
      principalPhoneExt: '',
    })
    setShowModal(true)
  }

  const handleOpenNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
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

      {/* School Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit School' : 'Add New School'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchool} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School Name
                </label>
                <input
                  className="ui-input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade Level
                </label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Principal Name
                </label>
                <input
                  className="ui-input"
                  value={form.principalName}
                  onChange={(e) => setForm((prev) => ({ ...prev, principalName: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Principal Email
                </label>
                <input
                  className="ui-input"
                  type="email"
                  value={form.principalEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, principalEmail: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Principal Phone
                  </label>
                  <input
                    className="ui-input"
                    value={form.principalPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, principalPhone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extension
                  </label>
                  <input
                    className="ui-input"
                    value={form.principalPhoneExt}
                    onChange={(e) => setForm((prev) => ({ ...prev, principalPhoneExt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="flex-1 px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
