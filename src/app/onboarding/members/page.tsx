'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, UserPlus, ArrowRight, AlertCircle, CheckCircle2, Loader2, X, Users, ChevronRight, ArrowLeft, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Papa from 'papaparse'

interface Member {
  name: string
  email: string
}

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(index: number) {
  return avatarColors[index % avatarColors.length]
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const memberItemVariants = {
  initial: { opacity: 0, x: -12, height: 0 },
  animate: { opacity: 1, x: 0, height: 'auto', transition: { duration: 0.25 } },
  exit: { opacity: 0, x: 12, height: 0, transition: { duration: 0.2 } },
}

const particleVariants = (angle: number, distance: number) => ({
  initial: { opacity: 0, scale: 0, x: 0, y: 0 },
  animate: {
    opacity: [0, 1, 1, 0],
    scale: [0, 1, 1, 0.5],
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    transition: { duration: 1.2, delay: 0.2, ease: 'easeOut' as const },
  },
})

const particleDots = Array.from({ length: 8 }, (_, i) => ({
  angle: (i * Math.PI * 2) / 8,
  distance: 52 + (i % 2) * 12,
  color: ['bg-green-400', 'bg-emerald-400', 'bg-teal-400', 'bg-primary-400', 'bg-green-300', 'bg-emerald-300', 'bg-teal-300', 'bg-primary-300'][i],
  size: i % 2 === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5',
}))

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

          const valid = parsedMembers.filter((m) => m.name && m.email)
          if (valid.length === 0) {
            setCsvError('No valid members found. CSV must have "name" and "email" columns.')
            return
          }

          setMembers(valid)
        } catch {
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

      sessionStorage.setItem('onboarding-member-count', String(members.length))
      setImportSuccess(true)

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
      <motion.div
        className="space-y-6 text-center py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="flex justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <div className="relative">
            {/* Particle dots */}
            {particleDots.map((dot, i) => (
              <motion.div
                key={i}
                className={`absolute top-1/2 left-1/2 rounded-full ${dot.color} ${dot.size}`}
                variants={particleVariants(dot.angle, dot.distance)}
                initial="initial"
                animate="animate"
                style={{ marginLeft: '-4px', marginTop: '-4px' }}
              />
            ))}
            {/* Green gradient circle */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <p className="text-5xl font-bold text-gray-900">{members.length}</p>
          <p className="text-lg text-gray-600">
            member{members.length !== 1 ? 's' : ''} invited
          </p>
          <p className="text-sm text-gray-400 mt-3">
            They&apos;ll receive an email invitation to join your workspace
          </p>
        </motion.div>
        <div className="pt-2">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin mx-auto" />
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center"
      >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-50 to-indigo-50 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Add your team</h2>
        <p className="text-gray-500 mt-2">
          Bring your team along for the ride
        </p>
      </motion.div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Option Cards */}
      <AnimatePresence mode="wait">
        {!selectedOption ? (
          <motion.div
            key="options"
            className="space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CSV Upload Card */}
              <motion.button
                custom={0}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedOption('csv')
                  setCsvError('')
                }}
                className="group relative p-7 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary-200 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-primary-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Upload CSV</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Import a list of staff from a spreadsheet
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-all duration-200 group-hover:translate-x-0.5 mt-1 flex-shrink-0" />
                </div>
              </motion.button>

              {/* Manual Add Card */}
              <motion.button
                custom={1}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedOption('manual')}
                className="group relative p-7 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary-200 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Add Manually</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Add team members one at a time
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-all duration-200 group-hover:translate-x-0.5 mt-1 flex-shrink-0" />
                </div>
              </motion.button>
            </div>

            {/* Skip Link */}
            <motion.div
              custom={2}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="text-center pt-1"
            >
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1"
              >
                I&apos;ll do this later
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* CSV Upload View */}
      <AnimatePresence>
        {selectedOption === 'csv' && (
          <motion.div
            key="csv"
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setSelectedOption(null)}
              className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to options
            </button>

            <div>
              <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-900 mb-2">
                Upload CSV File
              </label>
              <div
                className="border-2 border-dashed border-primary-300 bg-primary-50/50 rounded-xl p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-blue-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Drag &amp; drop your CSV here</p>
                    <p className="text-sm text-gray-500 mt-0.5">or click to browse</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white text-gray-500 border border-gray-200 tracking-wide">
                    CSV
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                CSV must have &quot;name&quot; and &quot;email&quot; columns
              </p>
            </div>

            {csvError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{csvError}</p>
              </div>
            )}

            {members.length > 0 && (
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Preview</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 border border-primary-100">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {members.slice(0, 5).map((member, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg"
                    >
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(idx)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-semibold text-white">{getInitials(member.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {members.length > 5 && (
                  <p className="text-xs text-gray-400 pl-1">
                    + {members.length - 5} more member{members.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </motion.div>
            )}

            {members.length > 0 && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setMembers([])
                    fileInputRef.current?.click()
                  }}
                  className="px-4 py-2.5 text-gray-700 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Change file
                </button>
                <button
                  onClick={handleImportMembers}
                  disabled={importing}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import {members.length} member{members.length !== 1 ? 's' : ''}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Add View */}
      <AnimatePresence>
        {selectedOption === 'manual' && (
          <motion.div
            key="manual"
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setSelectedOption(null)}
              className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to options
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor="manual-name" className="block text-xs font-medium text-gray-500 mb-1.5">
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 ui-input focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="manual-email" className="block text-xs font-medium text-gray-500 mb-1.5">
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 ui-input focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addManualMember}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm hover:shadow-md flex-shrink-0"
                    aria-label="Add member"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {members.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No members added yet</p>
              </div>
            )}

            {members.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Members</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 border border-primary-100">
                    {members.length}
                  </span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {members.map((member, idx) => (
                      <motion.div
                        key={`${member.email}-${idx}`}
                        variants={memberItemVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layout
                        className="group flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(idx)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-xs font-semibold text-white">{getInitials(member.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                          <p className="text-xs text-gray-500 truncate">{member.email}</p>
                        </div>
                        <button
                          onClick={() => removeMember(idx)}
                          className="p-1.5 rounded-full text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                          aria-label="Remove member"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {members.length > 0 && (
              <button
                onClick={handleImportMembers}
                disabled={importing}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Invite {members.length} member{members.length !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
