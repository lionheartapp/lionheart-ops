import { redirect } from 'next/navigation'

export default function DraftEventsPage() {
  redirect('/events?status=DRAFT')
}
