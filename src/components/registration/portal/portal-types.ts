// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationStatus = 'DRAFT' | 'REGISTERED' | 'WAITLISTED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'DEPOSIT_PAID' | 'PAID'

export type ScheduleBlock = {
  id: string
  title: string
  type: string
  startsAt: string | null
  endsAt: string | null
  locationText: string | null
  description: string | null
}

export type Signature = {
  id: string
  documentLabel: string
  signatureType: string
  signedAt: string
}

export type Payment = {
  id: string
  amount: number
  currency: string
  status: string
  paymentType: string
  discountCode: string | null
  discountAmount: number | null
  paidAt: string | null
  createdAt: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

export type EventInfo = {
  id: string
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  coverImageUrl: string | null
  locationText: string | null
}

export type RegistrationInfo = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  grade: string | null
  status: RegistrationStatus
  paymentStatus: PaymentStatus
  submittedAt: string | null
  promotedAt: string | null
}

export type GroupAssignment = {
  groupId: string
  groupName: string
  groupType: 'BUS' | 'CABIN' | 'SMALL_GROUP' | string
  description: string | null
  leaderName: string | null
  assignedAt: string
}

export type PortalViewProps = {
  registration: RegistrationInfo
  event: EventInfo | null
  formTitle: string | null
  basePrice: number | null
  organization: Organization | null
  schedule: ScheduleBlock[]
  signatures: Signature[]
  payments: Payment[]
  onRequestNewLink: () => void
}
