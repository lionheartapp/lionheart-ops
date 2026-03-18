'use client'

import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import { useToast } from '@/components/Toast'
import { Loader2, Truck, Package } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface School {
  id: string
  name: string
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ITDeploymentCreateDrawer({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [batchType, setBatchType] = useState<'DEPLOYMENT' | 'COLLECTION'>('DEPLOYMENT')
  const [schoolId, setSchoolId] = useState('')
  const [grade, setGrade] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Fetch schools
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-deployment-create'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: name.trim(),
        batchType,
      }
      if (schoolId) body.schoolId = schoolId
      if (grade.trim()) body.grade = grade.trim()
      if (schoolYear.trim()) body.schoolYear = schoolYear.trim()
      if (notes.trim()) body.notes = notes.trim()

      const res = await fetch('/api/it/deployment/batches', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to create batch')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeploymentBatches.all })
      toast('Batch created successfully', 'success')
      resetForm()
      onClose()
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const resetForm = () => {
    setName('')
    setBatchType('DEPLOYMENT')
    setSchoolId('')
    setGrade('')
    setSchoolYear('')
    setNotes('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const canSubmit = name.trim().length > 0

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Batch"
      width="md"
      footer={
        <div className="flex gap-3">
          <button
            type="submit"
            form="it-deployment-create-form"
            disabled={!canSubmit || createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Batch
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all"
          >
            Cancel
          </button>
        </div>
      }
    >
      <form
        id="it-deployment-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) createMutation.mutate()
        }}
        className="px-6 py-4 space-y-5"
      >
        {/* Batch Name */}
        <FloatingInput
          label="Batch Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Fall 2025 Chromebook Deployment"
        />

        {/* Batch Type Toggle */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Batch Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBatchType('DEPLOYMENT')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                batchType === 'DEPLOYMENT'
                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                batchType === 'DEPLOYMENT' ? 'bg-indigo-100' : 'bg-slate-100'
              }`}>
                <Truck className={`w-5 h-5 ${batchType === 'DEPLOYMENT' ? 'text-indigo-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-medium ${batchType === 'DEPLOYMENT' ? 'text-indigo-700' : 'text-slate-700'}`}>
                  Deployment
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Hand out devices
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBatchType('COLLECTION')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                batchType === 'COLLECTION'
                  ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                batchType === 'COLLECTION' ? 'bg-amber-100' : 'bg-slate-100'
              }`}>
                <Package className={`w-5 h-5 ${batchType === 'COLLECTION' ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-medium ${batchType === 'COLLECTION' ? 'text-amber-700' : 'text-slate-700'}`}>
                  Collection
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Collect devices back
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* School picker */}
        {schools.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">All campuses</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grade & School Year */}
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
            label="Grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. 9, K, All"
          />
          <FloatingInput
            label="School Year"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="e.g. 2025-2026"
          />
        </div>

        {/* Notes */}
        <FloatingTextarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

      </form>
    </DetailDrawer>
  )
}
