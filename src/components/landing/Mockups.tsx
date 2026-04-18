'use client'

import { Calendar, Check, Headphones, Lock, MonitorSmartphone, Plus, Sparkles, Trophy, Wrench } from 'lucide-react'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BORDER_SOFT, SURFACE_ALT, SURFACE_WARM, CARD_SHADOW, HERO_MOCKUP_SHADOW, AI_GRADIENT } from './tokens'

// ─── Dashboard mockup (the hero visual) ─────────────────────────────────────

export function DashboardMockup() {
  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{ boxShadow: HERO_MOCKUP_SHADOW }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: '#f7f6f4', borderBottom: `1px solid ${BORDER_SOFT}` }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        </div>
        <div className="flex-1 flex justify-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium"
            style={{ backgroundColor: '#ffffff', color: TEXT_SECONDARY, border: `1px solid ${BORDER_SOFT}` }}
          >
            <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
            lincoln-high.lionheartapp.com
          </div>
        </div>
        <div className="w-12" />
      </div>

      {/* Trial banner inside mockup */}
      <div
        className="h-9 flex items-center justify-center text-[12px] font-semibold text-white gap-2"
        style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)' }}
      >
        <Sparkles className="w-3 h-3" />
        Free trial — 28 days remaining. Everything&rsquo;s unlocked. No card required.
      </div>

      {/* App body */}
      <div
        className="grid grid-cols-[200px_1fr_280px] h-[520px]"
        style={{ backgroundColor: '#fbfaf8' }}
      >
        {/* Sidebar */}
        <MockSidebar />

        {/* Main: upcoming events panel */}
        <MockEventsPanel />

        {/* Leo rail */}
        <MockLeoRail />
      </div>
    </div>
  )
}

export function MockSidebar() {
  const navItems: { label: string; icon: typeof Calendar; active?: boolean }[] = [
    { label: 'Dashboard', icon: Calendar, active: true },
    { label: 'Events', icon: Calendar },
    { label: 'Maintenance', icon: Wrench },
    { label: 'IT Help Desk', icon: MonitorSmartphone },
    { label: 'Athletics', icon: Trophy },
    { label: 'A/V Production', icon: Headphones },
  ]
  return (
    <div
      className="flex flex-col p-4 gap-1"
      style={{ borderRight: `1px solid ${BORDER_SOFT}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
          style={{ background: AI_GRADIENT }}
        >
          LH
        </div>
        <div>
          <div className="text-[12px] font-semibold leading-tight" style={{ color: TEXT_PRIMARY }}>
            Lincoln High
          </div>
          <div className="text-[9px]" style={{ color: TEXT_MUTED }}>
            1,240 students
          </div>
        </div>
      </div>
      <div className="h-px my-2" style={{ backgroundColor: BORDER_SOFT }} />
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg"
            style={{
              backgroundColor: item.active ? 'rgba(15,15,15,0.05)' : 'transparent',
              color: item.active ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontWeight: item.active ? 600 : 500,
            }}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            {item.label}
          </div>
        )
      })}
    </div>
  )
}

export function MockEventsPanel() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const weekdayIdx = i % 7
    const hasEvents = [0, 1, 3, 5, 8, 11, 13].includes(i)
    return {
      label: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][weekdayIdx],
      date: 9 + i,
      isToday: i === 0,
      eventCount: hasEvents ? (i === 0 ? 3 : 1) : 0,
    }
  })

  const eventRows = [
    { day: 'MON', date: 9, title: 'Spring Concert Rehearsal', time: '10:30a – 11:45a', loc: 'Auditorium', color: '#6366f1' },
    { day: 'MON', date: 9, title: 'Faculty PD Meeting', time: '3:00p – 4:00p', loc: 'Library', color: '#10b981' },
    { day: 'TUE', date: 10, title: 'JV Basketball vs Eastwood', time: '4:30p – 6:00p', loc: 'Home gym', color: '#f59e0b' },
    { day: 'THU', date: 12, title: 'Board of Directors', time: '6:00p – 8:00p', loc: 'Board room', color: '#8b5cf6' },
  ]

  return (
    <div className="p-5 overflow-hidden">
      <div
        className="rounded-2xl p-5 h-full flex flex-col"
        style={{ backgroundColor: SURFACE_WARM, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3
              className="text-[17px] font-semibold"
              style={{ color: TEXT_PRIMARY, letterSpacing: '-0.025em' }}
            >
              The next two weeks
            </h3>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: '#6a6864' }}>
              Apr 9 – Apr 22 · 12 events · <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>3 today</span>
            </p>
          </div>
          <div
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: TEXT_PRIMARY }}
          >
            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
            Event
          </div>
        </div>

        {/* Timeline strip */}
        <div
          className="grid gap-[3px] mb-4"
          style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}
        >
          {days.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-between py-1.5 px-0.5 rounded-md"
              style={{
                backgroundColor: d.isToday ? TEXT_PRIMARY : 'transparent',
                color: d.isToday ? '#ffffff' : TEXT_PRIMARY,
                minHeight: '46px',
              }}
            >
              <span
                className="text-[7px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: d.isToday ? 'rgba(255,255,255,0.7)' : '#a8a49d' }}
              >
                {d.label}
              </span>
              <span className="text-[11px] font-semibold leading-none">{d.date}</span>
              <div className="flex items-center gap-[2px] h-1">
                {d.eventCount === 0 ? (
                  <div
                    className="w-[2px] h-[2px] rounded-full"
                    style={{ backgroundColor: 'rgba(15,15,15,0.15)' }}
                  />
                ) : (
                  Array.from({ length: Math.min(d.eventCount, 3) }).map((_, j) => (
                    <div
                      key={j}
                      className="w-[3px] h-[3px] rounded-full"
                      style={{
                        backgroundColor: d.isToday ? '#ffffff' : ['#6366f1', '#10b981', '#f59e0b'][j],
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="h-px mb-2" style={{ backgroundColor: 'rgba(15,15,15,0.05)' }} />

        {/* Event list */}
        <div className="space-y-1 overflow-hidden flex-1">
          {eventRows.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <div className="w-9 text-center flex-shrink-0">
                <div
                  className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: '#a8a49d' }}
                >
                  {e.day}
                </div>
                <div
                  className="text-[13px] font-semibold leading-none mt-0.5"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {e.date}
                </div>
              </div>
              <div
                className="w-0.5 h-8 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: e.color }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold truncate"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
                >
                  {e.title}
                </p>
                <p className="text-[10px] truncate" style={{ color: '#6a6864' }}>
                  {e.time} · {e.loc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MockLeoRail() {
  return (
    <div className="p-4 flex flex-col" style={{ borderLeft: `1px solid ${BORDER_SOFT}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: AI_GRADIENT }}
          >
            <Sparkles className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: TEXT_PRIMARY }}>
            Leo
          </span>
        </div>
        <div
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
          style={{ background: AI_GRADIENT }}
        >
          AI
        </div>
      </div>

      <div className="flex-1 space-y-2.5 text-[11px]">
        <div
          className="rounded-xl rounded-tr-sm p-2.5 self-end ml-6"
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${BORDER_SOFT}`,
            color: TEXT_PRIMARY,
          }}
        >
          Who is scheduled to set up A/V for the board meeting Thursday?
        </div>
        <div
          className="rounded-xl rounded-tl-sm p-2.5 mr-6"
          style={{ backgroundColor: '#f5f3ef', color: TEXT_PRIMARY, lineHeight: 1.5 }}
        >
          <strong>Marcus Williams</strong> from A/V Production is assigned.
          Setup is scheduled 5:30p in the Board Room — one wireless mic,
          screen share from the lectern laptop.
        </div>
        <div
          className="rounded-xl rounded-tr-sm p-2.5 self-end ml-6"
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${BORDER_SOFT}`,
            color: TEXT_PRIMARY,
          }}
        >
          Any open work orders for that room?
        </div>
        <div
          className="rounded-xl rounded-tl-sm p-2.5 mr-6"
          style={{ backgroundColor: '#f5f3ef', color: TEXT_PRIMARY, lineHeight: 1.5 }}
        >
          One open — projector bulb replacement, marked high priority.
          Assigned to facilities, due by Wednesday 3p.
        </div>
      </div>

      <div
        className="mt-3 px-3 py-2 rounded-full text-[10px]"
        style={{ border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
      >
        Ask Leo about events, tickets, rosters…
      </div>
    </div>
  )
}

export function MockEventDetailCard() {
  return (
    <div
      className="rounded-3xl p-7"
      style={{
        backgroundColor: SURFACE_WARM,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: '#6366f1' }}
          >
            APR 14 · 6:00P – 8:00P
          </p>
          <h3
            className="text-[22px] font-semibold mt-1"
            style={{ color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
          >
            Spring Concert
          </h3>
          <p className="text-[13px] mt-1" style={{ color: TEXT_SECONDARY }}>
            Auditorium · 400 seats · public
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}
        >
          <Check className="w-3 h-3" strokeWidth={3} />
          Approved
        </span>
      </div>

      <div className="h-px my-5" style={{ backgroundColor: BORDER_SOFT }} />

      {/* Approval chain */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: TEXT_MUTED }}>
        Approval chain
      </p>
      <div className="space-y-2">
        {[
          { name: 'Facilities Review', who: 'Derek K.', status: 'approved' },
          { name: 'A/V Resource Check', who: 'Marcus W.', status: 'approved' },
          { name: 'Principal Approval', who: 'Sarah L.', status: 'approved' },
        ].map((step) => (
          <div
            key={step.name}
            className="flex items-center justify-between py-2 px-3 rounded-lg"
            style={{ backgroundColor: 'rgba(15,15,15,0.02)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#10b981' }}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                  {step.name}
                </div>
                <div className="text-[10px]" style={{ color: TEXT_MUTED }}>
                  by {step.who}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold" style={{ color: '#047857' }}>
              APPROVED
            </span>
          </div>
        ))}
      </div>

      <div className="h-px my-5" style={{ backgroundColor: BORDER_SOFT }} />

      {/* Resource tags */}
      <div className="flex flex-wrap gap-1.5">
        {['2 wireless mics', '1 projector', 'Risers (×4)', 'Programs printed', 'Parking attendants'].map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: 'rgba(15,15,15,0.04)',
              color: TEXT_PRIMARY,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MockMaintenanceCard() {
  return (
    <div
      className="rounded-3xl p-7"
      style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15,15,15,0.04)' }}
          >
            <Wrench className="w-5 h-5" style={{ color: TEXT_PRIMARY }} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
              WORK ORDER · #1042
            </div>
            <div className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
              Boiler #2 annual inspection
            </div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#b45309' }}
        >
          In progress
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-3 py-4 border-y"
        style={{ borderColor: BORDER_SOFT }}
      >
        {[
          { label: 'Assigned', value: 'Derek K.' },
          { label: 'Due', value: 'Apr 12' },
          { label: 'Labor', value: '2.5h' },
        ].map((stat) => (
          <div key={stat.label}>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: TEXT_MUTED }}
            >
              {stat.label}
            </div>
            <div
              className="text-[14px] font-semibold mt-0.5"
              style={{ color: TEXT_PRIMARY }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Linked asset */}
      <div className="mt-5">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: TEXT_MUTED }}
        >
          LINKED ASSET
        </div>
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ backgroundColor: SURFACE_ALT }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold"
            style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER_SOFT}`, color: TEXT_PRIMARY }}
          >
            QR
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>
              Peerless PFH-850 · Boiler #2
            </div>
            <div className="text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Mechanical Room · Basement · installed 2018
            </div>
          </div>
        </div>
      </div>

      {/* Next PM schedule */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
          Next scheduled PM: <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>Oct 15 · filter replacement</span>
        </div>
      </div>
    </div>
  )
}
