'use client'

import { useState } from 'react'
import {
  Check,
  Loader2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import SignatureField from './SignatureField'
import type { FormField } from '@/lib/hooks/useRegistrationForm'
import type { FieldData } from './wizard-types'
import { MEDICAL_FIELD_KEYS } from './wizard-types'

interface FieldRendererProps {
  field: FormField
  data: FieldData
  onUpdate: (data: Partial<FieldData>) => void
  shareSlug: string
}

export default function FieldRenderer({ field, data, onUpdate, shareSlug }: FieldRendererProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadPreview, setUploadPreview] = useState<string | null>(data.fileUrl || null)

  const isMedical = field.fieldKey ? MEDICAL_FIELD_KEYS.has(field.fieldKey) : false

  const labelRow = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="block text-sm font-medium text-slate-900">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {isMedical && (
        <span
          className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5"
          title="FERPA-protected information"
        >
          <Lock className="w-2.5 h-2.5" />
          FERPA
        </span>
      )}
    </div>
  )

  if (field.helpText) {
    /* help text shown below label */
  }

  const baseInputClass =
    'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all bg-white'

  switch (field.inputType) {
    case 'TEXT':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="text"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={field.placeholder ?? undefined}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'NUMBER':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="number"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={field.placeholder ?? undefined}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'DATE':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}
          <input
            type="date"
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            required={field.required}
            className={baseInputClass}
          />
        </div>
      )

    case 'DROPDOWN':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}
          <select
            value={data.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            required={field.required}
            className={`${baseInputClass} cursor-pointer`}
          >
            <option value="">Select an option</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )

    case 'CHECKBOX':
      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}
          <div className="space-y-2">
            {(field.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={data.values.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...data.values, opt.value]
                      : data.values.filter((v) => v !== opt.value)
                    onUpdate({ values: next })
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-sm text-slate-700 group-hover:text-slate-900">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )

    case 'FILE': {
      const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadError('')
        setUploading(true)

        try {
          // Step 1: Get a signed upload URL
          const res = await fetch(`/api/events/register/${shareSlug}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
            }),
          })

          const json = await res.json() as {
            ok: boolean
            data?: { signedUrl: string; publicUrl: string }
            error?: { message: string }
          }

          if (!json.ok || !json.data) {
            throw new Error(json.error?.message ?? 'Failed to get upload URL')
          }

          const { signedUrl, publicUrl } = json.data

          // Step 2: Upload directly to Supabase storage
          const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          })

          if (!uploadRes.ok) {
            throw new Error('Upload failed. Please try again.')
          }

          // Step 3: Store the public URL
          onUpdate({ fileUrl: publicUrl })

          // Preview for image files
          if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (ev) => {
              setUploadPreview(ev.target?.result as string)
            }
            reader.readAsDataURL(file)
          } else {
            setUploadPreview(null)
          }
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
          setUploading(false)
        }
      }

      return (
        <div>
          {labelRow}
          {field.helpText && (
            <p className="text-xs text-slate-500 mb-1.5">{field.helpText}</p>
          )}

          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
            {uploadPreview ? (
              <div className="space-y-3">
                <div className="relative w-full h-40 rounded-lg overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadPreview}
                    alt="Upload preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadPreview(null)
                    onUpdate({ fileUrl: '' })
                  }}
                  className="text-xs text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Remove and upload different file
                </button>
              </div>
            ) : data.fileUrl ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Check className="w-4 h-4" />
                File uploaded successfully
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <span className="text-sm text-slate-600 text-center">
                  {uploading ? 'Uploading\u2026' : 'Click to upload a file'}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={uploading}
                  accept="image/*,.pdf,.doc,.docx"
                />
              </label>
            )}
          </div>

          {uploadError && (
            <p className="flex items-center gap-1 text-xs text-red-600 mt-1.5">
              <AlertCircle className="w-3 h-3" />
              {uploadError}
            </p>
          )}
        </div>
      )
    }

    case 'SIGNATURE':
      return (
        <SignatureField
          documentLabel={field.label}
          value={data.signature ?? undefined}
          onChange={(sig) => onUpdate({ signature: sig })}
        />
      )

    default:
      return null
  }
}
