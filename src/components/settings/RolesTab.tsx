'use client'

import { useEffect, useState } from 'react'
import { Shield, Plus, Edit2, Trash2, Check, X } from 'lucide-react'

interface Role {
  id: string
  name: string
  slug: string
  isSystem: boolean
  _count?: {
    permissions: number
    users: number
  }
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const orgId = localStorage.getItem('org-id')
      
      const response = await fetch('/api/settings/roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Organization-ID': orgId || '',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setRoles(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load roles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading roles...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-600 mt-1">Manage user roles and their permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {/* Roles List */}
      <div className="divide-y divide-gray-200 border-y border-gray-200">
        {roles.map((role) => (
          <div
            key={role.id}
            className="py-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                    {role.isSystem && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        System
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">@{role.slug}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{role._count?.permissions || 0} permissions</span>
                    <span>•</span>
                    <span>{role._count?.users || 0} users</span>
                  </div>
                </div>
              </div>
              
              {!role.isSystem && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRole(role)}
                    className="p-2 text-gray-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit role"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {roles.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-md">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No roles found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first role
          </button>
        </div>
      )}
    </div>
  )
}
