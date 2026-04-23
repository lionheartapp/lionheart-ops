'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { queryOptions } from '@/lib/queries'

interface Campus {
  id: string
  name: string
  isActive: boolean
}

export interface UseCampusFilterReturn {
  enabledCampuses: Campus[]
  selectedCampusId: string        // '' = all campuses
  setSelectedCampusId: (id: string) => void
  clearSelection: () => void
  isMultiCampus: boolean
  isLoading: boolean
  selectedCampusName: string      // 'All Campuses' or the campus name
}

const STORAGE_KEY = 'facilities-campus-filter'

export function useCampusFilter(): UseCampusFilterReturn {
  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: rawCampuses, isLoading: campusesLoading } = useQuery(queryOptions.campuses())
  const campuses = (rawCampuses as Campus[] | undefined) ?? []

  const isLoading = modulesLoading || campusesLoading

  // Derive enabled campuses for maintenance
  const enabledCampuses = useMemo(() => {
    const enabledCampusIds = modules
      .filter((m) => m.moduleId === 'maintenance' && m.campusId)
      .map((m) => m.campusId as string)
    return campuses.filter((c) => enabledCampusIds.includes(c.id))
  }, [modules, campuses])

  const isMultiCampus = enabledCampuses.length > 1

  // Read role-based default
  const getRoleBasedDefault = useCallback((): string => {
    if (typeof window === 'undefined') return ''
    const role = localStorage.getItem('user-role')
    // Prefer the new `user-campus-scope` key but fall back to the legacy
    // `user-school-scope` so sessions started before the rename keep working.
    const campusScope =
      localStorage.getItem('user-campus-scope') ||
      localStorage.getItem('user-school-scope')
    // Members/viewers with a campus scope default to that campus
    if ((role === 'member' || role === 'viewer') && campusScope) {
      // Validate that this campus scope matches an enabled campus
      const match = enabledCampuses.find((c) => c.name === campusScope || c.id === campusScope)
      if (match) return match.id
    }
    return '' // Default: all campuses
  }, [enabledCampuses])

  // Initialize from localStorage or role-based default
  const [selectedCampusId, setSelectedCampusIdState] = useState<string>('')

  // Load persisted value once data is available
  useEffect(() => {
    if (isLoading || enabledCampuses.length === 0) return

    const persisted = localStorage.getItem(STORAGE_KEY)
    if (persisted) {
      // Validate persisted ID against current enabled campuses
      const isValid = enabledCampuses.some((c) => c.id === persisted)
      if (isValid) {
        setSelectedCampusIdState(persisted)
        return
      }
      // Invalid persisted value — remove it
      localStorage.removeItem(STORAGE_KEY)
    }

    // Fall back to role-based default
    const roleDefault = getRoleBasedDefault()
    setSelectedCampusIdState(roleDefault)
    if (roleDefault) {
      localStorage.setItem(STORAGE_KEY, roleDefault)
    }
  }, [isLoading, enabledCampuses, getRoleBasedDefault])

  const setSelectedCampusId = useCallback((id: string) => {
    setSelectedCampusIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCampusIdState('')
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const selectedCampusName = useMemo(() => {
    if (!selectedCampusId) return 'All Campuses'
    return enabledCampuses.find((c) => c.id === selectedCampusId)?.name ?? 'All Campuses'
  }, [selectedCampusId, enabledCampuses])

  return {
    enabledCampuses,
    selectedCampusId,
    setSelectedCampusId,
    clearSelection,
    isMultiCampus,
    isLoading,
    selectedCampusName,
  }
}
