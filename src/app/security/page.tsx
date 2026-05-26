import type { Metadata } from 'next'
import { KeyRound, ShieldCheck, UsersRound } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Operations Security | Lionheart',
  description: 'Lionheart supports school operations security with MFA, passkeys, roles, permissions, audit-ready controls, and organization-aware access.',
}

export default function SecurityPage() {
  return (
    <SeoLandingPage
      eyebrow="Security"
      title="Security controls for school operations software."
      description="Lionheart is built for school teams that need simple access, clear roles, and stronger controls across daily operations workflows."
      secondaryCta="See platform"
      secondaryHref="/platform"
      visual={{
        photo: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1000&q=82',
        alt: 'Secure operations and access control context.',
        accent: '#0284c7',
        metric: 'MFA',
        metricLabel: 'modern account protection built in',
        productTitle: 'Access policy',
        productSubtitle: 'Security controls',
        chips: ['Passkeys', 'Role access', 'Org boundaries'],
        rows: [
          { label: 'Admins', value: 'MFA', tone: 'green' },
          { label: 'Teams', value: 'Scoped', tone: 'blue' },
          { label: 'Data', value: 'Isolated', tone: 'dark' },
        ],
      }}
      sections={[
        {
          icon: KeyRound,
          title: 'MFA and passkeys',
          body: 'Support modern sign-in patterns that help protect staff accounts without adding unnecessary daily friction.',
        },
        {
          icon: UsersRound,
          title: 'Roles and permissions',
          body: 'Give staff access to the operational areas they need while keeping administrative controls limited.',
        },
        {
          icon: ShieldCheck,
          title: 'Org-aware access',
          body: 'Keep each school or organization separated inside a multi-tenant platform architecture.',
        },
      ]}
      checklistTitle="A practical security foundation for school operations."
      checklist={[
        'Use role-based access for admins, staff, teams, and operational workflows.',
        'Support MFA and passkeys for stronger account protection.',
        'Keep organization data isolated in a multi-tenant platform.',
        'Build toward audit-ready controls as the platform grows.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'IT & devices', href: '/solutions/it' },
        { label: 'Leo AI', href: '/leo-ai' },
        { label: 'Pricing', href: '/pricing' },
      ]}
    />
  )
}
