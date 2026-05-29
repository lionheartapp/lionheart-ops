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
      description="Lionheart is built for school teams that need simple sign-in, clear roles, and stronger controls around daily operations."
      secondaryCta="See platform"
      secondaryHref="/platform"
      visual={{
        src: '/marketing/generated/security-controls.jpg',
        alt: 'Lionheart Academy security hero image with product cards for access policy, MFA, scoped teams, and isolated data.',
        presentation: 'campaign',
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
          body: 'Give staff access to the areas they need while keeping administrative controls limited.',
        },
        {
          icon: ShieldCheck,
          title: 'Org-aware access',
          body: 'Keep each school or organization separated, even when multiple campuses share the same system.',
        },
      ]}
      checklistTitle="A practical security foundation for school operations."
      checklist={[
        'Use role-based access for admins, staff, teams, and daily work.',
        'Support MFA and passkeys for stronger account protection.',
        'Keep each organization’s data separated from every other school.',
        'Build toward audit-ready controls as your operations mature.',
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
