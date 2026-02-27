'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, UserPlus, ArrowRight, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import Papa from 'papaparse'

interface Member {
  name: string
  email: string
}

export default function MembersPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedOption, setSelectedOption] = useState<'csv' | 'manual' | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [csvError, setCsvError] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          setCsvError('')
          const rows = results.data as Record<string, string>[]

          const parsedMembers = rows.map((row) => ({
            name: (row.name || row.Name || row['Full Name'] || row.full_name || '').trim(),
            email: (row.email || row.Email || row.email_address || row['Email Address'] || '').trim(),
          }))

          // Validate
          const valid = parsedMembers.filter((m) => m.name && m.email)
          if (valid.length === 0) {
            setCsvError('No valid members found. CSV must have "name" and "email" columns.')
            return
          }

          setMembers(valid)
        } catch (err) {
          setCsvError('Error parsing CSV file')
        }
      },
      error: () => {
        setCsvError('Failed to parse CSV file')
      },
    })
  }

  const addManualMember = () => {
    if (!manualName.trim() || !manualEmail.trim()) {
      setError('Name and email are required')
      return
    }

    if (!manualEmail.includes('@')) {
      setError('Please enter a valid email')
      return
    }

    setError('')
    setMembers((prev) => [...prev, { name: manualName, email: manualEmail }])
    setManualName('')
    setManualEmail('')
  }

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  const handleImportMembers = async () => {
    try {
      setImporting(true)
      setError('')

      const token = localStorage.getItem('auth-token')
      if (!token) {
        setError('Authentication token not found')
        return
      }

      const response = await fetch('/api/onboarding/import-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ members }),
      })

      if (!response.ok) {
        throw new Error('Failed to import members')
      }

      // Store count for finalize step
      sessionStorage.setItem('onboarding-member-count', String(members.length))
      setImportSuccess(true)

      // Redirect after 1.5 seconds
      setTimeout(() => {
        router.push('/onboarding/setup')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setImporting(false)
    }
  }

  const handleSkip = () => {
    sessionStorage.setItem('onboarding-member-count', '0')
    router.push('/onboarding/setup')
  }

  // Success screen
  if (importSuccess) {
    return (
      <div className="space-y-8 text-center py-8">
        <div className="flex justify-center">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {members.length} member{members.length !== 1 ? 's' : ''} invited!
          </h3>
          <p className="text-gray-600">
            They&apos;ll receive invitations to join your Lionheart workspace.
          </p>
        </div>
        <div className="animate-spin inline-block">
          <Loader2 className="w-6 h-6 text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Add your team</h2>
        <p className="text-gray-600 mt-2">
          Invite staff members to start using Lionheart
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Option Cards */}
      {!selectedOption ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CSV Upload */}
          <button
            onClick={() => {
              setSelectedOption('csv')
              setCsvError('')
            }}
            className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition text-left space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Upload CSV</h3>
              <p className="text-sm text-gray-600 mt-1">
                Import a list of staff from a spreadsheet
              </p>
            </div>
          </button>

          {/* Manual Add */}
          <button
            onClick={() => setSelectedOption('manual')}
            className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition text-left space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Add Manually</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add team members one at a time
              </p>
            </div>
          </button>

          {/* Skip */}
          <button
            onClick={handleSkip}
            className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition text-left space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">I&apos;ll do this later</h3>
              <p className="text-sm text-gray-600 mt-1">
                You can always invite members from Settings
              </p>
            </div>
          </button>
        </div>
      ) : null}

      {/* CSV Upload View */}
      {selectedOption === 'csv' && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedOption(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← Back to options
          </button>

          <div>
            <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-900 mb-2">
              Upload CSV File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition">
              <input
                ref={fileInputRef}
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto flex flex-col items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <Upload className="w-6 h-6" />
                <span className="font-medium">Click to upload CSV</span>
                <span className="text-xs text-gray-500">or drag and drop</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              CSV must have "name" and "email" columns
            </p>
          </div>

          {csvError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{csvError}</p>
            </div>
          )}

          {members.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Preview ({members.length} members)</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.slice(0, 5).map((member, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{member.name}</td>
                        <td className="px-4 py-2 text-gray-600">{member.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {members.length > 5 && (
                <p className="text-xs text-gray-500">
                  ... and {members.length - 5} more
                </p>
              )}
            </div>
          )}

          {members.length > 0 && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setMembers([])
                  fileInputRef.current?.click()
                }}
                className="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Change file
              </button>
              <button
                onClick={handleImportMembers}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {members.length} member{members.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Add View */}
      {selectedOption === 'manual' && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedOption(null)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← Back to options
          </button>

          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div>
              <label htmlFor="manual-name" className="block text-sm font-medium text-gray-900 mb-1">
                Name
              </label>
              <input
                id="manual-name"
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addManualMember()
                  }
                }}
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
              />
            </div>
            <div>
              <label htmlFor="manual-email" className="block text-sm font-medium text-gray-900 mb-1">
                Email
              </label>
              <input
                id="manual-email"
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addManualMember()
                  }
                }}
                placeholder="john@school.edu"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
              />
            </div>
            <button
              onClick={addManualMember}
              className="w-full px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition"
            >
              Add member
            </button>
          </div>

          {members.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Added members ({members.length})</h3>
              <div className="space-y-2">
                {members.map((member, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-600">{member.email}</p>
                    </div>
                    <button
                      onClick={() => removeMember(idx)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                      aria-label="Remove member"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <button
              onClick={handleImportMembers}
              disabled={importing}
              className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Invite {members.length} member{members.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
