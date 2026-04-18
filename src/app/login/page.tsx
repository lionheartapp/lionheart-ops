import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { organizationService } from '@/lib/services'
import LoginForm from './LoginForm'
import SchoolLookup from './SchoolLookup'
import { ImagePosition } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Sign In | Lionheart',
}

export default async function LoginPage() {
  // Get subdomain from middleware header (set by middleware from the host)
  const headersList = await headers()
  const subdomain = headersList.get('x-org-subdomain')

  // No subdomain — show school lookup screen
  if (!subdomain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-4">
        <div className="w-full max-w-sm text-center">
          <img src="/logo-white.svg" alt="Lionheart" className="h-12 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-2">Lionheart Platform</h1>
          {/* Audit ref L1: slate-400 on slate-900 was washed-out (AA-barely);
              slate-200 reads as body copy, not disabled text. */}
          <p className="text-slate-200 mb-8 leading-relaxed">
            Enter your school&apos;s URL to sign in.
          </p>
          <SchoolLookup />
        </div>
      </div>
    )
  }

  const branding = await organizationService.getOrganizationBranding(subdomain)

  if (!branding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Organization Not Found</h1>
          <p className="mt-2 text-slate-200">
            No school is configured at &quot;{subdomain}.lionheartapp.com&quot;.
          </p>
        </div>
      </div>
    )
  }

  const isImageRight = branding.imagePosition === ImagePosition.RIGHT

  return (
    <div className="flex min-h-screen">
      {/* Hero Image Section */}
      <div
        className={`hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 relative overflow-hidden ${
          isImageRight ? 'order-2' : 'order-1'
        }`}
      >
        {branding.heroImageUrl ? (
          <div className="relative w-full h-full">
            <img
              src={branding.heroImageUrl}
              alt={`${branding.name} campus`}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent" />
            <div className="absolute bottom-12 left-12">
              <img
                src="/logo-white.svg"
                alt="Lionheart"
                className="h-10 w-auto drop-shadow-2xl opacity-80"
              />
            </div>
          </div>
        ) : (
          <div className="text-center px-12">
            <h1 className="text-5xl font-bold text-white mb-4">{branding.name}</h1>
            <p className="text-xl text-slate-300 mb-12">Operations Platform</p>
            <img
              src="/logo-white.svg"
              alt="Lionheart"
              className="h-10 w-auto mx-auto opacity-60"
            />
          </div>
        )}
      </div>

      {/* Login Form Section */}
      <div
        className={`flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8 ${
          isImageRight ? 'order-1' : 'order-2'
        }`}
      >
        <div className="w-full max-w-md">
          {/* School Logo */}
          <div className="text-center mb-8">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={`${branding.name} logo`}
                className="h-16 w-auto mx-auto"
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900">{branding.name}</h1>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to access your {branding.name} operations dashboard
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginForm
                organizationId={branding.id}
                organizationName={branding.name}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
