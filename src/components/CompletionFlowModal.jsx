import { useState, useRef } from 'react'
import { CheckCircle2, Upload, FileText, Loader2 } from 'lucide-react'
import DrawerModal from './DrawerModal'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'

/** Completion flow when marking a ticket as Done. Collects man hours, receipt (OCR or manual), future takeaway. */
export default function CompletionFlowModal({
  isOpen,
  onClose,
  request,
  ticketPrefix = 'FAC',
  onComplete,
}) {
  const [manHours, setManHours] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [vendor, setVendor] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [total, setTotal] = useState('')
  const [futureTakeaway, setFutureTakeaway] = useState('')
  const [mode, setMode] = useState('upload') // 'upload' | 'manual'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileInputRef = useRef(null)

  const resetForm = () => {
    setManHours('')
    setReceiptFile(null)
    setReceiptPreview(null)
    setVendor('')
    setExpenseDate('')
    setTotal('')
    setFutureTakeaway('')
    setMode('upload')
    setLoading(false)
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose?.()
  }

  const handleFileChange = async (e) => {
    const file = e.target?.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => setReceiptPreview(reader.result)
    reader.readAsDataURL(file)

    // Run OCR
    setOcrLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`${PLATFORM_URL}/api/receipts/ocr`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `OCR failed (${res.status})`)
      }
      const data = await res.json()
      setVendor(data.vendor || '')
      setExpenseDate(data.date || '')
      setTotal(String(data.total ?? ''))
    } catch (err) {
      setError(err?.message || 'OCR failed. You can enter values manually below.')
      setMode('manual')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    const hrs = parseFloat(manHours)
    if (isNaN(hrs) || hrs < 0) {
      setError('Please enter valid man hours (0 or more).')
      return
    }
    const vendorVal = vendor?.trim()
    const dateVal = expenseDate?.trim()
    const totalVal = parseFloat(total)
    if (!vendorVal || !dateVal || isNaN(totalVal) || totalVal < 0) {
      setError('Please fill vendor, date, and total (or upload a receipt for OCR).')
      return
    }

    setLoading(true)
    try {
      const ticketId = request?.id ? String(request.id) : null

      // Create expense (platform API)
      const expenseRes = await fetch(`${PLATFORM_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          vendor: vendorVal,
          expenseDate: dateVal,
          total: totalVal,
          manHours: hrs,
          ocrData: receiptFile ? { fromOcr: true } : undefined,
        }),
      })
      if (!expenseRes.ok) {
        const data = await expenseRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save expense')
      }

      // Future takeaway → MaintenanceTip
      if (futureTakeaway?.trim()) {
        await fetch(`${PLATFORM_URL}/api/knowledge-base/tips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: futureTakeaway.trim(),
            sourceTicketId: ticketId,
          }),
        })
      }

      handleClose()
      onComplete?.()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Check platform is running on port 3001.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <DrawerModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Complete: ${request?.title ?? 'Ticket'}`}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Man Hours
          </label>
          <input
            type="number"
            min="0"
            step="0.25"
            value={manHours}
            onChange={(e) => setManHours(e.target.value)}
            placeholder="e.g. 2.5"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Receipt
          </p>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-1.5 align-middle" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5 align-middle" />
              Manual
            </button>
          </div>
          {mode === 'upload' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-500 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {ocrLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {receiptFile ? receiptFile.name : 'Choose receipt image'}
              </button>
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="max-h-32 rounded-lg border border-zinc-200 dark:border-zinc-700"
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Home Depot"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date</label>
              <input
                type="text"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Total</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Future Takeaway <span className="text-zinc-500 dark:text-zinc-400 font-normal">(→ Knowledge Base)</span>
          </label>
          <textarea
            value={futureTakeaway}
            onChange={(e) => setFutureTakeaway(e.target.value)}
            placeholder="e.g. Replace HVAC filter every 3 months to reduce noise"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Mark as Done
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </DrawerModal>
  )
}
