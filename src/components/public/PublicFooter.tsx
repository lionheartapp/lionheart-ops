'use client'

import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <img src="/logo-white.svg" alt="Lionheart" className="h-8 w-auto mb-4" />
            <p className="text-sm leading-relaxed">School operations platform built by educators.</p>
          </div>
          <nav>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm" role="list">
              <li>
                <a
                  href="/#features"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  Features
                </a>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </nav>
          <nav>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm" role="list">
              <li>
                <Link
                  href="/about"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/about#contact"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
          <nav>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm" role="list">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition"
                >
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-slate-800 pt-8 text-center text-sm">
          <p>&copy; 2026 Lionheart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
