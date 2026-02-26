'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, School, CreditCard, LifeBuoy, Settings,
  LogOut, Menu, X, ChevronDown, Tag, FileText
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schools', label: 'Schools', icon: School },
  {
    label: 'Billing', icon: CreditCard, children: [
      { href: '/billing', label: 'Overview' },
      { href: '/billing/plans', label: 'Plans' },
      { href: '/billing/discount-codes', label: 'Discount Codes' },
    ]
  },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [admin, setAdmin] = useState<{ name?: string; email?: string; role?: string } | null>(null)
  const [billingOpen, setBillingOpen] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('platform-token') : null
    if (!token && pathname !== '/login') {
      router.push('/login')
      return
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('platform-admin') : null
    if (stored) setAdmin(JSON.parse(stored))
  }, [pathname, router])

  if (pathname === '/login') return <>{children}</>

  const handleLogout = () => {
    localStorage.removeItem('platform-token')
    localStorage.removeItem('platform-admin')
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 h-16 px-6 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-sm">L</div>
          <span className="font-semibold text-lg">Lionheart Admin</span>
        </div>
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            if ('children' in item && item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setBillingOpen(!billingOpen)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    <item.icon size={18} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${billingOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {billingOpen && (
                    <div className="ml-9 space-y-1 mt-1">
                      {item.children.map((child) => (
                        <button
                          key={child.href}
                          onClick={() => { router.push(child.href); setSidebarOpen(false) }}
                          className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive(child.href) ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href!); setSidebarOpen(false) }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive(item.href!) ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium">
              {admin?.name?.[0] || admin?.email?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{admin?.name || admin?.email}</p>
              <p className="text-xs text-zinc-500 truncate">{admin?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 border-b border-zinc-800 bg-zinc-900/50">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-zinc-800">
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold capitalize">{pathname.split('/').filter(Boolean).pop() || 'Dashboard'}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
