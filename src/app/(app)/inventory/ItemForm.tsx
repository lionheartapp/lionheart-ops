'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { INVENTORY_CATEGORIES } from '@/lib/constants/inventory'
import type { InventoryItem } from './inventory-types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface ItemFormProps {
  item?: InventoryItem | null
  onSuccess: () => void
  onCancel: () => void
  hideActions?: boolean
  formId?: string
  onPendingChange?: (pending: boolean) => void
}

export default function ItemForm({ item, onSuccess, onCancel, hideActions, formId, onPendingChange }: ItemFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [sku, setSku] = useState(item?.sku ?? '')
  const [qty, setQty] = useState(String(item?.quantityOnHand ?? 0))
  const [threshold, setThreshold] = useState(String(item?.reorderThreshold ?? 0))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEditing = Boolean(item)

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        category: category || undefined,
        sku: sku || undefined,
        quantityOnHand: parseInt(qty, 10) || 0,
        reorderThreshold: parseInt(threshold, 10) || 0,
      }
      if (isEditing) {
        return fetchApi(`/api/inventory/${item!.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return fetchApi('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess()
    },
    onError: (err: Error) => {
      const msg = err.message || 'Something went wrong'
      if (msg.toLowerCase().includes('name')) {
        setFieldErrors({ name: msg })
      } else {
        setFieldErrors({ _form: msg })
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (!name.trim()) {
      setFieldErrors({ name: 'Name is required' })
      return
    }
    mutation.mutate()
  }

  // Expose pending state to parent for external footer buttons
  useEffect(() => {
    onPendingChange?.(mutation.isPending)
  }, [mutation.isPending, onPendingChange])

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {fieldErrors._form && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {fieldErrors._form}
        </div>
      )}

      <div>
        <label htmlFor="item-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hasError={!!fieldErrors.name}
          className="w-full text-sm"
          placeholder="e.g. Whiteboard Markers"
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="item-category" className="block text-sm font-medium text-slate-700 mb-1">
          Category
        </label>
        <Select
          value={category}
          onChange={setCategory}
          options={[{ value: '', label: 'Select category' }, ...INVENTORY_CATEGORIES.map((cat) => ({ value: cat, label: cat }))]}
        />
      </div>

      <div>
        <label htmlFor="item-sku" className="block text-sm font-medium text-slate-700 mb-1">
          SKU <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <Input
          id="item-sku"
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full text-sm"
          placeholder="e.g. WBM-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="item-qty" className="block text-sm font-medium text-slate-700 mb-1">
            Qty on Hand
          </label>
          <Input
            id="item-qty"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full text-sm"
          />
        </div>
        <div>
          <label htmlFor="item-threshold" className="block text-sm font-medium text-slate-700 mb-1">
            Reorder Point
          </label>
          <Input
            id="item-threshold"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full text-sm"
          />
        </div>
      </div>

      {!hideActions && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={mutation.isPending}
            className="flex-1 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {mutation.isPending ? 'Saving\u2026' : isEditing ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      )}
    </form>
  )
}
