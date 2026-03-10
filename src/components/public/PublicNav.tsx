'use client'

import Link from 'next/link'

export default function PublicNav() {
  return (
    <nav className="border-b border-gray-200" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded px-2 py-1"
          aria-label="Lionheart - home"
        >
          <img src="/logo.svg" alt="Lionheart" className="h-10 w-auto" />
        </Link>
        <div className="flex gap-2 sm:gap-4">
          <Link
            href="/signin"
            className="ui-btn-md ui-btn-ghost rounded-lg"
            aria-label="Sign in to your account"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="ui-btn-md ui-btn-accent rounded-lg"
            aria-label="Get started - create a new school account"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
