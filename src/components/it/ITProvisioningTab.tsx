'use client'

import {
  UserCog, Shield, RefreshCw, GraduationCap, Users, Bell,
} from 'lucide-react'
import { IllustrationDeployment } from '@/components/illustrations'

interface ITProvisioningTabProps {
  canManage: boolean
  canView: boolean
}

const PLANNED_FEATURES = [
  {
    icon: UserCog,
    title: 'Auto-Enroll New Students',
    description: 'Automatically provision Google Workspace or Microsoft 365 accounts when new students are enrolled in your SIS.',
  },
  {
    icon: Shield,
    title: 'Auto-Suspend on Transfer',
    description: 'When a student transfers out, their account is automatically suspended to protect data and free up licenses.',
  },
  {
    icon: RefreshCw,
    title: 'Orphan Detection',
    description: 'Weekly scans identify directory accounts with no matching SIS record so you can clean up stale accounts.',
  },
  {
    icon: GraduationCap,
    title: 'Graduation Archive',
    description: 'Batch archive graduating student accounts at the end of the school year with a single click.',
  },
  {
    icon: Users,
    title: 'Staff Onboarding',
    description: 'Automatically create IT setup tickets and provision accounts when new staff members are added.',
  },
]

export default function ITProvisioningTab({ canManage, canView }: ITProvisioningTabProps) {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center pt-4 pb-2">
        <IllustrationDeployment className="w-48 h-36 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">
          Account Provisioning
        </h2>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          Automated account lifecycle management is coming soon. Connect your
          identity provider to automatically provision, suspend, and archive
          student and staff accounts based on your SIS data.
        </p>
      </div>

      {/* What's Coming */}
      <div className="ui-glass p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          What provisioning will do
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANNED_FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="flex gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{feature.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notify Me CTA */}
      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200 rounded-xl p-6 text-center">
        <Bell className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-indigo-900">
          We will notify you when provisioning is available
        </p>
        <p className="text-xs text-indigo-700/80 mt-1 max-w-sm mx-auto leading-relaxed">
          Your organization will receive an in-app notification and email when
          identity provider integrations (Google Workspace and Microsoft 365)
          are ready to connect.
        </p>
      </div>
    </div>
  )
}
