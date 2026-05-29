'use client'

import { useCallback, useState } from 'react'
import { Upload, X, Loader2, ImagePlus, Trophy, Plus } from 'lucide-react'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import { FileInput } from '@/components/ui/FileInput'
import { Textarea } from '@/components/ui/Textarea'
import type { RosterEntry } from './roster-types'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

interface RosterPlayerFormProps {
  firstName: string
  lastName: string
  jerseyNumber: string
  position: string
  grade: string
  height: string
  weight: string
  photoUrl: string
  bio: string
  linkedUserId: string
  userOptions: DropdownOption[]
  error: string
  playerId?: string
  existingRosters?: RosterEntry[]
  // Team selection (for create mode)
  teamOptions?: DropdownOption[]
  drawerTeamId?: string
  selectedTeamId?: string
  onDrawerTeamIdChange?: (value: string) => void
  // Callbacks
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onJerseyNumberChange: (value: string) => void
  onPositionChange: (value: string) => void
  onGradeChange: (value: string) => void
  onHeightChange: (value: string) => void
  onWeightChange: (value: string) => void
  onPhotoUrlChange: (value: string) => void
  onBioChange: (value: string) => void
  onLinkedUserIdChange: (value: string) => void
}

export default function RosterPlayerForm({
  firstName,
  lastName,
  jerseyNumber,
  position,
  grade,
  height,
  weight,
  photoUrl,
  bio,
  linkedUserId,
  userOptions,
  error,
  playerId,
  existingRosters,
  teamOptions,
  drawerTeamId,
  selectedTeamId,
  onDrawerTeamIdChange,
  onFirstNameChange,
  onLastNameChange,
  onJerseyNumberChange,
  onPositionChange,
  onGradeChange,
  onHeightChange,
  onWeightChange,
  onPhotoUrlChange,
  onBioChange,
  onLinkedUserIdChange,
}: RosterPlayerFormProps) {
  const isEditing = !!playerId
  const showTeamDropdown = !isEditing && !selectedTeamId && teamOptions && onDrawerTeamIdChange

  return (
    <div className="space-y-6">
      {/* ── Photo + Name Header ────────────────────────────────────── */}
      <div className="flex gap-5">
        {/* Large photo drop zone */}
        <PlayerPhotoArea
          playerId={playerId}
          photoUrl={photoUrl}
          firstName={firstName}
          lastName={lastName}
          onPhotoChange={onPhotoUrlChange}
        />

        {/* Name fields */}
        <div className="flex-1 space-y-3 pt-1">
          <FloatingInput
            id="first-name"
            label="First Name"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
          />
          <FloatingInput
            id="last-name"
            label="Last Name"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
          />
        </div>
      </div>

      {/* ── Player Info ────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Player Info</SectionLabel>
        <div className="space-y-3 rounded-xl bg-stone-50/60 border border-stone-100 p-4">
          <FloatingInput id="grade" label="Grade" value={grade} onChange={(e) => onGradeChange(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <FloatingInput id="height" label="Height" value={height} onChange={(e) => onHeightChange(e.target.value)} />
            <FloatingInput id="weight" label="Weight" value={weight} onChange={(e) => onWeightChange(e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <SectionLabel className="mb-0">Team</SectionLabel>
          {isEditing && (
            <button
              type="button"
              className="text-[11px] font-semibold uppercase tracking-wider text-primary-500 hover:text-primary-600 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 inline mr-0.5 -mt-px" />
              Add Team
            </button>
          )}
        </div>

        {/* Existing team assignments (edit mode) */}
        {isEditing && existingRosters && existingRosters.length > 0 && (
          <div className="space-y-2 mb-3">
            {existingRosters.map((r) => {
              const color = r.athleticTeam?.sport?.color || '#6b7280'
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 bg-white"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}12` }}
                  >
                    <Trophy className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-800 truncate">
                      {r.athleticTeam?.name}
                    </div>
                    <div className="text-xs text-stone-400">
                      {r.athleticTeam?.sport?.name}
                      {r.jerseyNumber && <span className="ml-1">#{r.jerseyNumber}</span>}
                      {r.position && <span className="ml-1.5 text-stone-500">{r.position}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Team selector + jersey/position */}
        <div className="space-y-3 rounded-xl bg-stone-50/60 border border-stone-100 p-4">
          {showTeamDropdown && (
            <FloatingDropdown
              id="drawer-team"
              label="Team"
              value={drawerTeamId ?? ''}
              onChange={onDrawerTeamIdChange}
              options={teamOptions}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <FloatingInput id="jersey-number" label="Jersey Number" value={jerseyNumber} onChange={(e) => onJerseyNumberChange(e.target.value)} />
            <FloatingInput id="position" label="Position" value={position} onChange={(e) => onPositionChange(e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── Public Profile ─────────────────────────────────────────── */}
      <section>
        <SectionLabel>Public Profile</SectionLabel>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="Short bio for the public profile..."
          rows={3}
          className="w-full text-sm text-stone-800 placeholder:text-stone-400 focus:ring-primary-500 resize-none"
        />
      </section>

      {/* ── Link to User ───────────────────────────────────────────── */}
      <FloatingDropdown
        id="linked-user"
        label="Link to User Account (optional)"
        value={linkedUserId}
        onChange={onLinkedUserIdChange}
        options={userOptions}
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Section Label ────────────────────────────────────────────────────────

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 ${className || 'mb-2.5'}`}>
      {children}
    </p>
  )
}

// ── Photo Area ───────────────────────────────────────────────────────────
// Large drag-and-drop zone that matches the mockup proportions

function PlayerPhotoArea({
  playerId,
  photoUrl,
  firstName,
  lastName,
  onPhotoChange,
}: {
  playerId?: string
  photoUrl: string
  firstName: string
  lastName: string
  onPhotoChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const canUpload = !!playerId
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()

  const handleFile = useCallback(
    async (file: File) => {
      if (!playerId) return
      setUploadError('')

      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError('Use JPEG, PNG, WebP, or GIF')
        return
      }
      if (file.size > MAX_SIZE) {
        setUploadError('Max 5MB')
        return
      }

      setUploading(true)
      try {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        const res = await fetch(`/api/athletics/roster/${playerId}/photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ fileBase64: base64, contentType: file.type }),
        })

        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Upload failed')
        onPhotoChange(data.data.photoUrl)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [playerId, token, onPhotoChange]
  )

  const handleRemove = useCallback(async () => {
    if (!photoUrl || !playerId) return
    setUploading(true)
    try {
      await fetch(`/api/athletics/roster/${playerId}/photo`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageUrl: photoUrl }),
      })
      onPhotoChange('')
    } catch {
      onPhotoChange('')
    } finally {
      setUploading(false)
    }
  }, [photoUrl, playerId, token, onPhotoChange])

  return (
    <div className="w-[160px] flex-shrink-0">
      <FileInput
        accept={ALLOWED_TYPES.join(',')}
        onFiles={(files) => {
          const file = files[0]
          if (file) handleFile(file)
        }}
        disabled={!canUpload || uploading}
        loading={uploading}
        compact
        className={`
          group relative w-[160px] h-[190px] rounded-2xl overflow-hidden transition-all p-0
          ${canUpload ? 'cursor-pointer' : ''}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
          ${photoUrl ? 'shadow-lg' : 'border-2 border-dashed border-stone-200 hover:border-stone-300 bg-stone-50/50'}
        `}
      >
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
          </div>
        )}

        {photoUrl ? (
          <>
            <OptimizedImage
              src={photoUrl}
              alt={`${firstName} ${lastName}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-white" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove() }}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-20 cursor-pointer"
              title="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-400 group-hover:text-stone-500 transition-colors">
            {initials ? (
              <span className="text-3xl font-bold text-stone-200">{initials}</span>
            ) : (
              <Upload className="w-7 h-7 text-stone-300" />
            )}
            <span className="text-xs text-stone-400">
              {canUpload ? 'drag n drop image' : 'save to add photo'}
            </span>
          </div>
        )}
      </FileInput>
      {uploadError && <p className="mt-1.5 text-[10px] text-red-500 text-center">{uploadError}</p>}
    </div>
  )
}
