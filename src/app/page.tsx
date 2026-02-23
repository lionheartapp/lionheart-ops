'use client'

import { useState } from 'react'
import { ChevronRight, CheckCircle2, Zap, Clock, Users } from 'lucide-react'
import SignupModal from './SignupModal'
import SigninModal from './SigninModal'

export default function Landing() {
  const [showSignup, setShowSignup] = useState(false)
  const [showSignin, setShowSignin] = useState(false)

  const features = [
    {
      icon: Zap,
      title: 'IT & Maintenance Requests',
      description: 'Simple, intuitive ticket system for your school\'s operational needs',
    },
    {
      icon: Clock,
      title: 'Real-Time Status Updates',
      description: 'Track request progress from submission to resolution instantly',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Assign tickets, comment, and communicate seamlessly across departments',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
          <a href="#" className="text-2xl font-bold text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1" aria-label="Lionheart - home">
            Lionheart
          </a>
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={() => setShowSignin(true)}
              className="px-4 sm:px-6 py-3 min-h-[44px] text-gray-700 font-medium hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded transition"
              aria-label="Sign in to your account"
            >
              Sign In
            </button>
            <button
              onClick={() => setShowSignup(true)}
              className="px-4 sm:px-6 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              aria-label="Get started - create a new school account"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center space-y-6 sm:space-y-8">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
            School Operations Shouldn't Be a Headache
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Simple IT and maintenance request management for modern schools. Stop managing requests in email and spreadsheets.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button
              onClick={() => setShowSignup(true)}
              className="px-6 sm:px-8 py-4 min-h-[44px] bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition flex items-center justify-center gap-2"
              aria-label="Get started - start free trial"
            >
              Get Started Today <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setShowSignin(true)}
              className="px-6 sm:px-8 py-4 min-h-[44px] border-2 border-gray-300 text-gray-900 font-semibold rounded-lg hover:border-gray-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              aria-label="Sign in to existing account"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 border-y border-gray-200 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8 sm:mb-12">
            Built for Schools. By School Operators.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <article
                  key={idx}
                  className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200 hover:border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 transition"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">{feature.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Why Schools Choose Lionheart
            </h2>
            <ul className="space-y-4" role="list">
              {[
                'Reduce response time to maintenance requests',
                'Eliminate email-based request tracking',
                'Increase cross-department visibility',
                'Give students and staff a voice',
                'Focus your IT team on real problems',
              ].map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-sm sm:text-base text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 sm:p-8 border border-blue-200">
            <h3 className="sr-only">Example request workflow</h3>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Request Submitted</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900">Broken projector in Room 201</p>
                <p className="text-xs text-gray-500 mt-1">Today at 2:30 PM</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Status Update</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900">Assigned to IT</p>
                <p className="text-xs text-gray-500 mt-1">In Progress</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-100">
                <p className="text-xs sm:text-sm text-green-600 font-medium mb-1" role="status">✓ Resolved</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900">Projector replaced</p>
                <p className="text-xs text-gray-500 mt-1">Today at 3:15 PM</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to simplify your school's operations?
          </h2>
          <p className="text-blue-100 text-base sm:text-lg mb-8">
            Join schools already using Lionheart to manage their IT and maintenance requests.
          </p>
          <button
            onClick={() => setShowSignup(true)}
            className="px-6 sm:px-8 py-4 min-h-[44px] bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition inline-flex items-center justify-center gap-2"
            aria-label="Get started free - create account"
          >
            Get Started Free <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Lionheart</h3>
              <p className="text-sm">School operations platform built by educators.</p>
            </div>
            <nav>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">Features</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">Pricing</a></li>
              </ul>
            </nav>
            <nav>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">About</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">Contact</a></li>
              </ul>
            </nav>
            <nav>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 inline-block transition">Terms</a></li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Lionheart. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
      {showSignin && <SigninModal onClose={() => setShowSignin(false)} />}
    </div>
  )
}
