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
        photo: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1000&q=82',
        alt: 'Forms and registration paperwork with school operations context.',
        accent: '#8b5cf6',
        metric: '92%',
        metricLabel: 'forms complete before the deadline',
        productTitle: 'Field trip registration',
        productSubtitle: 'Forms workflow',
        chips: ['QR collection', 'Approval route', 'Payment linked'],
        rows: [
          { label: 'Signature', value: 'Received', tone: 'green' },
          { label: 'Payment', value: 'Linked', tone: 'blue' },
          { label: 'Roster', value: 'Updated', tone: 'dark' },
        ],
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
      checklistTitle="Forms should start the workflow, not create another inbox."
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
