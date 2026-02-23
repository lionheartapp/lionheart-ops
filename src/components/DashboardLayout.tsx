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
      <main className="flex-1 pt-16 lg:pt-0">
        <div className="py-4 sm:py-6 lg:py-8 px-4 sm:px-10">
          {children}
        </div>
      </main>
    </div>
  )
}
