'use client'

import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'

interface RosterPlayerFormProps {
  firstName: string
  lastName: string
  jerseyNumber: string
  position: string
  grade: string
  height: string
  weight: string
  linkedUserId: string
  userOptions: DropdownOption[]
  error: string
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onJerseyNumberChange: (value: string) => void
  onPositionChange: (value: string) => void
  onGradeChange: (value: string) => void
  onHeightChange: (value: string) => void
  onWeightChange: (value: string) => void
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
  linkedUserId,
  userOptions,
  error,
  onFirstNameChange,
  onLastNameChange,
  onJerseyNumberChange,
  onPositionChange,
  onGradeChange,
  onHeightChange,
  onWeightChange,
  onLinkedUserIdChange,
}: RosterPlayerFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FloatingInput id="first-name" label="First Name" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} />
        <FloatingInput id="last-name" label="Last Name" value={lastName} onChange={(e) => onLastNameChange(e.target.value)} />
      </div>
      <FloatingInput id="jersey-number" label="Jersey Number" value={jerseyNumber} onChange={(e) => onJerseyNumberChange(e.target.value)} />
      <FloatingInput id="position" label="Position" value={position} onChange={(e) => onPositionChange(e.target.value)} />
      <FloatingInput id="grade" label="Grade" value={grade} onChange={(e) => onGradeChange(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <FloatingInput id="height" label="Height" value={height} onChange={(e) => onHeightChange(e.target.value)} />
        <FloatingInput id="weight" label="Weight" value={weight} onChange={(e) => onWeightChange(e.target.value)} />
      </div>
      <FloatingDropdown
        id="linked-user"
        label="Link to User (optional)"
        value={linkedUserId}
        onChange={onLinkedUserIdChange}
        options={userOptions}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
