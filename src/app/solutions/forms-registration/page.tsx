import type { Metadata } from 'next'
import { CreditCard, FileText, QrCode } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Forms and Registration Software | Lionheart',
  description: 'Create school forms, collect submissions, route approvals, manage registration, and connect payments to school operations.',
}

export default function FormsRegistrationSolutionPage() {
  return (
    <SeoLandingPage
      eyebrow="Forms & registration"
      title="School forms and registration connected to the work behind them."
      description="Lionheart helps schools collect forms, submissions, registrations, approvals, and payments while keeping the resulting work connected to events, staff, rooms, and follow-up."
      visual={{
        src: '/marketing/generated/solution-forms-registration.jpg',
        alt: 'Lionheart Academy forms and registration hero image with product cards for field trip registration, signatures, payments, and roster updates.',
        presentation: 'campaign',
        framing: 'left-detail',
      }}
      sections={[
        {
          icon: FileText,
          title: 'School forms',
          body: 'Create permission slips, surveys, requests, sign-ups, and internal forms without sending staff into another disconnected tool.',
        },
        {
          icon: QrCode,
          title: 'Easy collection',
          body: 'Use share links and QR codes so families, students, or staff can submit the right information quickly.',
        },
        {
          icon: CreditCard,
          title: 'Registration payments',
          body: 'Connect payments and registration data to the operational details teams need after someone signs up.',
        },
      ]}
      checklistTitle="Forms should start the next step, not create another inbox."
      checklist={[
        'Route submissions to the right staff member or approval path.',
        'Keep form responses connected to events, rooms, registrations, and follow-up tasks.',
        'Reduce duplicate entry between forms, spreadsheets, payment tools, and email.',
        'Support school programs, camps, events, surveys, and internal requests from one place.',
      ]}
      related={[
        { label: 'Events & calendars', href: '/solutions/events' },
        { label: 'Staff messaging', href: '/solutions/messaging' },
        { label: 'Platform overview', href: '/platform' },
        { label: 'Pricing', href: '/pricing' },
      ]}
    />
  )
}
