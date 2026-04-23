'use client'

import { useState } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { getAuthHeaders as getCookieAuthHeaders } from '@/lib/api-client'
import type { PrincipalEditorData } from '@/lib/school-utils'
import { formatPhoneInput, normalizeExtensionInput, isValidPhoneValue } from '@/lib/school-utils'
import type { School } from '@prisma/client'

type SchoolData = Pick<School, 'id' | 'name' | 'color' | 'principalName' | 'principalEmail' | 'principalPhone' | 'principalPhoneExt' | 'createdAt' | 'updatedAt'>

interface PrincipalEditorDrawerProps {
  isOpen: boolean
  data: PrincipalEditorData | null
  onClose: () => void
  onSaved: (schoolId: string, updatedSchool: SchoolData) => void
}

export default function PrincipalEditorDrawer({
  isOpen,
  data,
  onClose,
  onSaved,
}: PrincipalEditorDrawerProps) {
  const [editorData, setEditorData] = useState<PrincipalEditorData | null>(data)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const getAuthHeaders = () => getCookieAuthHeaders()

  // Sync incoming data prop when it changes
  // (parent sets data before opening)
  if (data !== null && editorData !== data) {
    setEditorData(data)
    setError('')
  }

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editorData) return

    setSaving(true)
    setError('')

    try {
      if (!editorData.principalName.trim()) {
        throw new Error('Principal name is required')
      }

      if (!editorData.principalEmail.trim()) {
        throw new Error('Principal email is required')
      }

      if (editorData.principalPhone && !isValidPhoneValue(editorData.principalPhone)) {
        throw new Error('Principal phone must be a valid phone number')
      }

      if (editorData.principalPhoneExt && !/^\d{1,6}$/.test(editorData.principalPhoneExt)) {
        throw new Error('Extension must be numeric and up to 6 digits')
      }

      const schoolResponse = await fetch(`/api/settings/schools/${editorData.schoolId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          principalName: editorData.principalName.trim(),
          principalEmail: editorData.principalEmail.trim(),
          principalPhone: editorData.principalPhone || null,
          principalPhoneExt: editorData.principalPhoneExt || null,
        }),
      })

      const schoolData = await schoolResponse.json()
      if (!schoolResponse.ok || !schoolData.ok) {
        throw new Error(schoolData?.error?.message || 'Failed to update school principal details')
      }

      if (editorData.principalId) {
        const principalResponse = await fetch(`/api/settings/principals/${editorData.principalId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            name: editorData.principalName.trim(),
            email: editorData.principalEmail.trim(),
            phone: editorData.principalPhone || null,
            jobTitle: editorData.principalJobTitle || 'Principal',
          }),
        })

        const principalData = await principalResponse.json()
        if (!principalResponse.ok || !principalData.ok) {
          throw new Error(principalData?.error?.message || 'Failed to update principal details')
        }
      }

      onSaved(editorData.schoolId, schoolData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update principal details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Principal Information"
      width="md"
      footer={
        <div className="space-y-3">
          <button
            type="submit"
            form="principal-editor-form"
            disabled={saving}
            className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
          >
            Cancel
          </button>
        </div>
      }
    >
      {editorData && (
        <form id="principal-editor-form" onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <FloatingInput
            id="sm-editorName"
            label="Principal Name"
            value={editorData.principalName}
            onChange={(e) => setEditorData((prev) => (prev ? { ...prev, principalName: e.target.value } : prev))}
            required
          />

          <FloatingInput
            id="sm-editorEmail"
            label="Principal Email"
            type="email"
            value={editorData.principalEmail}
            onChange={(e) => setEditorData((prev) => (prev ? { ...prev, principalEmail: e.target.value } : prev))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <FloatingInput
              id="sm-editorPhone"
              label="Principal Phone"
              type="tel"
              inputMode="tel"
              pattern="\(\d{3}\) \d{3}-\d{4}"
              value={editorData.principalPhone}
              onChange={(e) => {
                const formatted = formatPhoneInput(e.target.value)
                setEditorData((prev) => (prev ? { ...prev, principalPhone: formatted } : prev))
              }}
            />
            <FloatingInput
              id="sm-editorPhoneExt"
              label="Extension"
              type="text"
              inputMode="numeric"
              pattern="\d{1,6}"
              value={editorData.principalPhoneExt}
              onChange={(e) => {
                const extension = normalizeExtensionInput(e.target.value)
                setEditorData((prev) => (prev ? { ...prev, principalPhoneExt: extension } : prev))
              }}
            />
          </div>

          <FloatingInput
            id="sm-editorJobTitle"
            label="Job Title"
            value={editorData.principalJobTitle}
            onChange={(e) => setEditorData((prev) => (prev ? { ...prev, principalJobTitle: e.target.value } : prev))}
          />
        </form>
      )}
    </DetailDrawer>
  )
}
