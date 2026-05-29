import { redirect } from 'next/navigation'

/**
 * Redirect to the Maintenance Hub's PM Calendar tab.
 * The standalone PM Calendar page was consolidated into the hub.
 */
export default function PmCalendarRedirect() {
  redirect('/maintenance?tab=pm-calendar')
}
