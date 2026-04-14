'use client'

import { useRouter } from 'next/navigation'
import {
  Wrench,
  ClipboardList,
  LayoutDashboard,
  Package,
  Monitor,
  Laptop,
  Ticket,
  Headphones,
} from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'

interface SupportSheetProps {
  open: boolean
  onClose: () => void
  showFacilities: boolean
  showIT: boolean
  showAV: boolean
  facilitiesGateCount?: { count: number }
  avGateCount?: { count: number }
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canReadInventory: boolean
  isOnMaintenanceTeam: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canSeeITDevices: boolean
  isOnITTeam: boolean
  isOnAVTeam: boolean
  canManageWorkspace: boolean
}

interface NavItem {
  icon: React.ReactNode
  label: string
  description: string
  href: string
  badge?: number
}

export default function SupportSheet({
  open,
  onClose,
  showFacilities,
  showIT,
  showAV,
  facilitiesGateCount,
  avGateCount,
  canManageMaintenance,
  canClaimMaintenance,
  canSubmitMaintenance,
  canReadInventory,
  isOnMaintenanceTeam,
  canManageIT,
  canSubmitIT,
  canSeeITDevices,
  isOnITTeam,
  isOnAVTeam,
  canManageWorkspace,
}: SupportSheetProps) {
  const router = useRouter()

  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  // Build facilities items
  const facilitiesItems: NavItem[] = []
  if (isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance) {
    facilitiesItems.push({
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboard',
      description: 'Work orders overview',
      href: '/maintenance',
      badge: facilitiesGateCount?.count,
    })
  }
  if (canSubmitMaintenance) {
    facilitiesItems.push({
      icon: <ClipboardList className="w-5 h-5" />,
      label: 'Submit Request',
      description: 'New maintenance ticket',
      href: '/maintenance?tab=my-requests',
    })
  }
  if (canReadInventory) {
    facilitiesItems.push({
      icon: <Package className="w-5 h-5" />,
      label: 'Assets',
      description: 'Asset register',
      href: '/maintenance/assets',
    })
  }

  // Build IT items
  const itItems: NavItem[] = []
  if (isOnITTeam || canManageIT) {
    itItems.push({
      icon: <Monitor className="w-5 h-5" />,
      label: 'IT Dashboard',
      description: 'Device management',
      href: '/it',
    })
  }
  if (canSeeITDevices) {
    itItems.push({
      icon: <Laptop className="w-5 h-5" />,
      label: 'Devices',
      description: 'Device inventory',
      href: '/it/devices',
    })
  }
  if (canSubmitIT) {
    itItems.push({
      icon: <Ticket className="w-5 h-5" />,
      label: 'IT Support',
      description: 'Submit IT ticket',
      href: '/it?tab=tickets',
    })
  }

  // Build AV items
  const avItems: NavItem[] = []
  if (isOnAVTeam || canManageWorkspace) {
    avItems.push({
      icon: <Headphones className="w-5 h-5" />,
      label: 'A/V Production',
      description: 'Equipment & requests',
      href: '/facilities?section=av',
      badge: avGateCount?.count,
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Support">
      <div className="px-4 py-3 space-y-5">
        {/* Facilities Section */}
        {showFacilities && facilitiesItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 px-2 mb-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Facilities</h4>
            </div>
            <div className="space-y-0.5">
              {facilitiesItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <span className="flex-shrink-0 text-slate-400">{item.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{item.description}</span>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-primary-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* IT Section */}
        {showIT && itItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 px-2 mb-2">
              <Monitor className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IT</h4>
            </div>
            <div className="space-y-0.5">
              {itItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <span className="flex-shrink-0 text-slate-400">{item.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{item.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* AV Section */}
        {showAV && avItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 px-2 mb-2">
              <Headphones className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">A/V Production</h4>
            </div>
            <div className="space-y-0.5">
              {avItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <span className="flex-shrink-0 text-slate-400">{item.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{item.description}</span>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-primary-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </BottomSheet>
  )
}
