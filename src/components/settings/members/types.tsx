export interface ApiUser {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  avatar: string | null
  jobTitle: string | null
  status: string
  createdAt: string
  teams: { team: { id: string; name: string; slug: string } }[]
  userRole: { id: string; name: string; slug: string } | null
}

export interface TeamOption {
  id: string
  name: string
  slug: string
}

export interface RoleOption {
  id: string
  name: string
  slug: string
}

export function getDisplayName(user: { firstName: string | null; lastName: string | null; name: string | null }): string | null {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return full || user.name || null
}

export function getInitials(firstName: string | null, lastName: string | null, email: string, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName[0].toUpperCase()
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name[0].toUpperCase()
  }
  return email[0].toUpperCase()
}

export function getAvatarColor(id: string) {
  const colors = [
    'bg-primary-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
    'bg-teal-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500',
  ]
  const index = id.charCodeAt(0) % colors.length
  return colors[index]
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-50 text-green-600 ring-1 ring-green-200',
    PENDING: 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200',
    INACTIVE: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200',
    SUSPENDED: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  }
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${map[status] ?? 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'}`}>
      {label}
    </span>
  )
}
