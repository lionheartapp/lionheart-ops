import { describe, it, expect } from 'vitest'
import {
  B,
  wrapLayout,
  heroHeading,
  centeredCta,
  contentSection,
  detailCard,
  heroImage,
} from '@/lib/email/email-layout'

// ── Brand Tokens ──────────────────────────────────────────────────────────────

describe('B (brand tokens)', () => {
  it('has expected primary brand colors', () => {
    expect(B.blue).toBe('#1d4ed8')
    expect(B.white).toBe('#ffffff')
    expect(B.dark).toBe('#111827')
  })

  it('has no undefined values', () => {
    for (const [key, value] of Object.entries(B)) {
      expect(value, `B.${key}`).toBeTruthy()
    }
  })
})

// ── wrapLayout ────────────────────────────────────────────────────────────────

describe('wrapLayout', () => {
  it('wraps content in MJML document', () => {
    const result = wrapLayout({ previewText: 'Preview', content: '<mj-text>Hello</mj-text>' })
    expect(result).toContain('<mjml>')
    expect(result).toContain('</mjml>')
    expect(result).toContain('Hello')
  })

  it('includes preview text', () => {
    const result = wrapLayout({ previewText: 'Check this out', content: '' })
    expect(result).toContain('<mj-preview>Check this out</mj-preview>')
  })

  it('includes Lionheart logo', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).toContain('logo-color.png')
    expect(result).toContain('Lionheart')
  })

  it('includes footer with copyright', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).toContain('{{currentYear}}')
    expect(result).toContain('Lionheart Educational Operations')
  })

  it('includes blue band when provided', () => {
    const result = wrapLayout({
      previewText: '',
      content: '',
      blueBand: { text: 'Try it now', ctaLabel: 'Get Started', ctaUrl: 'https://example.com' },
    })
    expect(result).toContain('Try it now')
    expect(result).toContain('Get Started')
    expect(result).toContain('https://example.com')
  })

  it('omits blue band CTA button when ctaLabel is absent', () => {
    const result = wrapLayout({
      previewText: '',
      content: '',
      blueBand: { text: 'Info only' },
    })
    expect(result).toContain('Info only')
    expect(result).not.toContain('mj-button href=')
  })

  it('omits blue band section entirely when not provided', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).not.toContain('Blue band section')
  })
})

// ── heroHeading ───────────────────────────────────────────────────────────────

describe('heroHeading', () => {
  it('renders subtitle and headline', () => {
    const result = heroHeading('WELCOME', 'Hello World')
    expect(result).toContain('WELCOME')
    expect(result).toContain('Hello World')
  })

  it('uses heading CSS class', () => {
    const result = heroHeading('SUB', 'HEAD')
    expect(result).toContain('heading')
    expect(result).toContain('subheading')
  })
})

// ── centeredCta ───────────────────────────────────────────────────────────────

describe('centeredCta', () => {
  it('renders button with label and URL', () => {
    const result = centeredCta('Click Me', 'https://example.com')
    expect(result).toContain('Click Me')
    expect(result).toContain('href="https://example.com"')
  })

  it('uses default blue color', () => {
    const result = centeredCta('Go', 'https://go.com')
    expect(result).toContain(B.blue)
  })

  it('accepts custom color', () => {
    const result = centeredCta('Go', 'https://go.com', '#ff0000')
    expect(result).toContain('#ff0000')
  })
})

// ── contentSection ────────────────────────────────────────────────────────────

describe('contentSection', () => {
  it('wraps HTML in mj-section', () => {
    const result = contentSection('<mj-text>Content here</mj-text>')
    expect(result).toContain('Content here')
    expect(result).toContain('mj-section')
  })

  it('uses default padding', () => {
    const result = contentSection('<mj-text>X</mj-text>')
    expect(result).toContain('24px 40px')
  })

  it('accepts custom padding', () => {
    const result = contentSection('<mj-text>X</mj-text>', '10px 20px')
    expect(result).toContain('10px 20px')
  })
})

// ── detailCard ────────────────────────────────────────────────────────────────

describe('detailCard', () => {
  it('renders content in a styled div', () => {
    const result = detailCard('Order #123')
    expect(result).toContain('Order #123')
    expect(result).toContain('border-radius: 12px')
  })

  it('uses default blueLight background', () => {
    const result = detailCard('Test')
    expect(result).toContain(B.blueLight)
  })

  it('accepts custom colors', () => {
    const result = detailCard('Test', '#f0f0f0', '#333333')
    expect(result).toContain('#f0f0f0')
    expect(result).toContain('#333333')
  })
})

// ── heroImage ─────────────────────────────────────────────────────────────────

describe('heroImage', () => {
  it('renders mj-image with src and alt', () => {
    const result = heroImage('https://img.com/hero.jpg', 'Hero image')
    expect(result).toContain('src="https://img.com/hero.jpg"')
    expect(result).toContain('alt="Hero image"')
  })
})
