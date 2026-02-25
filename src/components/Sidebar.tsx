'use client'

export interface SidebarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  onLogout?: () => void
}

export default function Sidebar(_props: SidebarProps) {
  return <aside className="w-48 border-r border-zinc-200 p-4">Sidebar</aside>
}
