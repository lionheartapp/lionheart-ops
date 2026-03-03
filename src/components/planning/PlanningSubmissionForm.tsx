'use client'

import { useState } from 'react'

interface PlanningSubmissionFormProps {
  seasonId: string
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
  isSubmitting?: boolean
}

const RESOURCE_TYPES = [
  { value: 'FACILITY', label: 'Facility Setup' },
  { value: 'AV_EQUIPMENT', label: 'A/V Equipment' },
  { value: 'CUSTODIAL', label: 'Custodial' },
  { value: 'VIP_ATTENDANCE', label: 'VIP Attendance' },
]

export default function PlanningSubmissionForm({ seasonId, onSubmit, onCancel, isSubmitting }: PlanningSubmissionFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [alternateDate1, setAlternateDate1] = useState('')
  const [alternateDate2, setAlternateDate2] = useState('')
  const [duration, setDuration] = useState(60)
  const [isOutdoor, setIsOutdoor] = useState(false)
  const [expectedAttendance, setExpectedAttendance] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [priority, setPriority] = useState('IMPORTANT')
  const [estimatedBudget, setEstimatedBudget] = useState('')
  const [resourceNeeds, setResourceNeeds] = useState<Array<{ resourceType: string; details: string }>>([])

  const addResource = (type: string) => {
    if (!resourceNeeds.find((r) => r.resourceType === type)) {
      setResourceNeeds((prev) => [...prev, { resourceType: type, details: '' }])
    }
  }

  const removeResource = (type: string) => {
    setResourceNeeds((prev) => prev.filter((r) => r.resourceType !== type))
  }

  const updateResourceDetails = (type: string, details: string) => {
    setResourceNeeds((prev) => prev.map((r) => (r.resourceType === type ? { ...r, details } : r)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      description: description || undefined,
      preferredDate,
      alternateDate1: alternateDate1 || undefined,
      alternateDate2: alternateDate2 || undefined,
      duration,
      isOutdoor,
      expectedAttendance: expectedAttendance ? parseInt(expectedAttendance) : undefined,
      targetAudience: targetAudience || undefined,
      priority,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
      resourceNeeds: resourceNeeds.length > 0 ? resourceNeeds : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Spring Concert" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Describe the event..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
          <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Date 1</label>
          <input type="date" value={alternateDate1} onChange={(e) => setAlternateDate1(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Date 2</label>
          <input type="date" value={alternateDate2} onChange={(e) => setAlternateDate2(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
          <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} min={15} max={1440} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expected Attendance</label>
          <input type="number" value={expectedAttendance} onChange={(e) => setExpectedAttendance(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Budget ($)</label>
          <input type="number" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} step="0.01" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="500.00" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Students, Parents" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="MUST_HAVE">Must Have</option>
            <option value="IMPORTANT">Important</option>
            <option value="NICE_TO_HAVE">Nice to Have</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={isOutdoor} onChange={(e) => setIsOutdoor(e.target.checked)} className="rounded" />
            Outdoor event
          </label>
        </div>
      </div>

      {/* Resource Needs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Resource Needs</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {RESOURCE_TYPES.map((rt) => {
            const isSelected = resourceNeeds.some((r) => r.resourceType === rt.value)
            return (
              <button
                key={rt.value}
                type="button"
                onClick={() => isSelected ? removeResource(rt.value) : addResource(rt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                  isSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}{rt.label}
              </button>
            )
          })}
        </div>
        {resourceNeeds.map((r) => (
          <div key={r.resourceType} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-600 w-24">{RESOURCE_TYPES.find((t) => t.value === r.resourceType)?.label}</span>
            <input
              type="text"
              value={r.details}
              onChange={(e) => updateResourceDetails(r.resourceType, e.target.value)}
              placeholder="Details..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isSubmitting || !title || !preferredDate} className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 disabled:opacity-50 transition">
          {isSubmitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition">Cancel</button>
      </div>
    </form>
  )
}
