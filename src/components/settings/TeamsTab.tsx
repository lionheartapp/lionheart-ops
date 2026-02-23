'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Edit2, Trash2 } from 'lucide-react'

interface Team {
  id: string
  name: string
  slug: string
  description?: string
  _count?: {
    members: number
  }
}

export default function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const orgId = localStorage.getItem('org-id')
      
      const response = await fetch('/api/settings/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Organization-ID': orgId || '',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setTeams(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Teams</h2>
          <p className="text-sm text-gray-600 mt-1">Organize users into teams for better collaboration</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="py-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg" />
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-md">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No teams found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first team
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {teams.map((team) => (
            <div
              key={team.id}
              className="py-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 text-gray-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit team"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{team.name}</h3>
              <p className="text-sm text-gray-600 mb-3">@{team.slug}</p>
              {team.description && (
                <p className="text-sm text-gray-500 mb-3">{team.description}</p>
              )}
              <div className="text-sm text-gray-500">
                {team._count?.members || 0} members
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
