'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import {
  LayoutDashboard, School, CreditCard, LifeBuoy, Settings,
  LogOut, Menu, X, ChevronDown, Tag, FileText, ShieldCheck
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/schools', label: 'Schools', icon: School },
  {
    label: 'Billing', icon: CreditCard, children: [
      { href: '/admin/billing', label: 'Overview' },
      { href: '/admin/billing/plans', label: 'Plans' },
      { href: '/admin/billing/discount-codes', label: 'Discount Codes' },
    ]
  },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [admin, setAdmin] = useState<{ name?: string; email?: string; role?: string } | null>(null)
  const [billingOpen, setBillingOpen] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('platform-token') : null
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login')
      return
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('platform-admin') : null
    if (stored) setAdmin(JSON.parse(stored))
  }, [pathname, router])

  if (pathname === '/admin/login') return <>{children}</>

  const handleLogout = () => {
    localStorage.removeItem('platform-token')
    localStorage.removeItem('platform-admin')
    router.push('/admin/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex h-screen bg-[#0B1120] text-slate-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-mobilenav w-64 bg-[#0F1629] border-r border-white/[0.06] transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 px-5 flex items-center border-b border-white/[0.06]">
          <OptimizedImage src="/logo-white.svg" alt="Lionheart" className="h-8 w-auto" />
        </div>
        <div className="px-4 pt-5 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Platform</span>
        </div>
        <nav className="px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if ('children' in item && item.children) {
              const childActive = item.children.some(c => isActive(c.href))
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setBillingOpen(!billingOpen)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${childActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                  >
                    <item.icon size={18} className={childActive ? 'text-primary-400' : ''} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${billingOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {billingOpen && (
                    <div className="ml-9 space-y-0.5 mt-0.5">
                      {item.children.map((child) => (
                        <button
                          key={child.href}
                          onClick={() => { router.push(child.href); setSidebarOpen(false) }}
                          className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isActive(child.href) ? 'bg-primary-500/10 text-primary-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
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
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isActive(item.href!) ? 'bg-primary-500/10 text-primary-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
              >
                <item.icon size={18} className={isActive(item.href!) ? 'text-primary-400' : ''} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
              {admin?.name?.[0] || admin?.email?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-200">{admin?.name || admin?.email}</p>
              <p className="text-[11px] text-slate-500 truncate">{admin?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-navbar lg:hidden cursor-pointer" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 border-b border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold capitalize text-white">{pathname.split('/').filter(Boolean).pop() || 'Dashboard'}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
