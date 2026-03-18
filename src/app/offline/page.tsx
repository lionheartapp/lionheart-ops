import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-start justify-center px-4">
      <div className="ui-glass max-w-md w-full mt-32 p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-indigo-400" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 mb-3">
          You&apos;re Offline
        </h1>

        <p className="text-slate-500 mb-8 leading-relaxed">
          This page isn&apos;t available offline. Head to Maintenance to see your cached tickets and create new ones.
        </p>

        <Link
          href="/maintenance"
          className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors duration-200 cursor-pointer"
        >
          Go to Maintenance
        </Link>
      </div>
    </div>
  )
}
