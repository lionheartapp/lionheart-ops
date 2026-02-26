import { headers } from 'next/headers'
import { organizationService } from '@/lib/services'
import LoginForm from './LoginForm'
import { ImagePosition } from '@prisma/client'

export default async function LoginPage() {
  // Get subdomain from middleware header
  const headersList = await headers()
  const subdomain = headersList.get('x-org-subdomain')
  
  // Fetch organization branding (default to Linfield if no subdomain)
  const slug = subdomain || 'linfield'
  const branding = await organizationService.getOrganizationBranding(slug)

  if (!branding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 to-zinc-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Organization Not Found</h1>
          <p className="mt-2 text-zinc-400">The subdomain &quot;{slug}&quot; is not configured.</p>
        </div>
      </div>
    )
  }

  const isImageRight = branding.imagePosition === ImagePosition.RIGHT

  return (
    <div className="flex min-h-screen">
      {/* Hero Image Section */}
      <div
        className={`hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 relative overflow-hidden ${
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
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/50 to-transparent" />
            {branding.logoUrl && (
              <div className="absolute bottom-12 left-12">
                <img
                  src={branding.logoUrl}
                  alt={`${branding.name} logo`}
                  className="h-20 w-auto drop-shadow-2xl"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center px-12">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={`${branding.name} logo`}
                className="h-24 w-auto mx-auto mb-8 drop-shadow-2xl"
              />
            )}
            <h1 className="text-5xl font-bold text-white mb-4">{branding.name}</h1>
            <p className="text-xl text-zinc-400">Operations Platform</p>
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
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={`${branding.name} logo`}
                className="h-16 w-auto mx-auto mb-4"
              />
            )}
            <h1 className="text-2xl font-bold text-zinc-900">{branding.name}</h1>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900">Welcome back</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Sign in to access your {branding.name} operations dashboard
              </p>
            </div>

            <LoginForm
              organizationId={branding.id}
              organizationName={branding.name}
              organizationLogoUrl={branding.logoUrl || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
