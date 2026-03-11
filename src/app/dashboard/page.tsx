'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import DetailDrawer from '@/components/DetailDrawer'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import ChatPanel from '@/components/ai/ChatPanel'
import { staggerContainer, cardEntrance, listItem, fadeInUp, dropdownVariants, buttonTap, EASE_OUT_CUBIC } from '@/lib/animations'
import { FloatingInput, FloatingTextarea, FloatingSelect } from '@/components/ui/FloatingInput'
import { Plus, Clock, AlertCircle, CheckCircle, ChevronDown, Calendar, Sparkles, Building2, Headphones, Loader2 } from 'lucide-react'
import { IllustrationTickets } from '@/components/illustrations'
import { useAuth } from '@/lib/hooks/useAuth'
import { getAuthHeaders } from '@/lib/api-client'

interface TicketData {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  category: string
  locationText: string | null
  createdAt: string
  assignedTo?: { firstName: string | null; lastName: string | null; email: string } | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, org, isReady, logout } = useAuth()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)

  // Create ticket form state
  const [createCategory, setCreateCategory] = useState<'MAINTENANCE' | 'IT' | null>(null)
  const [createForm, setCreateForm] = useState({ title: '', description: '', locationText: '', priority: 'NORMAL' })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit ticket state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'NORMAL' as string })
  const [editSaving, setEditSaving] = useState(false)

  // Ticket data from API
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketCount, setTicketCount] = useState(0)

  // Fetch tickets from API
  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true)
    try {
      const res = await fetch('/api/tickets?limit=10', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          const allTickets = Array.isArray(data.data) ? data.data : data.data?.tickets || []
          setTickets(allTickets)
          setTicketCount(allTickets.filter((t: TicketData) => t.status !== 'RESOLVED').length)
        }
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isReady && org.id) fetchTickets()
  }, [isReady, org.id, fetchTickets])

  const openCreateDrawer = useCallback((category: 'MAINTENANCE' | 'IT') => {
    setCreateCategory(category)
    setCreateForm({ title: '', description: '', locationText: '', priority: 'NORMAL' })
    setCreateError('')
    setIsCreateDropdownOpen(false)
  }, [])

  const handleCreateSubmit = useCallback(async () => {
    if (!createForm.title.trim() || !createForm.locationText.trim()) {
      setCreateError('Title and location are required.')
      return
    }
    setCreateSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          locationText: createForm.locationText.trim(),
          category: createCategory,
          priority: createForm.priority,
          source: 'MANUAL',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          setCreateCategory(null)
          fetchTickets()
          return
        }
      }
      setCreateError('Failed to create request. Please try again.')
    } catch {
      setCreateError('Failed to create request. Please try again.')
    } finally {
      setCreateSaving(false)
    }
  }, [createForm, createCategory, fetchTickets])

  const handleSaveEdit = async () => {
    if (!selectedTicket) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.ok) {
        // Update the local ticket data
        setSelectedTicket({ ...selectedTicket, ...editForm })
        setIsEditMode(false)
        // Refresh the tickets list using the existing fetchTickets() pattern
        fetchTickets()
      }
    } catch (err) {
      console.error('Failed to update ticket:', err)
    } finally {
      setEditSaving(false)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[aria-expanded]') && !target.closest('.relative')) {
        setIsCreateDropdownOpen(false)
      }
    }

    if (isCreateDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isCreateDropdownOpen])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-primary-500" aria-hidden="true" />
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" aria-hidden="true" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return 'Open'
      case 'IN_PROGRESS': return 'In Progress'
      case 'RESOLVED': return 'Resolved'
      default: return status
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700'
      case 'HIGH':
        return 'bg-red-100 text-red-700'
      case 'NORMAL':
        return 'bg-yellow-100 text-yellow-700'
      case 'LOW':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <DashboardLayout
      userName={user.name || 'User'}
      userEmail={user.email || 'user@school.edu'}
      userAvatar={user.avatar || undefined}
      organizationName={org.name || 'School'}
      organizationLogoUrl={org.logoUrl || undefined}
      schoolLabel={user.schoolScope || org.schoolType || org.name || 'School'}
      teamLabel={user.team || user.role || 'Team'}
      onLogout={logout}
    >
      <MotionConfig reducedMotion="user">
      {/* Greeting Section with Create Dropdown Button */}
      <motion.div
        className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.div variants={fadeInUp}>
          <p className="text-gray-600 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {getGreeting()}, {user.name?.split(' ')[0] || 'there'}
          </h1>
        </motion.div>
        <motion.div variants={fadeInUp} className="relative self-start sm:self-center">
          <motion.button
            onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
            className="px-4 sm:px-6 py-3 min-h-[44px] bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 transition flex items-center gap-2"
            aria-label="Create new request"
            aria-expanded={isCreateDropdownOpen}
            whileTap={buttonTap}
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            Create
            <ChevronDown className={`w-4 h-4 transition-transform ${isCreateDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </motion.button>

          {/* Create Dropdown Menu */}
          <AnimatePresence>
          {isCreateDropdownOpen && (
            <motion.div
              className="absolute right-0 mt-2 w-64 ui-glass-dropdown z-mobilenav"
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Events Section */}
              <div className="p-3 space-y-2">
                <button
                  onClick={() => {
                    setIsCreateDropdownOpen(false)
                    router.push('/calendar?create=true')
                  }}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Calendar className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Event</p>
                    <p className="text-xs text-gray-600">Create a new event</p>
                  </div>
                </button>
                <div
                  className="w-full flex items-start gap-3 p-3 rounded-lg text-left opacity-50 cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-500">Smart Event <span className="ml-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Soon</span></p>
                    <p className="text-xs text-gray-400">Create with AI</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="px-3">
                <div className="h-px bg-gray-200" />
              </div>

              {/* Support Section */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Support</p>
                <button
                  onClick={() => openCreateDrawer('MAINTENANCE')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Building2 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Facilities Request</p>
                    <p className="text-xs text-gray-600">Submit a facilities request</p>
                  </div>
                </button>
                <button
                  onClick={() => openCreateDrawer('IT')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Headphones className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">IT Request</p>
                    <p className="text-xs text-gray-600">Submit an IT support request</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Dashboard Panels Grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.1, 0.15)}
      >
        {/* My Tasks Panel */}
        <motion.div variants={cardEntrance} className="lg:col-span-2 ui-glass-hover p-6 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">My Tasks</h2>
          </div>

          {ticketsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16">
              <IllustrationTickets className="w-48 h-40 mx-auto mb-2" />
              <p className="text-base font-semibold text-gray-700 mb-1">No tasks yet</p>
              <p className="text-sm text-gray-500 mb-4">Submit a maintenance request or create a task to get started.</p>
              <button
                onClick={() => openCreateDrawer('MAINTENANCE')}
                className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors active:scale-[0.97] cursor-pointer"
              >
                Create First Task
              </button>
            </div>
          ) : (
            <>
              <motion.ul className="space-y-3" role="list" initial="hidden" animate="visible" variants={staggerContainer(0.04, 0)}>
                {tickets.filter(t => t.status !== 'RESOLVED').slice(0, 8).map((ticket) => (
                  <motion.li
                    key={ticket.id}
                    variants={listItem}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-primary-50 cursor-pointer transition"
                    onClick={() => { setSelectedTicket(ticket); setIsDetailOpen(true) }}
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(ticket.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(ticket.createdAt)}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority === 'NORMAL' ? 'Normal' : ticket.priority === 'CRITICAL' ? 'Critical' : ticket.priority}
                    </div>
                  </motion.li>
                ))}
              </motion.ul>

              <button
                onClick={() => openCreateDrawer('MAINTENANCE')}
                className="mt-6 w-full py-2 text-primary-600 font-medium hover:bg-primary-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add task
              </button>
            </>
          )}
        </motion.div>

        {/* Right Rail — Embedded Leo AI Assistant */}
        <motion.div
          variants={cardEntrance}
          className="flex flex-col gap-4 lg:min-h-[500px]"
        >
          {/* Compact stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm rounded-xl p-3 border border-primary-200/30 shadow-sm text-center">
              <p className="text-2xl font-bold text-primary-600">
                <AnimatedCounter value={ticketCount} duration={0.8} />
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">Active Requests</p>
            </div>
            <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-3 border border-blue-200/30 shadow-sm text-center">
              <p className="text-2xl font-bold text-blue-600">
                <AnimatedCounter value={tickets.length} duration={0.8} />
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">Total Tasks</p>
            </div>
          </div>

          {/* Embedded Leo */}
          <div className="flex-1 min-h-0">
            <ChatPanel variant="embedded" />
          </div>
        </motion.div>
      </motion.div>
      </MotionConfig>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedTicket(null); setIsEditMode(false) }}
        title={selectedTicket?.title || 'Task Details'}
        width="md"
        onEdit={() => {
          if (selectedTicket) {
            setEditForm({
              title: selectedTicket.title || '',
              description: selectedTicket.description || '',
              priority: selectedTicket.priority || 'NORMAL',
            })
            setIsEditMode(true)
          }
        }}
        footer={selectedTicket && isEditMode ? (
          <div className="flex gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition active:scale-[0.97]"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition active:scale-[0.97]"
            >
              Cancel
            </button>
          </div>
        ) : undefined}
      >
        {selectedTicket ? (
          isEditMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedTicket.description && (
                <p className="text-gray-600 text-sm">{selectedTicket.description}</p>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTicket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                    selectedTicket.status === 'IN_PROGRESS' ? 'bg-primary-100 text-primary-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {getStatusLabel(selectedTicket.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Priority</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Category</p>
                  <p className="text-gray-600">{selectedTicket.category}</p>
                </div>
                {selectedTicket.locationText && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Location</p>
                    <p className="text-gray-600">{selectedTicket.locationText}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Created</p>
                  <p className="text-gray-600">{new Date(selectedTicket.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
          )
        ) : (
          <p className="text-gray-400 text-sm">Select a task to view details.</p>
        )}
      </DetailDrawer>

      {/* Create Ticket Drawer */}
      <DetailDrawer
        isOpen={createCategory !== null}
        onClose={() => setCreateCategory(null)}
        title={createCategory === 'IT' ? 'New IT Request' : 'New Facilities Request'}
        width="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateCategory(null)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmit}
              disabled={createSaving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
            >
              {createSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <FloatingInput
            id="create-title"
            label="Title"
            required
            value={createForm.title}
            onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
          />
          <FloatingTextarea
            id="create-description"
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <FloatingInput
            id="create-location"
            label="Location"
            required
            placeholder="e.g. Room 204, Main Building"
            value={createForm.locationText}
            onChange={(e) => setCreateForm(f => ({ ...f, locationText: e.target.value }))}
          />
          <FloatingSelect
            id="create-priority"
            label="Priority"
            value={createForm.priority}
            onChange={(e) => setCreateForm(f => ({ ...f, priority: e.target.value }))}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </FloatingSelect>

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
        </div>
      </DetailDrawer>
    </DashboardLayout>
  )
}
