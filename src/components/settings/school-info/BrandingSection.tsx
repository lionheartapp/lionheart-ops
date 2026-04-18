'use client'

import { useRef } from 'react'
import { Pencil, CheckCircle, XCircle, Palette } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { FloatingInput } from '@/components/ui/FloatingInput'
import ImageDropZone from '@/components/settings/ImageDropZone'
import type { FormState } from './school-info-types'

type BrandingSectionProps = {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  // Slug editing state
  slugEditing: boolean
  slugInput: string
  slugValidating: boolean
  slugValid: null | true | string
  slugSaving: boolean
  slugSuccess: string
  slugError: string
  // Slug editing handlers
  openSlugEdit: () => void
  cancelSlugEdit: () => void
  handleSlugInputChange: (value: string) => void
  handleSlugSave: () => Promise<void>
}

export default function BrandingSection({
  form,
  setForm,
  saving,
  slugEditing,
  slugInput,
  slugValidating,
  slugValid,
  slugSaving,
  slugSuccess,
  slugError,
  openSlugEdit,
  cancelSlugEdit,
  handleSlugInputChange,
  handleSlugSave,
}: BrandingSectionProps) {
  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
          <Palette className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Branding</h3>
          <p className="text-sm text-slate-500 mt-0.5">Logo, login image, and subdomain</p>
        </div>
      </div>

      {/* Subdomain slug management */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <p className="text-sm font-medium text-slate-700">Subdomain</p>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono text-slate-800">{form.slug || 'your-school'}</span>
              .lionheartapp.com
            </p>
          </div>
          {!slugEditing && (
            <button
              type="button"
              onClick={openSlugEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              Change Slug
            </button>
          )}
        </div>

        <AnimatePresence>
          {slugSuccess && !slugEditing && (
            <motion.div
              key="slug-success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {slugSuccess}
              </div>
            </motion.div>
          )}

          {slugEditing && (
            <motion.div
              key="slug-edit"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
                <div className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-800">
                  Changing your subdomain will update all links to your organization. Existing bookmarks will stop working.
                </div>

                {slugError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {slugError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Type the new slug to confirm
                  </label>
                  <div className="relative">
                    <FloatingInput
                      id="si-slug-new"
                      label="New subdomain slug"
                      value={slugInput}
                      onChange={(e) => handleSlugInputChange(e.target.value)}
                      disabled={slugSaving}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      {slugValidating && (
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                      )}
                      {!slugValidating && slugValid === true && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {!slugValidating && typeof slugValid === 'string' && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {typeof slugValid === 'string' && (
                    <p className="text-xs text-red-600">{slugValid}</p>
                  )}
                  {slugValid === true && slugInput !== form.slug && (
                    <p className="text-xs text-green-600">
                      {slugInput}.lionheartapp.com is available
                    </p>
                  )}
                  {slugValid === true && slugInput === form.slug && (
                    <p className="text-xs text-slate-500">
                      That is already your current slug
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSlugSave}
                    disabled={slugValid !== true || slugSaving || slugInput === form.slug}
                    className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {slugSaving ? 'Saving...' : 'Confirm Change'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelSlugEdit}
                    disabled={slugSaving}
                    className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider between slug section and image uploads */}
      <div className="h-px bg-slate-200 my-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
        <ImageDropZone
          label="Logo"
          imageUrl={form.logoUrl}
          imageType="logo"
          onImageChange={(url) => setForm((prev) => ({ ...prev, logoUrl: url || '' }))}
          aspectRatio="aspect-[3/2]"
          disabled={saving}
          compact
        />
        <ImageDropZone
          label="Login Image"
          imageUrl={form.heroImageUrl}
          imageType="hero"
          onImageChange={(url) => setForm((prev) => ({ ...prev, heroImageUrl: url || '' }))}
          aspectRatio="aspect-[3/2]"
          disabled={saving}
          compact
        />

        {/* Visual Layout Position Picker */}
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 font-medium mb-2">Login Page Layout</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, imagePosition: 'LEFT' }))}
              className={`flex-1 rounded-xl border p-3 cursor-pointer transition-all ${
                form.imagePosition === 'LEFT'
                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <svg viewBox="0 0 160 100" className="w-full h-auto mb-2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="158" height="98" rx="6" stroke="#E5E7EB" strokeWidth="1" fill="white" />
                <rect x="4" y="4" width="74" height="92" rx="4" fill="#E0E7FF" />
                <circle cx="120" cy="30" r="8" fill="#E5E7EB" />
                <rect x="100" y="44" width="40" height="4" rx="2" fill="#D1D5DB" />
                <rect x="105" y="52" width="30" height="4" rx="2" fill="#E5E7EB" />
                <rect x="100" y="64" width="40" height="8" rx="3" fill="#C7D2FE" />
                <rect x="100" y="76" width="40" height="8" rx="3" fill="#E5E7EB" />
              </svg>
              <span className={`text-xs font-medium ${form.imagePosition === 'LEFT' ? 'text-blue-700' : 'text-slate-500'}`}>
                Image Left
              </span>
            </button>

            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, imagePosition: 'RIGHT' }))}
              className={`flex-1 rounded-xl border p-3 cursor-pointer transition-all ${
                form.imagePosition === 'RIGHT'
                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <svg viewBox="0 0 160 100" className="w-full h-auto mb-2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="158" height="98" rx="6" stroke="#E5E7EB" strokeWidth="1" fill="white" />
                <rect x="82" y="4" width="74" height="92" rx="4" fill="#E0E7FF" />
                <circle cx="40" cy="30" r="8" fill="#E5E7EB" />
                <rect x="20" y="44" width="40" height="4" rx="2" fill="#D1D5DB" />
                <rect x="25" y="52" width="30" height="4" rx="2" fill="#E5E7EB" />
                <rect x="20" y="64" width="40" height="8" rx="3" fill="#C7D2FE" />
                <rect x="20" y="76" width="40" height="8" rx="3" fill="#E5E7EB" />
              </svg>
              <span className={`text-xs font-medium ${form.imagePosition === 'RIGHT' ? 'text-blue-700' : 'text-slate-500'}`}>
                Image Right
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
