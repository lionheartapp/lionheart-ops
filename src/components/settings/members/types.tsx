export interface ApiUser {
  id: string
  email: string
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

export function getInitials(firstName: string | null, lastName: string | null, email: string) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName[0].toUpperCase()
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
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-slate-100 text-slate-500',
    SUSPENDED: 'bg-red-100 text-red-700',
  }
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  )
}
