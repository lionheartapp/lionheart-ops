/**
 * Public event layout — white-label, no Lionheart chrome.
 *
 * This layout renders ONLY the organization's branding.
 * No sidebar, no dashboard header, no Lionheart logo.
 * Used for public event landing and registration pages.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Script from 'next/script'
import { rawPrisma } from '@/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPublicLayoutData(orgSlug: string, eventSlug: string) {
  const form = await rawPrisma.registrationForm.findUnique({
    where: { shareSlug: eventSlug },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          theme: true,
          slug: true,
        },
      },
      eventProject: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!form) {
    // Fallback: try to find org by slug directly
    const org = await rawPrisma.organization.findUnique({
      where: { slug: orgSlug },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        theme: true,
        slug: true,
      },
    })
    return { org, eventTitle: null }
  }

  // Verify the org slug matches the form's organization
  if (form.organization.slug !== orgSlug) {
    return { org: null, eventTitle: null }
  }

  return {
    org: form.organization,
    eventTitle: form.eventProject?.title ?? null,
  }
}

function extractPrimaryColor(theme: unknown): string {
  if (!theme || typeof theme !== 'string') return '#6366f1'
  try {
    const parsed = JSON.parse(theme) as Record<string, unknown>
    if (typeof parsed.primaryColor === 'string') return parsed.primaryColor
  } catch {
    // Not JSON — ignore
  }
  return '#6366f1'
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>
}): Promise<Metadata> {
  const { orgSlug, eventSlug } = await params
  const { org, eventTitle } = await getPublicLayoutData(orgSlug, eventSlug)

  if (!org) {
    return { title: 'Event Registration' }
  }

  const title = eventTitle ? `${eventTitle} | ${org.name}` : org.name
  return { title }
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default async function PublicEventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string; eventSlug: string }>
}) {
  const { orgSlug, eventSlug } = await params
  const { org } = await getPublicLayoutData(orgSlug, eventSlug)

  const primaryColor = org ? extractPrimaryColor(org.theme) : '#6366f1'
  const orgName = org?.name ?? 'School'
  const logoUrl = org?.logoUrl ?? null

  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        {/* Cloudflare Turnstile */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />

        {/* Top nav — org branding only */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${orgName} logo`}
                width={40}
                height={40}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold select-none"
                style={{ backgroundColor: primaryColor }}
              >
                {orgName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900">{orgName}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer — org attribution, NOT Lionheart */}
        <footer className="border-t border-gray-100 mt-12 py-6">
          <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
            Powered by {orgName}
          </div>
        </footer>
      </body>
    </html>
  )
}
