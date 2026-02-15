import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Calendar, ShieldCheck, Map, ArrowRight, Check } from 'lucide-react'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'

export default function LandingPage() {
  const [heroImgError, setHeroImgError] = useState(false)
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-primary-900">Lionheart</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600">
          <a href="#features" className="hover:text-primary-600">Features</a>
          <a href="#pricing" className="hover:text-primary-600">Pricing</a>
          <Link to="/login" className="hover:text-primary-600">Sign in</Link>
          <Link to="/signup" className="px-4 py-2 bg-primary-900 text-white rounded-full hover:bg-primary-800 transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      <main>
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered School Operations
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-primary-950 leading-[1.1] tracking-tight">
              Operational excellence for <span className="text-primary-600">modern schools.</span>
            </h1>
            <p className="text-xl text-zinc-600 leading-relaxed max-w-xl">
              Unify events, facilities, IT, and maintenance in a single, proactive platform. Built for institutions that prioritize efficiency over paperwork.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup" className="px-8 py-4 rounded-xl bg-primary-600 text-white font-bold text-lg hover:bg-primary-700 transition-all shadow-xl shadow-primary-200 flex items-center justify-center gap-2">
                Start for Free <ArrowRight className="w-5 h-5" />
              </Link>
              <a href={`${PLATFORM_URL}/campus`} target="_blank" rel="noreferrer" className="px-8 py-4 rounded-xl border-2 border-zinc-200 text-zinc-700 font-bold text-lg hover:bg-zinc-50 transition-all flex items-center justify-center gap-2">
                View Campus Demo
              </a>
            </div>
          </div>

          {/* AI Interface Preview */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary-500/20 to-violet-500/20 blur-3xl rounded-full opacity-50" />
            <div className="relative bg-white/80 backdrop-blur-xl border border-zinc-200/60 rounded-2xl overflow-hidden bg-zinc-100/50 p-2 shadow-2xl">
              <div className="relative w-full h-[400px] rounded-xl overflow-hidden bg-zinc-200">
                {heroImgError ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                    <div className="text-center text-primary-700">
                      <Sparkles className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">AI-Powered Operations</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src="/stock-images/image4-b32b7720-e993-4df4-a31a-d52335f42928.png"
                    alt="Students and staff"
                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                    onError={() => setHeroImgError(true)}
                  />
                )}
              </div>
              <div className="absolute bottom-6 left-6 right-6 bg-white/80 backdrop-blur-xl p-4 rounded-xl border border-white/20 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Smart Event Assistant</p>
                    <p className="text-xs text-zinc-600">&quot;Scheduling the Gym for Friday. Detecting no conflicts.&quot;</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section id="features" className="py-24 bg-zinc-50/50 border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold text-primary-950">One platform. Every department.</h2>
            <p className="text-zinc-500 max-w-2xl mx-auto">Built to replace legacy silos with a single source of truth for your entire campus.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Calendar, title: 'Proactive Events', desc: 'AI-parsed requests with automatic inventory and spatial conflict detection.' },
              { icon: ShieldCheck, title: 'Facilities & IT', desc: 'Tiered ticketing with safety-mode overlays and man-hour tracking.' },
              { icon: Map, title: '360° Campus Map', desc: 'Interactive Matterport tours with deep-linked room pins and schedules.' },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white border border-zinc-200 hover:shadow-xl transition-all group">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-6 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-3">{f.title}</h3>
                <p className="text-zinc-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold">
              <Check className="w-4 h-4" />
              14-Day Free Trial • No Credit Card Required
            </div>
            <h2 className="text-3xl font-bold text-primary-950">Simple, transparent pricing</h2>
            <p className="text-zinc-500 max-w-2xl mx-auto">
              Site licenses based on student enrollment. Start free and upgrade when you&apos;re ready.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: 199, priceLabel: '$199/mo', students: 'Up to 300 students', features: ['Maintenance & IT Tickets', 'Basic Calendar', 'Basic User Management'], cta: 'Start Free Trial', href: '/signup' },
              { name: 'Pro', price: 499, priceLabel: '$499/mo', students: 'Up to 1,000 students', features: ['Water Management', 'Inventory Tracking', 'Smart Event AI', 'Visual Repair Assistant'], cta: 'Start Free Trial', href: '/signup', highlight: true },
              { name: 'Enterprise', price: null, priceLabel: 'Custom', students: 'Unlimited', features: ['Visual Campus (3D Matterport)', 'Monthly AI Budget Reports', 'Unlimited AI Usage', 'Dedicated Support'], cta: 'Contact Sales', href: 'mailto:sales@lionheart.app' },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 p-8 flex flex-col ${plan.highlight ? 'border-primary-500 bg-primary-50/30 shadow-xl shadow-primary-200/30' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-600 text-white text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-zinc-900 mb-1">{plan.name}</h3>
                <p className="text-3xl font-extrabold text-primary-900 mb-1">{plan.priceLabel}</p>
                <p className="text-sm text-zinc-500 mb-6">{plan.students}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith('/') ? (
                  <Link
                    to={plan.href}
                    className={`block text-center py-3 px-6 rounded-xl font-bold transition-all ${plan.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <a
                    href={plan.href}
                    className={`block text-center py-3 px-6 rounded-xl font-bold transition-all ${plan.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>
    </div>
  )
}
