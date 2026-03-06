'use client'

import { motion, MotionConfig } from 'framer-motion'
import { ChevronRight, CheckCircle2, Zap, Clock, Users } from 'lucide-react'
import Link from 'next/link'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

const featureCard = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

export default function Landing() {
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
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded px-2 py-1" aria-label="Lionheart - home">
            <img src="/logo.svg" alt="Lionheart" className="h-10 w-auto" />
          </a>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="text-center space-y-6 sm:space-y-8 relative z-10">
            <motion.h1
              custom={0}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight"
            >
              School Operations
              <br />
              <span className="text-primary-600">Shouldn't Be a Headache</span>
            </motion.h1>

            <motion.p
              custom={1}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
            >
              Simple IT and maintenance request management for modern schools. Stop managing requests in email and spreadsheets.
            </motion.p>

            <motion.div
              custom={2}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
            >
              <Link
                href="/signup"
                className="ui-btn-lg ui-btn-accent rounded-xl flex items-center justify-center gap-2"
                aria-label="Get started - start free trial"
              >
                Get Started Today <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </Link>
              <Link
                href="/signin"
                className="ui-btn-lg ui-btn-outline rounded-xl"
                aria-label="Sign in to existing account"
              >
                Sign In
              </Link>
            </motion.div>
          </div>

          {/* Decorative gradient orbs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary-100/30 rounded-full blur-3xl pointer-events-none" />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 border-y border-gray-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-4"
          >
            Built for Schools. By School Operators.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 text-center max-w-xl mx-auto mb-12 sm:mb-16"
          >
            Everything you need to keep your school running smoothly, in one platform.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
          >
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={idx}
                  variants={featureCard}
                  className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 hover:border-primary-200 hover:-translate-y-1 hover:shadow-medium transition-all duration-300 group"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary-200 transition-colors">
                    <Icon className="w-6 h-6 text-primary-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{feature.description}</p>
                </motion.article>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
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
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-sm sm:text-base text-gray-700">{benefit}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Frosted glass showcase card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
              {/* Decorative background circles */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

              <h3 className="sr-only">Example request workflow</h3>
              <div className="space-y-4 relative z-10">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-xs sm:text-sm text-primary-200 mb-1 font-medium">Request Submitted</p>
                  <p className="text-base sm:text-lg font-semibold text-white">Broken projector in Room 201</p>
                  <p className="text-xs text-primary-300 mt-1">Today at 2:30 PM</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-xs sm:text-sm text-primary-200 mb-1 font-medium">Status Update</p>
                  <p className="text-base sm:text-lg font-semibold text-white">Assigned to IT</p>
                  <p className="text-xs text-primary-300 mt-1">In Progress</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-400/30">
                  <p className="text-xs sm:text-sm text-emerald-300 font-medium mb-1" role="status">Resolved</p>
                  <p className="text-base sm:text-lg font-semibold text-white">Projector replaced</p>
                  <p className="text-xs text-primary-300 mt-1">Today at 3:15 PM</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative bg-primary-600 py-16 sm:py-20 overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4"
          >
            Ready to simplify your school's operations?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-primary-100 text-base sm:text-lg mb-8"
          >
            Join schools already using Lionheart to manage their IT and maintenance requests.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link
              href="/signup"
              className="px-6 sm:px-8 py-4 min-h-[48px] bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600 transition inline-flex items-center justify-center gap-2"
              aria-label="Get started free - create account"
            >
              Get Started Free <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <img src="/logo-white.svg" alt="Lionheart" className="h-8 w-auto mb-4" />
              <p className="text-sm leading-relaxed">School operations platform built by educators.</p>
            </div>
            <nav>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">Features</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">Pricing</a></li>
              </ul>
            </nav>
            <nav>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">About</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">Contact</a></li>
              </ul>
            </nav>
            <nav>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm" role="list">
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-2 py-1 inline-block transition">Terms</a></li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Lionheart. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  )
}
