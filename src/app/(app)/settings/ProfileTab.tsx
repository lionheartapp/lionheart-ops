'use client'

/**
 * ProfileTab — Profile settings: avatar, name, email, password, notifications.
 *
 * Extracted from the main settings page to keep each file focused.
 * Contains all profile-related state and handlers.
 */

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import NotificationPreferences from '@/components/NotificationPreferences'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { Camera, User, Shield, ShieldCheck, Lock, Mail, Bell, Copy, Check, Fingerprint, KeyRound, Trash2, Pencil } from 'lucide-react'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'
import { getAuthHeaders } from '@/lib/api-client'
import { startRegistration } from '@simplewebauthn/browser'

type ProfileSubTab = 'profile' | 'security' | 'notifications'

const PROFILE_TABS: { key: ProfileSubTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
]

interface ProfileTabProps {
  userName: string | null
  userEmail: string | null
  userAvatar: string | null
  token?: string | null
}

export default function ProfileTab({ userName, userEmail, userAvatar }: ProfileTabProps) {
  const [subTab, setSubTab] = useState<ProfileSubTab>('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Avatar state
  const [avatarUpdating, setAvatarUpdating] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [displayAvatar, setDisplayAvatar] = useState<string | null>(null)

  // Profile name editing
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false)
  const [mfaDisablePassword, setMfaDisablePassword] = useState('')
  const [mfaDisableLoading, setMfaDisableLoading] = useState(false)
  const [mfaDisableError, setMfaDisableError] = useState('')
  const [backupCodesCopied, setBackupCodesCopied] = useState(false)
  const [regenCodesOpen, setRegenCodesOpen] = useState(false)
  const [regenPassword, setRegenPassword] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenError, setRegenError] = useState('')

  // Passkey state
  interface PasskeyInfo {
    id: string
    name: string
    deviceType: string | null
    backedUp: boolean
    createdAt: string
    lastUsedAt: string | null
  }
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')
  const [passkeyRegistering, setPasskeyRegistering] = useState(false)
  const [passkeyBackupCodes, setPasskeyBackupCodes] = useState<string[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // UX-033: track which passkey is pending deletion so we can show a
  // confirmation dialog (and block deletion of the last MFA method when MFA
  // is required at the org level — that would lock the user out).
  const [confirmDeletePasskey, setConfirmDeletePasskey] = useState<{ id: string; name: string } | null>(null)
  // UX-032: avatar remove is reversible (just re-upload), but the action
  // should still feel destructive. Track confirmation here.
  const [confirmRemoveAvatarOpen, setConfirmRemoveAvatarOpen] = useState(false)

  // Change password drawer
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Initialize display avatar and name fields on mount
  useEffect(() => {
    setDisplayAvatar(userAvatar)
    const nameParts = (userName || '').split(' ')
    setFirstName(nameParts[0] || '')
    setLastName(nameParts.slice(1).join(' ') || '')

    // Check MFA status
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setMfaEnabled(!!data.data?.mfaEnabled)
      })
      .catch(() => {})

    // Fetch passkeys
    fetchPasskeys()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Avatar helpers ─────────────────────────────────────────────────────────

  const ACCEPTED_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  ])
  const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB raw input
  const MAX_DIMENSION = 512 // avatar never needs to be larger
  const TARGET_QUALITY = 0.85

  /**
   * Resize an image file to MAX_DIMENSION and compress to JPEG/WebP via canvas.
   * Returns a data-URL string ready to send to the API.
   */
  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Scale down to MAX_DIMENSION, preserving aspect ratio
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, width, height)

        // Use WebP if the browser supports it, else JPEG
        const mimeType = canvas.toDataURL('image/webp').startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg'

        resolve(canvas.toDataURL(mimeType, TARGET_QUALITY))
      }
      img.onerror = () => reject(new Error('Failed to load image for processing'))
      img.src = URL.createObjectURL(file)
    })

  // ── Avatar handlers ────────────────────────────────────────────────────────

  const handleAvatarUpload = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      setAvatarError('Please select a JPG, PNG, GIF, WebP, or AVIF image')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('Image must be less than 15 MB')
      return
    }

    setAvatarUpdating(true)
    setAvatarError('')

    try {
      const base64Data = await resizeImage(file)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch('/api/auth/profile/avatar', {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ avatar: base64Data }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data?.error?.message || `Failed to update avatar (${response.status})`)
        }

        localStorage.setItem('user-avatar', data.data.user.avatar || '')
        setDisplayAvatar(data.data.user.avatar)

        if (typeof window !== 'undefined') {
          emitAppEvent(AppEventName.AVATAR_UPDATED, { avatar: data.data.user.avatar })
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Upload timed out. Please try again.')
        }
        throw fetchErr
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setAvatarUpdating(false)
    }
  }

  const handleRemoveAvatar = async () => {

    setAvatarUpdating(true)
    setAvatarError('')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch('/api/auth/profile/avatar', {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ avatar: null }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data?.error?.message || `Failed to remove avatar (${response.status})`)
        }

        localStorage.removeItem('user-avatar')
        setDisplayAvatar(null)

        if (typeof window !== 'undefined') {
          emitAppEvent(AppEventName.AVATAR_UPDATED, { avatar: null })
        }

        setAvatarUpdating(false)
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection.')
        }
        throw fetchErr
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove avatar')
      setAvatarUpdating(false)
    }
  }

  const handleChangeImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ── Profile name handlers ──────────────────────────────────────────────────

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) { setProfileError('First name is required'); return }

    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess(false)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() || null }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save profile')

      const newName = data.data.user.name
      localStorage.setItem('user-name', newName)
      setProfileSuccess(true)

      emitAppEvent(AppEventName.PROFILE_UPDATED, { name: newName })

      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Password handlers ──────────────────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return }

    setPasswordSaving(true)
    setPasswordError('')
    setPasswordSuccess(false)

    try {
      const response = await fetch('/api/auth/profile/password', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to change password')

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        setChangePasswordOpen(false)
        setPasswordSuccess(false)
      }, 1500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const openChangePassword = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess(false)
    setChangePasswordOpen(true)
  }

  const closeChangePassword = () => {
    if (passwordSaving) return
    setChangePasswordOpen(false)
    setPasswordError('')
  }

  // ── Passkey handlers ───────────────────────────────────────────────────────

  async function fetchPasskeys() {
    try {
      const res = await fetch('/api/auth/passkey/list', { credentials: 'include' })
      const data = await res.json()
      if (data.ok) setPasskeys(data.data || [])
    } catch {
      // Non-critical — passkey section will show empty
    }
  }

  async function handleRegisterPasskey() {
    setPasskeyError('')
    setPasskeyRegistering(true)
    setPasskeyBackupCodes([])

    try {
      // Step 1: Get registration options
      const optRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      })
      const optData = await optRes.json()
      if (!optData.ok) throw new Error(optData.error?.message || 'Failed to start registration')

      // Step 2: Trigger browser credential creation
      const attestation = await startRegistration({ optionsJSON: optData.data.options })

      // Step 3: Verify with server
      const verRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: attestation,
          challengeId: optData.data.challengeId,
        }),
      })
      const verData = await verRes.json()
      if (!verData.ok) throw new Error(verData.error?.message || 'Registration failed')

      // Show backup codes if this was the first MFA method
      if (verData.data?.backupCodes) {
        setPasskeyBackupCodes(verData.data.backupCodes)
      }

      setMfaEnabled(true)
      await fetchPasskeys()
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPasskeyError('Registration was cancelled.')
      } else {
        setPasskeyError(err instanceof Error ? err.message : 'Failed to register passkey')
      }
    } finally {
      setPasskeyRegistering(false)
    }
  }

  async function handleRenamePasskey(passkeyId: string) {
    if (!renameValue.trim()) return
    try {
      const res = await fetch(`/api/auth/passkey/${passkeyId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error?.message || 'Rename failed')
      setRenamingId(null)
      setRenameValue('')
      await fetchPasskeys()
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Failed to rename passkey')
    }
  }

  // Public entry point — opens the confirmation dialog. Actual deletion
  // happens in confirmDeletePasskeyHandler after the user confirms.
  function requestDeletePasskey(pk: { id: string; name: string }) {
    setPasskeyError('')
    setConfirmDeletePasskey(pk)
  }

  async function confirmDeletePasskeyHandler() {
    if (!confirmDeletePasskey) return
    const passkeyId = confirmDeletePasskey.id
    setConfirmDeletePasskey(null)
    setPasskeyError('')
    setDeletingId(passkeyId)
    try {
      const res = await fetch(`/api/auth/passkey/${passkeyId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error?.message || 'Delete failed')
      setDeletingId(null)
      await fetchPasskeys()
      // Re-check MFA status
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      const meData = await meRes.json()
      if (meData.ok) setMfaEnabled(!!meData.data?.mfaEnabled)
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Failed to delete passkey')
      setDeletingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header — full-width, flush top */}
      <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">My Profile</h3>
            <p className="text-sm text-slate-500 mt-0.5">Manage your personal information and security</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-5 pt-5 border-t border-slate-200/60">
          <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
            {PROFILE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  subTab === t.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {subTab === t.key && (
                  <motion.div
                    layoutId="profileTabPill"
                    className="absolute inset-0 rounded-full bg-slate-900"
                    transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Profile tab ── */}
      <div className={subTab !== 'profile' ? 'hidden' : 'space-y-6'}>

      <section className="ui-glass p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Personal Information</h3>
            <p className="text-sm text-slate-500 mt-0.5">Your name and profile photo</p>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-2xl overflow-hidden flex-shrink-0 ring-4 ring-white shadow-md">
              {displayAvatar ? (
                <img src={displayAvatar} alt={userName || 'User'} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                (firstName || userName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={handleChangeImageClick}
              disabled={avatarUpdating}
              className="absolute inset-0 w-20 h-20 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Change profile photo"
            >
              <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Profile Photo</p>
            <p className="text-xs text-slate-400 mb-3">JPG, PNG, GIF, WebP, or AVIF. Max 15 MB — we'll resize it automatically.</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                onChange={handleFileChange}
                className="hidden"
                disabled={avatarUpdating}
              />
              <button
                type="button"
                onClick={handleChangeImageClick}
                disabled={avatarUpdating}
                className="ui-btn px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                {avatarUpdating ? 'Uploading...' : 'Change Image'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemoveAvatarOpen(true)}
                disabled={avatarUpdating || !displayAvatar}
                /* UX-032: Remove sits next to "Change Image"; mark it visually
                   destructive (red text + red border) so the affordance is
                   clear before the user clicks. Confirmation is mild because
                   removing an avatar is reversible by re-uploading. */
                className="ui-btn px-4 py-2 rounded-full bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
        {avatarError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{avatarError}</div>
        )}

        <div className="border-t border-slate-100 my-6" />

        {/* Name form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Profile saved successfully.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatingInput
              id="firstName"
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={profileSaving}
              required
            />
            <FloatingInput
              id="lastName"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={profileSaving}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="ui-btn px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      </div>

      {/* ── Security tab ── */}
      <div className={subTab !== 'security' ? 'hidden' : 'space-y-6'}>

      {/* Account Security */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Account Security</h3>
            <p className="text-sm text-slate-500">Manage your email and password</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email Address</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
              <div className="flex-1">
                <FloatingInput id="email" label="Email" type="email" defaultValue={userEmail || ''} readOnly />
              </div>
              <span className="text-xs text-slate-400 lg:pb-3 whitespace-nowrap">Contact admin to change</span>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Password</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
              <div className="flex-1">
                <FloatingInput id="password" label="Password" type="password" value="••••••••••" readOnly />
              </div>
              <button
                type="button"
                onClick={openChangePassword}
                className="ui-btn px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                Change password
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Change Password Drawer */}
      <DetailDrawer
        isOpen={changePasswordOpen}
        onClose={closeChangePassword}
        title="Change Password"
        width="md"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="change-password-form"
              disabled={passwordSaving || passwordSuccess}
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {passwordSaving ? 'Saving...' : 'Update Password'}
            </button>
            <button
              type="button"
              onClick={closeChangePassword}
              disabled={passwordSaving}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="change-password-form" onSubmit={handleChangePassword} className="space-y-6">
          {passwordError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Password changed successfully!</div>
          )}

          <section className="space-y-5">
            <FloatingInput
              id="pw-current"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordSaving || passwordSuccess}
              required
              autoComplete="current-password"
            />

            <div>
              <FloatingInput
                id="pw-new"
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordSaving || passwordSuccess}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-slate-400">Must be at least 8 characters</p>
            </div>

            <FloatingInput
              id="pw-confirm"
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordSaving || passwordSuccess}
              required
              autoComplete="new-password"
            />
          </section>
        </form>
      </DetailDrawer>

      {/* Two-Factor Authentication */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Two-Factor Authentication</h3>
            <p className="text-sm text-slate-500">Add an extra layer of security to your account</p>
          </div>
        </div>

        {mfaBackupCodes.length > 0 ? (
          /* Show backup codes after setup */
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Save your backup codes</p>
              <p className="mt-1">These codes can be used to access your account if you lose your authenticator app. Each code can only be used once. Store them somewhere safe.</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
              {mfaBackupCodes.map((code, i) => (
                <span key={i} className="text-slate-700">{code}</span>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mfaBackupCodes.join('\n'))
                  setBackupCodesCopied(true)
                  setTimeout(() => setBackupCodesCopied(false), 2000)
                }}
                className="ui-btn flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                {backupCodesCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {backupCodesCopied ? 'Copied' : 'Copy codes'}
              </button>
              <button
                type="button"
                onClick={() => setMfaBackupCodes([])}
                className="ui-btn px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : mfaSetupOpen ? (
          /* MFA setup flow */
          <div className="space-y-5">
            {mfaQrCode ? (
              <>
                <p className="text-sm text-slate-600">Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.), then enter the 6-digit code it shows.</p>
                <div className="flex justify-center">
                  <img src={mfaQrCode} alt="Scan this QR code with your authenticator app" className="w-48 h-48" />
                </div>
                <div>
                  <label htmlFor="mfa-verify-code" className="block text-sm font-medium text-slate-700 mb-1">
                    Enter the 6-digit code
                  </label>
                  <input
                    id="mfa-verify-code"
                    type="text"
                    inputMode="numeric"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-slate-900 placeholder-slate-300 focus:border-slate-900 focus:outline-none transition-colors"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                {mfaError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{mfaError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={mfaLoading || mfaCode.length !== 6}
                    onClick={async () => {
                      setMfaLoading(true)
                      setMfaError('')
                      try {
                        const res = await fetch('/api/auth/mfa/confirm', {
                          method: 'POST',
                          headers: getAuthHeaders(),
                          body: JSON.stringify({ secret: mfaSecret, code: mfaCode }),
                        })
                        const data = await res.json()
                        if (!data.ok) throw new Error(data.error?.message || 'Failed to verify code')
                        setMfaEnabled(true)
                        setMfaBackupCodes(data.data.backupCodes)
                        setMfaSetupOpen(false)
                        setMfaQrCode('')
                        setMfaSecret('')
                        setMfaCode('')
                      } catch (err) {
                        setMfaError(err instanceof Error ? err.message : 'Verification failed')
                      } finally {
                        setMfaLoading(false)
                      }
                    }}
                    className="flex-1 ui-btn px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaSetupOpen(false); setMfaQrCode(''); setMfaSecret(''); setMfaCode(''); setMfaError('') }}
                    className="ui-btn px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
              </div>
            )}
          </div>
        ) : mfaDisableOpen ? (
          /* MFA disable confirmation */
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Enter your password to disable two-factor authentication.</p>
            <input
              type="password"
              value={mfaDisablePassword}
              onChange={(e) => setMfaDisablePassword(e.target.value)}
              placeholder="Your password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none transition-colors"
              autoComplete="current-password"
              autoFocus
            />
            {mfaDisableError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{mfaDisableError}</div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={mfaDisableLoading || !mfaDisablePassword}
                onClick={async () => {
                  setMfaDisableLoading(true)
                  setMfaDisableError('')
                  try {
                    const res = await fetch('/api/auth/mfa/disable', {
                      method: 'POST',
                      headers: getAuthHeaders(),
                      body: JSON.stringify({ password: mfaDisablePassword }),
                    })
                    const data = await res.json()
                    if (!data.ok) throw new Error(data.error?.message || 'Failed to disable')
                    setMfaEnabled(false)
                    setMfaDisableOpen(false)
                    setMfaDisablePassword('')
                  } catch (err) {
                    setMfaDisableError(err instanceof Error ? err.message : 'Failed to disable')
                  } finally {
                    setMfaDisableLoading(false)
                  }
                }}
                className="flex-1 ui-btn px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mfaDisableLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
              <button
                type="button"
                onClick={() => { setMfaDisableOpen(false); setMfaDisablePassword(''); setMfaDisableError('') }}
                className="ui-btn px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Default state — show status + action buttons */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${mfaEnabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className="text-sm text-slate-700">
                  {mfaEnabled ? 'Enabled — your account is protected' : 'Not enabled'}
                </span>
              </div>
              {mfaEnabled ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setRegenCodesOpen(true); setRegenPassword(''); setRegenError('') }}
                    className="ui-btn px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Regenerate Backup Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => setMfaDisableOpen(true)}
                    className="ui-btn px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Disable
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setMfaSetupOpen(true)
                    setMfaError('')
                    try {
                      const res = await fetch('/api/auth/mfa/setup', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                      })
                      const data = await res.json()
                      if (!data.ok) throw new Error(data.error?.message || 'Failed to start setup')
                      setMfaQrCode(data.data.qrCodeDataUrl)
                      setMfaSecret(data.data.secret)
                    } catch (err) {
                      setMfaError(err instanceof Error ? err.message : 'Setup failed')
                      setMfaSetupOpen(false)
                    }
                  }}
                  className="ui-btn px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
                >
                  Enable 2FA
                </button>
              )}
            </div>

            {/* Regenerate backup codes — password confirmation */}
            {regenCodesOpen && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-600">
                  Enter your password to regenerate backup codes. This will invalidate all existing backup codes.
                </p>
                <input
                  type="password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none transition-colors"
                  autoComplete="current-password"
                  autoFocus
                />
                {regenError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{regenError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={regenLoading || !regenPassword}
                    onClick={async () => {
                      setRegenLoading(true)
                      setRegenError('')
                      try {
                        const res = await fetch('/api/auth/mfa/regenerate-codes', {
                          method: 'POST',
                          headers: getAuthHeaders(),
                          body: JSON.stringify({ password: regenPassword }),
                        })
                        const data = await res.json()
                        if (!data.ok) throw new Error(data.error?.message || 'Failed to regenerate codes')
                        setMfaBackupCodes(data.data.backupCodes)
                        setRegenCodesOpen(false)
                        setRegenPassword('')
                      } catch (err) {
                        setRegenError(err instanceof Error ? err.message : 'Failed to regenerate codes')
                      } finally {
                        setRegenLoading(false)
                      }
                    }}
                    className="flex-1 ui-btn px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenLoading ? 'Regenerating...' : 'Regenerate Codes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRegenCodesOpen(false); setRegenPassword(''); setRegenError('') }}
                    className="ui-btn px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Passkeys */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Passkeys</h3>
            <p className="text-sm text-slate-500">Use Face ID, Touch ID, or a security key to sign in</p>
          </div>
        </div>

        {/* Backup codes from first passkey registration */}
        {passkeyBackupCodes.length > 0 && (
          <div className="space-y-4 mb-6">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Save your backup codes</p>
              <p className="mt-1">These codes can be used if you lose access to your passkeys. Each code can only be used once.</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
              {passkeyBackupCodes.map((code) => (
                <span key={code} className="text-slate-800">{code}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(passkeyBackupCodes.join('\n'))
                setPasskeyBackupCodes([])
              }}
              className="ui-btn px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              <Copy className="w-3.5 h-3.5 inline mr-1.5" />
              Copy & dismiss
            </button>
          </div>
        )}

        {passkeyError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {passkeyError}
          </div>
        )}

        {/* Passkey list */}
        {passkeys.length > 0 && (
          <div className="space-y-3 mb-4">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <KeyRound className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    {renamingId === pk.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePasskey(pk.id); if (e.key === 'Escape') setRenamingId(null) }}
                          className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                          autoFocus
                          maxLength={100}
                        />
                        <button onClick={() => handleRenamePasskey(pk.id)} className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Save</button>
                        <button onClick={() => setRenamingId(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-900 truncate block">{pk.name}</span>
                        <span className="text-xs text-slate-500">
                          Added {new Date(pk.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {pk.lastUsedAt && ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          {pk.backedUp && ' · Synced'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {renamingId !== pk.id && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setRenamingId(pk.id); setRenameValue(pk.name) }}
                      className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeletePasskey({ id: pk.id, name: pk.name })}
                      disabled={deletingId === pk.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      // UX-034: prefer aria-label for icon-only buttons.
                      aria-label={`Delete passkey "${pk.name}"`}
                      title="Delete"
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${deletingId === pk.id ? 'text-slate-400' : 'text-red-500'}`} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleRegisterPasskey}
          disabled={passkeyRegistering}
          className="ui-btn px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
        >
          {passkeyRegistering ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Registering...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              Add a passkey
            </span>
          )}
        </button>
      </section>

      </div>

      {/* ── Notifications tab ── */}
      <div className={subTab !== 'notifications' ? 'hidden' : 'space-y-6'}>

      <section className="ui-glass p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
            <p className="text-sm text-slate-500 mt-0.5">Choose how you want to be notified</p>
          </div>
        </div>
        <NotificationPreferences />
      </section>

      </div>

      {/* UX-032: confirm avatar removal (mild — reversible action). */}
      <ConfirmDialog
        isOpen={confirmRemoveAvatarOpen}
        onClose={() => setConfirmRemoveAvatarOpen(false)}
        onConfirm={() => {
          setConfirmRemoveAvatarOpen(false)
          handleRemoveAvatar()
        }}
        title="Remove your profile photo?"
        message="Your initials will show in place of your photo. You can re-upload anytime."
        confirmText="Remove photo"
        cancelText="Keep photo"
        variant="warning"
      />

      {/*
        UX-033: confirm passkey deletion. If MFA is required at the org level
        and this is the only passkey, warn that proceeding will lock the user
        out of their own account.
      */}
      <ConfirmDialog
        isOpen={confirmDeletePasskey !== null}
        onClose={() => setConfirmDeletePasskey(null)}
        onConfirm={confirmDeletePasskeyHandler}
        title={`Remove passkey "${confirmDeletePasskey?.name ?? ''}"?`}
        message={
          mfaEnabled && passkeys.length === 1
            ? "This is your only passkey AND multi-factor auth is enabled on your account. Removing it will lock you out the next time you sign in. Add another passkey first or disable MFA before removing this one."
            : "You'll need another sign-in method to access your account. You can add a new passkey at any time."
        }
        confirmText={mfaEnabled && passkeys.length === 1 ? 'Remove anyway' : 'Remove passkey'}
        cancelText="Keep passkey"
        variant="danger"
        // Lock-out scenario: require typing the passkey name to confirm.
        requireText={mfaEnabled && passkeys.length === 1 ? confirmDeletePasskey?.name : undefined}
      />
    </div>
  )
}
