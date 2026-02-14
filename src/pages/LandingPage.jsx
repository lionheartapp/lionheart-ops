import { Link } from 'react-router-dom'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
          School operations.
          <br />
          <span className="text-emerald-400">Simplified.</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
          Events, facilities, IT tickets, and maintenance—all in one place. Built for schools that need to move fast without the paperwork.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/signup"
            className="px-8 py-4 rounded-xl bg-emerald-500 text-white font-semibold text-lg hover:bg-emerald-600 transition-colors"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="px-8 py-4 rounded-xl border border-zinc-600 text-zinc-300 font-semibold text-lg hover:bg-zinc-800 transition-colors"
          >
            Sign in
          </Link>
          <a
            href={`${PLATFORM_URL}/campus`}
            className="px-8 py-4 rounded-xl border border-zinc-600 text-zinc-300 font-semibold text-lg hover:bg-zinc-800 transition-colors"
          >
            View campus demo
          </a>
        </div>
        <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-zinc-500">
          <div>
            <p className="text-zinc-400 font-medium mb-1">Event requests</p>
            <p>AI-parsed, conflict-checked</p>
          </div>
          <div>
            <p className="text-zinc-400 font-medium mb-1">Facilities & IT</p>
            <p>Tickets, inventory, workflows</p>
          </div>
          <div>
            <p className="text-zinc-400 font-medium mb-1">360° Campus</p>
            <p>Matterport tours, room pins</p>
          </div>
          <div>
            <p className="text-zinc-400 font-medium mb-1">Multi-tenant</p>
            <p>Your data, isolated</p>
          </div>
        </div>
      </div>
    </div>
  )
}
