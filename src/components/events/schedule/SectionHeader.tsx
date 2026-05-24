'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Clock,
  GripVertical,
  FolderOpen,
  Pencil,
  Trash2,
  Plus,
  LayoutGrid,
  LayoutList,
} from 'lucide-react'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'
import { formatDuration, formatTime12 } from '@/lib/schedule-utils'
import { Input } from '@/components/ui/Input'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SectionHeaderProps {
  section: EventScheduleSection
  blockCount: number
  totalDuration: number
  timeSpan: string  // e.g. "8:00 AM – 10:30 AM"
  onRename: (newTitle: string) => void
  onStartTimeChange: (newTime: string) => void
  onLayoutChange: (layout: 'sequential' | 'parallel') => void
  onDelete: () => void
  onAddBlock: () => void
  onLinkPCO?: () => void
  hasPCOLink?: boolean
  dragListeners?: Record<string, unknown>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SectionHeader({ section, blockCount, totalDuration, timeSpan, onRename, onStartTimeChange, onLayoutChange, onDelete, onAddBlock, onLinkPCO, hasPCOLink, dragListeners }: SectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(section.title)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (isEditingTime && timeInputRef.current) {
      timeInputRef.current.focus()
    }
  }, [isEditingTime])

  function handleSave() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== section.title) {
      onRename(trimmed)
    } else {
      setEditValue(section.title)
    }
    setIsEditing(false)
  }

  function handleTimeSave(value: string) {
    if (value && value !== section.startTime) {
      onStartTimeChange(value)
    }
    setIsEditingTime(false)
  }

  return (
    <div className="flex items-center justify-between mb-2 group/header">
      <div className="flex items-center gap-2.5">
        {/* Drag handle for section reordering */}
        <button
          className="p-1 -ml-1 rounded text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder section"
          {...(dragListeners || {})}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <FolderOpen className="w-4 h-4 text-slate-400" />
        {isEditing ? (
          <Input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setEditValue(section.title); setIsEditing(false) }
            }}
            size="sm"
            className="h-auto min-h-0 border-0 border-b border-indigo-400 bg-transparent px-0 py-0 text-sm font-semibold text-slate-900 shadow-none outline-none focus:ring-0"
          />
        ) : (
          <h4
            className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            {section.title}
          </h4>
        )}
        {/* Time span — clickable to edit start time */}
        {isEditingTime ? (
          <Input
            ref={timeInputRef}
            type="time"
            defaultValue={section.startTime}
            onBlur={(e) => handleTimeSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTimeSave((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setIsEditingTime(false)
            }}
            size="sm"
            className="h-auto min-h-0 w-auto bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 focus:ring-indigo-100"
          />
        ) : (
          <button
            onClick={() => setIsEditingTime(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-all cursor-pointer"
            title="Click to change section start time"
          >
            <Clock className="w-3 h-3" />
            {timeSpan}
          </button>
        )}
        {section.layout === 'parallel' && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold uppercase tracking-wider">
            Breakout
          </span>
        )}
        <span className="text-xs text-slate-400">
          {blockCount} item{blockCount !== 1 ? 's' : ''}
          {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
        {onLinkPCO && (
          <button
            onClick={onLinkPCO}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${hasPCOLink ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            title={hasPCOLink ? 'Manage Planning Center link' : 'Link to Planning Center'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 9.5L9.5 6.5M5.5 10.5L3.5 12.5C2.9 13.1 2.9 14.1 3.5 14.7V14.7C4.1 15.3 5.1 15.3 5.7 14.7L7.7 12.7M10.5 5.5L12.5 3.5C13.1 2.9 13.1 1.9 12.5 1.3V1.3C11.9 0.7 10.9 0.7 10.3 1.3L8.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <button
          onClick={() => onLayoutChange(section.layout === 'parallel' ? 'sequential' : 'parallel')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
          title={section.layout === 'parallel' ? 'Switch to sequential layout' : 'Switch to parallel (breakout) layout'}
        >
          {section.layout === 'parallel' ? <LayoutList className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onAddBlock}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          title="Add block to section"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          title="Rename section"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
          title="Delete section (items are kept)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
