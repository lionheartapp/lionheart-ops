'use client'

/**
 * ProfileTab — Profile settings: avatar, name, email, password, notifications.
 *
 * Extracted from the main settings page to keep each file focused.
 * Contains all profile-related state and handlers.
 */

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cardEntrance, staggerContainer } from '@/lib/animations'
import DetailDrawer from '@/components/DetailDrawer'
import NotificationPreferences from '@/components/NotificationPreferences'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { Camera, User, Shield, Lock, Mail, Bell } from 'lucide-react'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'
import { getAuthHeaders } from '@/lib/api-client'

interface ProfileTabProps {
  userName: string | null
  userEmail: string | null
  userAvatar: string | null
  token?: string | null
}

export default function ProfileTab({ userName, userEmail, userAvatar }: ProfileTabProps) {
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08, 0.05)}
    >

      {/* My Profile */}
      <motion.section variants={cardEntrance} className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">My Profile</h2>
            <p className="text-sm text-slate-500">Manage your personal information</p>
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
                onClick={handleRemoveAvatar}
                disabled={avatarUpdating || !displayAvatar}
                className="ui-btn px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
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
      </motion.section>

      {/* Account Security */}
      <motion.section variants={cardEntrance} className="ui-glass p-6">
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
      </motion.section>

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

      {/* Notification Preferences */}
      <motion.section variants={cardEntrance} className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
            <p className="text-sm text-slate-500">Choose how you want to be notified</p>
          </div>
        </div>
        <NotificationPreferences />
      </motion.section>
    </motion.div>
  )
}
