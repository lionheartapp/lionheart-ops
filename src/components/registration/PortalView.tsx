'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import {
  CalendarDays,
  MapPin,
  CheckCircle2,
  Clock,
  FileText,
  CreditCard,
  Megaphone,
  RefreshCw,
  Mail,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import type { EventAnnouncementWithAuthor } from '@/lib/types/events-phase21'

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistrationStatus = 'DRAFT' | 'REGISTERED' | 'WAITLISTED' | 'CANCELLED'
type PaymentStatus = 'UNPAID' | 'DEPOSIT_PAID' | 'PAID'

type ScheduleBlock = {
  id: string
  title: string
  type: string
  startsAt: string | null
  endsAt: string | null
  locationText: string | null
  description: string | null
}

type Signature = {
  id: string
  documentLabel: string
  signatureType: string
  signedAt: string
}

type Payment = {
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

type Organization = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

type EventInfo = {
  id: string
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  coverImageUrl: string | null
  locationText: string | null
}

type RegistrationInfo = {
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

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

// ─── Status Badges ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RegistrationStatus }) {
  const styles: Record<RegistrationStatus, { bg: string; text: string; label: string }> = {
    REGISTERED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Registered' },
    WAITLISTED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Waitlisted' },
    CANCELLED:  { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Cancelled'  },
    DRAFT:      { bg: 'bg-gray-100',  text: 'text-gray-700',  label: 'Draft'      },
  }
  const s = styles[status] ?? styles.DRAFT
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {status === 'REGISTERED' && <CheckCircle2 className="w-3 h-3" />}
      {s.label}
    </span>
  )
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
    PAID:         { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
    DEPOSIT_PAID: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Deposit Paid' },
    UNPAID:       { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'No Payment Required' },
  }
  const s = styles[status] ?? styles.UNPAID
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ─── QR Code Display ──────────────────────────────────────────────────────────

function RegistrationQRCode({ registrationId }: { registrationId: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  useEffect(() => {
    const appUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://app.lionheartapp.com'
    const checkInUrl = `${appUrl}/events/check-in/${registrationId}`

    QRCode.toDataURL(checkInUrl, { width: 180, margin: 1 })
      .then(setQrUrl)
      .catch((err) => console.error('QR generation failed:', err))
  }, [registrationId])

  if (!qrUrl) {
    return (
      <div className="w-[180px] h-[180px] bg-gray-100 animate-pulse rounded-lg mx-auto" />
    )
  }

  return (
    <div className="text-center">
      <img
        src={qrUrl}
        alt="Check-in QR Code"
        width={180}
        height={180}
        className="border-4 border-gray-100 rounded-xl mx-auto"
      />
      <p className="text-xs text-gray-400 mt-2">Present at check-in</p>
    </div>
  )
}

// ─── Main PortalView Component ────────────────────────────────────────────────

const ANNOUNCEMENTS_REFETCH_INTERVAL = 30_000

export default function PortalView({
  registration,
  event,
  formTitle,
  basePrice,
  organization,
  schedule,
  signatures,
  payments,
  onRequestNewLink,
}: PortalViewProps) {
  const orgName = organization?.name ?? 'Your School'
  const orgLogo = organization?.logoUrl

  // Payment calculations
  const succeededPayments = payments.filter((p) => p.status === 'succeeded')
  const totalPaid = succeededPayments.reduce((sum, p) => sum + p.amount, 0)
  const balanceDue = basePrice ? Math.max(0, basePrice - totalPaid) : 0
  const hasBalance = balanceDue > 0

  // Event dates
  const eventDateStr = formatDate(event?.startsAt)
  const eventStartTime = formatTime(event?.startsAt)
  const eventEndTime = formatTime(event?.endsAt)
  const timeStr = eventStartTime && eventEndTime ? `${eventStartTime} – ${eventEndTime}` : eventStartTime

  // ─── Live announcements (auto-refresh every 30s) ──────────────────────────
  const [announcements, setAnnouncements] = useState<EventAnnouncementWithAuthor[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch(`/api/registration/${registration.id}/announcements`)
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setAnnouncements(json.data)
      }
    } catch {
      // Non-fatal — parent portal announcements are optional
    } finally {
      setAnnouncementsLoading(false)
    }
  }, [registration.id])

  useEffect(() => {
    fetchAnnouncements()
    const timer = setInterval(fetchAnnouncements, ANNOUNCEMENTS_REFETCH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchAnnouncements])

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white"
      initial="initial"
      animate="animate"
      variants={stagger}
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {orgLogo ? (
              <img
                src={orgLogo}
                alt={orgName}
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">
                  {orgName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 font-medium">{orgName}</p>
              <p className="text-sm font-semibold text-gray-900">Registration Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ─── Event Hero ──────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          {event?.coverImageUrl ? (
            <div className="relative rounded-2xl overflow-hidden h-48">
              <img
                src={event.coverImageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h1 className="text-white font-bold text-xl leading-tight">{event.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {eventDateStr && (
                    <span className="text-white/80 text-sm flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {eventDateStr}
                    </span>
                  )}
                  {timeStr && (
                    <span className="text-white/80 text-sm flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {timeStr}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white">
              <h1 className="font-bold text-xl">{event?.title ?? formTitle ?? 'Event Registration'}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                {eventDateStr && eventDateStr !== 'TBD' && (
                  <span className="text-blue-100 text-sm flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {eventDateStr}
                  </span>
                )}
                {timeStr && (
                  <span className="text-blue-100 text-sm flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {timeStr}
                  </span>
                )}
                {event?.locationText && (
                  <span className="text-blue-100 text-sm flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.locationText}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <StatusBadge status={registration.status} />
              </div>
            </div>
          )}
        </motion.div>

        {/* ─── Registration Summary Card ───────────────────────────────── */}
        <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Registration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Participant</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {registration.firstName} {registration.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</p>
              <p className="text-sm text-gray-700 mt-0.5 truncate">{registration.email}</p>
            </div>
            {registration.phone && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Phone</p>
                <p className="text-sm text-gray-700 mt-0.5">{registration.phone}</p>
              </div>
            )}
            {registration.grade && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Grade</p>
                <p className="text-sm text-gray-700 mt-0.5">{registration.grade}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Status</p>
              <div className="mt-0.5">
                <StatusBadge status={registration.status} />
              </div>
            </div>
            {registration.status !== 'DRAFT' && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Payment</p>
                <div className="mt-0.5">
                  <PaymentBadge status={registration.paymentStatus} />
                </div>
              </div>
            )}
            {registration.submittedAt && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Submitted</p>
                <p className="text-sm text-gray-700 mt-0.5">{formatShortDate(registration.submittedAt)}</p>
              </div>
            )}
          </div>

          {/* QR Code */}
          {registration.status === 'REGISTERED' && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center mb-3 font-medium">Your Check-In QR Code</p>
              <RegistrationQRCode registrationId={registration.id} />
            </div>
          )}

          {/* Waitlist notice */}
          {registration.status === 'WAITLISTED' && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                You are on the waitlist. If a spot opens, you will receive an email and your status
                will change to Registered automatically.
              </p>
            </div>
          )}
        </motion.div>

        {/* ─── Schedule Section ─────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Schedule
          </h2>

          {schedule.length === 0 ? (
            <div className="text-center py-6">
              <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Schedule will be posted soon.</p>
              <p className="text-xs text-gray-400 mt-1">Check back closer to the event date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedule.map((block) => (
                <div
                  key={block.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-blue-400 to-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{block.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {block.startsAt && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(block.startsAt)}
                          {block.endsAt && ` – ${formatTime(block.endsAt)}`}
                        </span>
                      )}
                      {block.locationText && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {block.locationText}
                        </span>
                      )}
                    </div>
                    {block.description && (
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{block.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium uppercase flex-shrink-0">
                    {block.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ─── Documents / Signatures Section ──────────────────────────── */}
        <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
          </h2>

          {signatures.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No documents on file.</p>
              <p className="text-xs text-gray-400 mt-1">
                Required documents will appear here when available.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {signatures.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {sig.documentLabel}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Signed {formatShortDate(sig.signedAt)}
                      {' · '}
                      {sig.signatureType === 'DRAWN' ? 'Drawn signature' : 'Typed signature'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ─── Payments Section ─────────────────────────────────────────── */}
        {(payments.length > 0 || basePrice) && (
          <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payments
            </h2>

            {payments.length > 0 && (
              <div className="space-y-2 mb-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {payment.paymentType === 'DEPOSIT' ? 'Deposit' :
                         payment.paymentType === 'BALANCE' ? 'Balance' : 'Full Payment'}
                      </p>
                      {payment.discountCode && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Code: {payment.discountCode}
                          {payment.discountAmount ? ` (−${formatCurrency(payment.discountAmount, payment.currency)})` : ''}
                        </p>
                      )}
                      {payment.paidAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatShortDate(payment.paidAt)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          payment.status === 'succeeded'
                            ? 'text-green-600'
                            : payment.status === 'canceled'
                            ? 'text-red-500'
                            : 'text-amber-600'
                        }`}
                      >
                        {payment.status === 'succeeded' ? 'Paid' :
                         payment.status === 'canceled' ? 'Canceled' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Balance summary */}
            {basePrice && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Registration fee</span>
                  <span className="font-medium text-gray-900">{formatCurrency(basePrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total paid</span>
                  <span className="font-medium text-green-700">{formatCurrency(totalPaid)}</span>
                </div>
                {hasBalance && (
                  <>
                    <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                      <span className="font-semibold text-gray-900">Balance due</span>
                      <span className="font-bold text-amber-700">{formatCurrency(balanceDue)}</span>
                    </div>
                    <a
                      href={`/events/register/pay/${registration.id}`}
                      className="block w-full text-center mt-3 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Pay {formatCurrency(balanceDue)} Balance
                    </a>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Announcements Section ────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Announcements
          </h2>

          {announcementsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-50 rounded-xl" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-6">
              <Megaphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No announcements yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Important updates will appear here as the event approaches.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 bg-blue-50 border border-blue-100 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{ann.title}</p>
                      <p className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">
                        {ann.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(ann.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ─── Actions Row ─────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
          <button
            type="button"
            onClick={onRequestNewLink}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Request New Link
          </button>

          {organization && (
            <a
              href={`mailto:?subject=Question about ${event?.title ?? 'my registration'}`}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              Contact {orgName}
            </a>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">
          {orgName} — Registration Portal
        </p>
        <p className="text-xs text-gray-300 mt-1">Powered by Lionheart</p>
      </footer>
    </motion.div>
  )
}
