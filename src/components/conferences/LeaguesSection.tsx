'use client'

import { Globe, Shield, Trophy, Users } from 'lucide-react'

const LEAGUE_FEATURES = [
  { icon: Users, label: 'Member Schools', description: 'Invite schools and track conference membership.' },
  { icon: Trophy, label: 'Shared Schedules', description: 'Coordinate games, results, and standings across schools.' },
  { icon: Shield, label: 'Private Data', description: 'Share conference-level details while keeping rosters private.' },
]

export default function LeaguesSection() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-slate-950">Leagues</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Conference tools are wired into the data model and invite flow. This panel keeps the athletics tab stable while league management screens are filled in.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {LEAGUE_FEATURES.map(({ icon: Icon, label, description }) => (
          <div key={label} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <Icon className="mb-3 h-5 w-5 text-slate-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
            <p className="mt-1 text-sm leading-5 text-stone-600">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
