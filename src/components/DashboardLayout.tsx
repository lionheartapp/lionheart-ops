'use client'

import { ReactNode } from 'react'
import Sidebar, { type SidebarProps } from './Sidebar'

interface DashboardLayoutProps extends SidebarProps {
  children: ReactNode
}

export default function DashboardLayout({
  children,
  userName,
  userEmail,
  userAvatar,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <div className="flex w-full min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
