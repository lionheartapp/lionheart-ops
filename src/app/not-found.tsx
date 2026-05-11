import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-slate-200">404</p>
        <h1 className="text-xl font-semibold text-slate-900 mt-4">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
