import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowRight, AtSign, Check, ChevronRight, Hash, Mic, MoreVertical, Paperclip, Plus, Send, Smile, Video } from 'lucide-react'
import PublicFooter from '@/components/public/PublicFooter'
import PublicNav from '@/components/public/PublicNav'

export type SeoLandingPageProps = {
  eyebrow: string
  title: string
  description: string
  primaryCta?: string
  primaryHref?: string
  secondaryCta?: string
  secondaryHref?: string
  stats?: Array<{ value: string; label: string }>
  visual?: {
    src?: string
    photo?: string
    alt: string
    presentation?: 'side' | 'campaign'
    framing?: 'left-detail' | 'right-detail' | 'center-detail'
    accent?: string
    metric?: string
    metricLabel?: string
    productTitle?: string
    productSubtitle?: string
    chips?: string[]
    rows?: Array<{
      label: string
      value: string
      tone?: 'green' | 'amber' | 'blue' | 'red' | 'dark'
    }>
  }
  sections: Array<{
    title: string
    body: string
    icon: ElementType
  }>
  checklistTitle: string
  checklist: string[]
  related: Array<{ label: string; href: string }>
  productShowcase?: 'messaging'
}

export default function SeoLandingPage({
  eyebrow,
  title,
  description,
  primaryCta = 'Start 30-day trial',
  primaryHref = '/signup',
  secondaryCta = 'See how it works',
  secondaryHref = '#inside-lionheart',
  stats = [],
  visual,
  sections,
  checklistTitle,
  checklist,
  related,
  productShowcase,
}: SeoLandingPageProps) {
  // Generated campaign images sometimes include decorative CTA-looking art.
  // Keep real page actions in the DOM and use generated images only as side visuals.
  const showCampaignHero = false

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-slate-950">
      <PublicNav />

      <main>
        {showCampaignHero ? (
          <CampaignHero
            eyebrow={eyebrow}
            title={title}
            description={description}
            primaryCta={primaryCta}
            primaryHref={primaryHref}
            secondaryCta={secondaryCta}
            secondaryHref={secondaryHref}
            stats={stats}
            visual={visual}
          />
        ) : (
          <section className="px-6 pb-20 pt-16 sm:pb-24 sm:pt-24">
            <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[0.9fr_0.78fr] lg:items-center">
              <div className="max-w-[850px]">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {eyebrow}
                </p>
                <h1 className="text-4xl font-semibold leading-[1.05] text-slate-950 sm:text-6xl" style={{ letterSpacing: 0 }}>
                  {title}
                </h1>
                <p className="mt-6 max-w-[720px] text-[18px] leading-[1.65] text-slate-600">
                  {description}
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={primaryHref}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,15,15,0.18)] transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
                  >
                    {primaryCta}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                  </Link>
                  <Link
                    href={secondaryHref}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    {secondaryCta}
                    <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                  </Link>
                </div>
              </div>

              {visual && <HeroShowcase visual={visual} />}

              {stats.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(15,15,15,0.05)]">
                      <div className="text-3xl font-semibold tabular-nums text-slate-950">{stat.value}</div>
                      <div className="mt-1 text-sm leading-5 text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="border-y border-slate-200 bg-white px-6 py-20">
          <div className="mx-auto grid max-w-[1120px] gap-4 md:grid-cols-3">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <article key={section.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,15,15,0.05)]">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <h2 className="text-xl font-semibold leading-tight text-slate-950" style={{ letterSpacing: 0 }}>
                    {section.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {section.body}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {productShowcase === 'messaging' ? (
          <MessagingShowcase />
        ) : (
          <GenericProductShowcase sections={sections} checklist={checklist} />
        )}

        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                School-day outcomes
              </p>
              <h2 className="text-3xl font-semibold leading-[1.08] text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>
                {checklistTitle}
              </h2>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,15,15,0.05)]">
              <ul className="space-y-4">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-6 text-slate-700">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#eef3f0] px-6 py-16">
          <div className="mx-auto max-w-[1120px]">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Explore more
            </p>
            <div className="flex flex-wrap gap-3">
              {related.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-950 hover:text-white"
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

function GenericProductShowcase({
  sections,
  checklist,
}: {
  sections: SeoLandingPageProps['sections']
  checklist: string[]
}) {
  return (
    <section id="inside-lionheart" className="scroll-mt-24 px-6 py-20">
      <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Inside Lionheart
          </p>
          <h2 className="text-3xl font-semibold leading-[1.08] text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>
            See what needs attention, who owns it, and what happens next.
          </h2>
          <p className="mt-5 text-[16px] leading-7 text-slate-600">
            Every request keeps the details staff need close by: location, owner, status, messages, approvals, and follow-up.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,15,15,0.1)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
              Live request
            </span>
          </div>

          <div className="grid gap-4 bg-[#f7f8f7] p-4 sm:p-5 md:grid-cols-[0.38fr_0.62fr]">
            <div className="space-y-3">
              {sections.map((section, index) => {
                const Icon = section.icon
                return (
                  <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                        <Icon className="h-4 w-4" strokeWidth={2.4} />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold leading-5 text-slate-950">
                          {section.title}
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Step {index + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Connected
                  </p>
                  <h3 className="mt-1 text-xl font-semibold leading-tight text-slate-950" style={{ letterSpacing: 0 }}>
                    {sections[0]?.title}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                  Next step ready
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {checklist.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-[#fbfcfb] p-4">
                    <div className="flex gap-3">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                      <p className="text-[13px] leading-5 text-slate-600">
                        {item}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['Owner', 'Status', 'Context'].map((label) => (
                  <div key={label} className="rounded-2xl bg-slate-950 p-3 text-white">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {label}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/20" />
                    <div className="mt-2 h-2 w-2/3 rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MessagingShowcase() {
  const directMessages = [
    { name: 'Maya Chen', role: 'Front office', status: 'online', initials: 'MC', active: true },
    { name: 'Jordan Lee', role: 'IT support', status: 'online', initials: 'JL' },
    { name: 'Priya Shah', role: 'Facilities', status: 'away', initials: 'PS' },
  ]
  const groups = [
    { name: 'awards-night', meta: 'Office, athletics, facilities', unread: '4', active: true },
    { name: 'it-support', meta: 'Device tickets and rooms', unread: '2' },
    { name: 'facilities', meta: 'Work orders and setup' },
  ]
  const messages = [
    {
      author: 'Maya Chen',
      time: '9:12 AM',
      text: 'Can we confirm the projector setup for Awards Night? Parents start arriving at 5:30.',
    },
    {
      author: 'Jordan Lee',
      time: '9:14 AM',
      text: 'Linked the open projector ticket. Device is assigned to Room 204 and the loaner is ready if needed.',
    },
    {
      author: 'Priya Shah',
      time: '9:16 AM',
      text: 'Facilities has the gym unlocked at 4:45. Chairs are assigned to the event setup list.',
    },
  ]

  return (
    <section id="inside-lionheart" className="scroll-mt-24 px-6 py-20">
      <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.74fr_1.26fr] lg:items-center">
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Inside messaging
          </p>
          <h2 className="text-3xl font-semibold leading-[1.08] text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>
            See who is online, then message the right person or group.
          </h2>
          <p className="mt-5 text-[16px] leading-7 text-slate-600">
            Staff can use 1:1 DMs for quick follow-up, group channels for teams, and threads tied to the work everyone is discussing.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-[#2a2c2d] bg-[#080A0A] shadow-[0_30px_95px_rgba(8,10,10,0.38)]">
          <div className="grid bg-[#0d0f10] md:grid-cols-[0.38fr_0.62fr]">
            <aside className="border-b border-[#242728] bg-[#0b0d0e] p-4 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7478]">
                    Messages
                  </p>
                  <h3 className="mt-1 text-[17px] font-semibold text-[#e3e6e8]" style={{ letterSpacing: 0 }}>
                    Staff inbox
                  </h3>
                </div>
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[12px] font-medium text-emerald-300">
                  7 online
                </span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f7478]">
                  <AtSign className="h-3.5 w-3.5" />
                  1:1 DMs
                </div>
                <div className="space-y-2">
                  {directMessages.map((person) => (
                    <div
                      key={person.name}
                      className={`rounded-lg border p-3 ${person.active ? 'border-[#2f3436] bg-[#171a1c] text-[#f0f2f3]' : 'border-[#202324] bg-[#101213] text-[#c6c9cb]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${person.active ? 'bg-[#dfe3e6] text-[#080A0A]' : 'bg-[#1a1d1f] text-[#9ea3a8]'}`}>
                          {person.initials}
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#101213] ${person.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">{person.name}</div>
                          <div className={`truncate text-[12px] ${person.active ? 'text-[#8b9297]' : 'text-[#686d72]'}`}>
                            {person.role} · {person.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f7478]">
                  <Hash className="h-3.5 w-3.5" />
                  Groups
                </div>
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.name} className={`rounded-lg border p-3 ${group.active ? 'border-[#303436] bg-[#171a1c]' : 'border-[#202324] bg-[#101213]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#e3e6e8]"># {group.name}</div>
                          <div className="truncate text-[12px] text-[#686d72]">{group.meta}</div>
                        </div>
                        {group.unread && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5E6AD2] px-1.5 text-[11px] font-semibold text-white">
                            {group.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="p-3 sm:p-4">
              <div className="rounded-lg border border-[#2a2c2d] bg-[#111314]">
                <div className="flex items-center justify-between border-b border-[#26292b] px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1b1e20] text-[#9ea3a8]">
                      <Hash className="h-5 w-5" strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold text-[#e3e6e8]">Thread in #awards-night</div>
                      <div className="mt-0.5 text-[12px] text-[#747a80]">Office, athletics, facilities · linked to event setup</div>
                    </div>
                  </div>
                  <button type="button" aria-label="More thread options" className="flex h-9 w-9 items-center justify-center rounded-md text-[#8b9297] transition-colors duration-200 hover:bg-[#1b1e20]">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-5 px-4 py-5">
                  {messages.map((message) => (
                    <div key={`${message.author}-${message.time}`} className="flex gap-4">
                      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1d2022] text-[13px] font-semibold text-[#c6c9cb]">
                        {message.author.split(' ').map((part) => part[0]).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#dfe3e6]">{message.author}</span>
                          <span className="text-[13px] text-[#626870]">{message.time}</span>
                        </div>
                        <p className="mt-1 text-[16px] leading-7 text-[#aeb4ba]">{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#26292b] p-3">
                  <div className="rounded-lg border border-[#2a2d2f] bg-[#141617] p-4">
                    <div className="text-[16px] leading-7 text-[#e3e6e8]">
                      <span className="rounded-md bg-[#242a50] px-1.5 py-0.5 text-[#9aa5ff]">@Leo</span>
                      {' '}summarize what still needs to happen before families arrive
                    </div>
                    <div className="mt-8 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[#6f7478]">
                        {[
                          { icon: Plus, label: 'Add attachment' },
                          { icon: Paperclip, label: 'Attach file' },
                          { icon: Smile, label: 'Add reaction' },
                          { icon: AtSign, label: 'Mention staff' },
                          { icon: Video, label: 'Start video' },
                          { icon: Mic, label: 'Record audio' },
                        ].map((item, index) => {
                          const Icon = item.icon
                          return (
                            <button key={item.label} type="button" aria-label={item.label} className={`${index > 3 ? 'hidden sm:flex' : 'flex'} h-8 w-8 items-center justify-center rounded-md transition-colors duration-200 hover:bg-[#1f2224] hover:text-[#c6c9cb]`}>
                              <Icon className="h-4 w-4" strokeWidth={2.1} />
                            </button>
                          )
                        })}
                      </div>
                      <button type="button" className="flex h-10 items-center gap-2 rounded-lg bg-[#5E6AD2] px-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#6f7ae6]">
                        <Send className="h-4 w-4 fill-current" />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CampaignHero({
  eyebrow,
  title,
  description,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  stats,
  visual,
}: {
  eyebrow: string
  title: string
  description: string
  primaryCta: string
  primaryHref: string
  secondaryCta: string
  secondaryHref: string
  stats: NonNullable<SeoLandingPageProps['stats']>
  visual: NonNullable<SeoLandingPageProps['visual']>
}) {
  return (
    <section className="px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
      <div className="mx-auto max-w-[1360px]">
        <div className="sr-only">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <a href={primaryHref}>{primaryCta}</a>
          <a href={secondaryHref}>{secondaryCta}</a>
        </div>

        <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,15,15,0.16)] sm:rounded-[2rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Generated marketing artwork contains the campaign layout and product UI. */}
          <img
            src={visual.src}
            alt={visual.alt}
            className="block h-auto w-full"
            loading="eager"
            decoding="async"
          />
          <Link
            href={primaryHref}
            aria-label={primaryCta}
            className="absolute left-[2.65%] top-[71.1%] hidden h-[6.9%] w-[14.8%] rounded-full outline-none transition-shadow duration-200 hover:shadow-[0_0_0_3px_rgba(15,23,42,0.18)] focus-visible:block focus-visible:ring-4 focus-visible:ring-blue-500/70 sm:block"
          >
            <span className="sr-only">{primaryCta}</span>
          </Link>
          <Link
            href={secondaryHref}
            aria-label={secondaryCta}
            className="absolute left-[19.25%] top-[71.15%] hidden h-[6.8%] w-[12.25%] rounded-full outline-none transition-shadow duration-200 hover:shadow-[0_0_0_3px_rgba(37,99,235,0.16)] focus-visible:block focus-visible:ring-4 focus-visible:ring-blue-500/70 sm:block"
          >
            <span className="sr-only">{secondaryCta}</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:hidden">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,15,15,0.18)] transition-all duration-200 active:scale-[0.98]"
          >
            {primaryCta}
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors duration-200 active:scale-[0.98]"
          >
            {secondaryCta}
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </Link>
        </div>

        {stats.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(15,15,15,0.05)]">
                <div className="text-3xl font-semibold tabular-nums text-slate-950">{stat.value}</div>
                <div className="mt-1 text-sm leading-5 text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function HeroShowcase({ visual }: { visual: NonNullable<SeoLandingPageProps['visual']> }) {
  const accent = visual.accent ?? '#2563eb'
  const rows = visual.rows ?? [
    { label: 'Owner', value: 'Assigned', tone: 'green' },
    { label: 'Status', value: 'In progress', tone: 'blue' },
    { label: 'Context', value: 'Linked', tone: 'dark' },
  ]
  const chips = visual.chips ?? ['Owner', 'Status', 'Context']
  const generatedImageClass = {
    'left-detail': 'origin-left scale-[1.25] object-cover object-[8%_center]',
    'right-detail': 'origin-right scale-[1.9] object-cover object-[96%_center]',
    'center-detail': 'origin-center scale-[1.35] object-cover object-center',
  }[visual.framing ?? 'right-detail']
  const toneClasses = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    dark: 'bg-slate-950 text-white',
  }

  if (!visual.photo && visual.src) {
    return (
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,15,15,0.15)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Local SVG editorial assets are authored for this exact frame. */}
        <img
          src={visual.src}
          alt={visual.alt}
          className={`block aspect-[4/3] h-auto w-full ${generatedImageClass}`}
          loading="eager"
          decoding="async"
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_95px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-y-0 right-0 w-[72%]" style={{ backgroundColor: accent }} />
      <div className="absolute bottom-0 left-[8%] h-[58%] w-[84%] rounded-t-[5rem] bg-white/24" />

      {visual.photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Marketing hero photos are remote editorial assets. */}
          <img
            src={visual.photo}
            alt={visual.alt}
            className="absolute bottom-0 right-[4%] h-[88%] w-[62%] object-cover object-center"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/20 to-transparent" />
        </>
      )}

      <div className="absolute left-6 top-7 max-w-[250px] rounded-[1.5rem] bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {visual.productSubtitle ?? 'Live workspace'}
        </div>
        <div className="mt-2 text-xl font-semibold leading-tight text-slate-950" style={{ letterSpacing: 0 }}>
          {visual.productTitle ?? 'Connected operations'}
        </div>
        <div className="mt-4 space-y-2">
          {rows.slice(0, 3).map((row) => (
            <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[12px] font-semibold text-slate-600">{row.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[row.tone ?? 'dark']}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-7 top-9 rounded-[1.75rem] bg-white p-5 text-center shadow-[0_18px_55px_rgba(15,23,42,0.18)]">
        <div
          className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[14px] text-3xl font-semibold tabular-nums"
          style={{ borderColor: accent, color: '#020617' }}
        >
          {visual.metric ?? '84%'}
        </div>
        <p className="mt-3 max-w-[170px] text-[14px] font-medium leading-5 text-slate-700">
          {visual.metricLabel ?? 'work already connected'}
        </p>
      </div>

      <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-3">
        {chips.slice(0, 3).map((chip) => (
          <div key={chip} className="rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-slate-950 shadow-[0_16px_38px_rgba(15,23,42,0.16)]">
            {chip}
          </div>
        ))}
      </div>
    </div>
  )
}
