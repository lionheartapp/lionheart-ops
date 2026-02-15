import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 199,
    priceAnnual: 159,
    description: 'Perfect for small private schools.',
    features: ['Maintenance & IT Tickets', 'Basic Calendar', 'Up to 300 students'],
    buttonLabel: 'Start Free Trial',
    href: '/signup?plan=starter'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 499,
    priceAnnual: 399,
    description: 'The standard for K-12 operations.',
    features: ['Water Management Module', 'Inventory Tracking', 'Smart Event AI (Unlimited)', 'Visual Repair Assistant', 'Up to 1,000 students'],
    isPopular: true,
    buttonLabel: 'Start Free Trial',
    href: '/signup?plan=pro'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    description: 'For multi-site districts & large campuses.',
    features: ['Visual Campus (3D Matterport)', 'Monthly AI Budget Reports', 'Unlimited AI Usage', 'Dedicated Support Manager', 'Unlimited students'],
    buttonLabel: 'Contact Sales',
    href: 'mailto:sales@lionheart.app'
  }
]

function PricingSection() {
  const [billingCycle, setBillingCycle] = useState('annual') // Default to annual for higher ACV

  return (
    <section className="w-full max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
          <Check className="w-3 h-3" />
          14-Day Free Trial &bull; No Credit Card Required
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Simple, transparent pricing
        </h2>
        <p className="text-zinc-400 max-w-xl mx-auto">
          Site licenses based on feature needs. Start free and upgrade when you&apos;re ready.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center mt-8 gap-3">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-zinc-500'}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle((c) => (c === 'monthly' ? 'annual' : 'monthly'))}
            className="relative w-14 h-8 rounded-full bg-zinc-800 border border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-emerald-500 transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-medium flex items-center gap-2 ${billingCycle === 'annual' ? 'text-white' : 'text-zinc-500'}`}>
            Yearly
            <span className="text-[10px] font-bold text-emerald-900 bg-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {PRICING_PLANS.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual
          const isCustom = price === null

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-8 rounded-2xl border transition-all ${
                plan.isPopular
                  ? 'bg-zinc-900/80 border-emerald-500/50 shadow-2xl shadow-emerald-900/20 z-10 scale-105 md:scale-110'
                  : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="text-sm text-zinc-400 mt-2 min-h-[40px]">{plan.description}</p>
              </div>

              <div className="mb-8">
                {!isCustom ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${price}</span>
                    <span className="text-zinc-500">/mo</span>
                  </div>
                ) : (
                  <div className="text-4xl font-bold text-white">Custom</div>
                )}
                {!isCustom && billingCycle === 'annual' && (
                   <p className="text-xs text-emerald-400 mt-2 font-medium">
                     Billed ${price * 12} yearly
                   </p>
                )}
              </div>

              <div className="space-y-4 mb-8 flex-1">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.isPopular ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {plan.href.startsWith('http') || plan.href.startsWith('mailto') ? (
                <a
                  href={plan.href}
                  className={`w-full py-3 rounded-xl text-center text-sm font-semibold transition-colors ${
                    plan.isPopular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                >
                  {plan.buttonLabel}
                </a>
              ) : (
                <Link
                  to={plan.href}
                  className={`w-full py-3 rounded-xl text-center text-sm font-semibold transition-colors block ${
                    plan.isPopular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                >
                  {plan.buttonLabel}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Lionheart</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link to="/signup" className="px-4 py-2 bg-white text-zinc-950 rounded-lg font-semibold text-sm hover:bg-zinc-200 transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center px-6 pt-24 pb-12 text-center">
        <div className="max-w-3xl space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
            School operations.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Simplified.
            </span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Events, facilities, IT tickets, and maintenance&mdash;all in one place.
            Built for schools that need to move fast without the paperwork.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              to="/signup"
              className="px-8 py-4 rounded-xl bg-white text-zinc-950 font-bold text-lg hover:bg-zinc-200 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-lg hover:bg-zinc-800 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-zinc-950 border-t border-zinc-900/50">
        <PricingSection />
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 text-center">
        <div className="flex items-center justify-center gap-6 mb-8 text-sm text-zinc-500 font-medium">
           <p>Event Requests</p>
           <p>Facilities &amp; IT</p>
           <p>360&deg; Campus</p>
           <p>Multi-tenant</p>
        </div>
        <p className="text-zinc-600 text-sm">
          &copy; {new Date().getFullYear()} Lionheart Operations. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
