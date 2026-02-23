'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import CreateModal from '@/components/CreateModal'
import DetailDrawer from '@/components/DetailDrawer'
import { Plus, Clock, AlertCircle, CheckCircle } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const orgLogoUrl = typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null

  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  const handleLogout = () => {
    localStorage.removeItem('auth-token')
    localStorage.removeItem('org-id')
    localStorage.removeItem('user-name')
    localStorage.removeItem('user-email')
    localStorage.removeItem('user-avatar')
    localStorage.removeItem('user-team')
    localStorage.removeItem('user-school-scope')
    localStorage.removeItem('user-role')
    localStorage.removeItem('org-name')
    localStorage.removeItem('org-school-type')
    localStorage.removeItem('org-logo-url')
    router.push('/login')
  }

  if (!isClient || !token || !orgId) {
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

  const sampleTickets = [
    {
      id: 1,
      title: 'Broken projector in Room 101',
      status: 'urgent',
      dueDate: 'Today',
      priority: 'High',
    },
    {
      id: 2,
      title: 'Replace HVAC filter',
      status: 'in-progress',
      dueDate: '3 days',
      priority: 'Medium',
    },
    {
      id: 3,
      title: 'Fix door lock in main office',
      status: 'pending',
      dueDate: 'Tomorrow',
      priority: 'High',
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'urgent':
        return <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500" aria-hidden="true" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" aria-hidden="true" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-700'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'Low':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || 'user@school.edu'}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      {/* Greeting Section with Create Request Button */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-gray-600 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {getGreeting()}, {userName?.split(' ')[0] || 'there'}
          </h1>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 sm:px-6 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition flex items-center gap-2 self-start sm:self-center"
          aria-label="Create new request"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          Create Request
        </button>
      </div>

      {/* Dashboard Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks Panel */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">My Tasks</h2>
            <button className="ui-icon-muted p-2 min-h-[44px] min-w-[44px] rounded-lg">
              ⋯
            </button>
          </div>

          <ul className="space-y-3" role="list">
            {sampleTickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                onClick={() => setIsDetailOpen(true)}
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(ticket.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{ticket.dueDate}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </div>
              </li>
            ))}
          </ul>

          <button className="mt-6 w-full py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            + Add task
          </button>
        </div>

        {/* Side Panel - Projects/Stats */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <p className="text-sm text-gray-600 mb-2">Active Requests</p>
            <p className="text-4xl font-bold text-blue-600">8</p>
            <p className="text-xs text-gray-600 mt-2">+2 this month</p>
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition">
            <h3 className="font-bold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-2" role="list">
              <li>
                <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                  Pending Approvals
                </button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                  Overdue Tasks
                </button>
              </li>
              <li>
                <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                  My Reports
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Request"
      >
        <div className="space-y-6">
          <p className="text-gray-600">
            This is a reusable modal container. Add your form fields here.
          </p>
          <div>
            <label htmlFor="request-type" className="block text-sm font-medium text-gray-700 mb-2">
              Request Type
            </label>
            <select
              id="request-type"
              className="ui-input"
            >
              <option>IT Request</option>
              <option>Maintenance Request</option>
              <option>Facility Request</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="flex-1 px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              Cancel
            </button>
            <button className="flex-1 px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
              Create
            </button>
          </div>
        </div>
      </CreateModal>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Task Details"
        width="md"
      >
        <div className="space-y-6">
          <p className="text-gray-600">
            This is a reusable drawer container. Add task details, comments, and actions here.
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
              <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Urgent
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Priority</p>
              <p className="text-gray-600">High</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Due Date</p>
              <p className="text-gray-600">Today</p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="flex-1 px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              Close
            </button>
            <button className="flex-1 px-4 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
              Edit
            </button>
          </div>
        </div>
      </DetailDrawer>
    </DashboardLayout>
  )
}
