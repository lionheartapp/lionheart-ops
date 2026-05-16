import { describe, it, expect } from 'vitest'
import {
  B,
  wrapLayout,
  heroHeading,
  centeredCta,
  contentSection,
  detailCard,
  heroImage,
  ledeText,
  microNote,
} from '@/lib/email/email-layout'

// ── Brand Tokens ──────────────────────────────────────────────────────────────

describe('B (brand tokens)', () => {
  it('exposes the new lionheartapp.com primary palette', () => {
    expect(B.nearBlack).toBe('#0f0f0f')
    expect(B.surface).toBe('#ffffff')
    expect(B.surfaceWarm).toBe('#fdfcfb')
    expect(B.textSec).toBe('#5a5a5a')
    expect(B.textMute).toBe('#9a9a9a')
  })

  it('preserves legacy tokens for back-compat', () => {
    expect(B.blue).toBe('#1d4ed8')
    expect(B.white).toBe('#ffffff')
    expect(B.dark).toBe('#0f0f0f')
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

  it('renders the Lionheart wordmark and fallback logo reference', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).toContain('Lionheart')
    // hidden PNG fallback for clients that need an <img>
    expect(result).toContain('logo-color.png')
  })

  it('includes footer with copyright and brand line', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).toContain('{{currentYear}}')
    expect(result).toContain('Lionheart Educational Operations')
  })

  it('renders the dark band when blueBand is provided', () => {
    const result = wrapLayout({
      previewText: '',
      content: '',
      blueBand: { text: 'Try it now', ctaLabel: 'Get Started', ctaUrl: 'https://example.com' },
    })
    expect(result).toContain('Try it now')
    expect(result).toContain('Get Started')
    expect(result).toContain('https://example.com')
    expect(result).toContain(B.nearBlack) // dark band uses near-black bg
  })

  it('omits CTA button when ctaLabel is absent', () => {
    const result = wrapLayout({ previewText: '', content: '', blueBand: { text: 'Info only' } })
    expect(result).toContain('Info only')
    expect(result).not.toContain('mj-button href=')
  })

  it('omits dark band entirely when blueBand is not provided', () => {
    const result = wrapLayout({ previewText: '', content: '' })
    expect(result).not.toContain('Dark band section')
  })
})

// ── heroHeading ───────────────────────────────────────────────────────────────

describe('heroHeading', () => {
  it('renders subtitle (eyebrow) and headline', () => {
    const result = heroHeading('Account ready', 'Welcome, Sarah.')
    expect(result).toContain('Account ready')
    expect(result).toContain('Welcome, Sarah.')
  })

  it('uses heading/subheading CSS classes', () => {
    const result = heroHeading('Eyebrow', 'Headline')
    expect(result).toContain('heading')
    expect(result).toContain('subheading')
  })

  it('renders headline near-black', () => {
    const result = heroHeading('x', 'y')
    expect(result).toContain(B.nearBlack)
  })
})

// ── centeredCta ───────────────────────────────────────────────────────────────

describe('centeredCta', () => {
  it('renders button with label and URL', () => {
    const result = centeredCta('Click Me', 'https://example.com')
    expect(result).toContain('Click Me')
    expect(result).toContain('href="https://example.com"')
  })

  it('defaults to near-black background', () => {
    const result = centeredCta('Go', 'https://go.com')
    expect(result).toContain(B.nearBlack)
  })

  it('accepts a custom color', () => {
    const result = centeredCta('Go', 'https://go.com', '#ff0000')
    expect(result).toContain('#ff0000')
  })

  it('uses 8px border radius', () => {
    const result = centeredCta('Go', 'https://go.com')
    expect(result).toContain('border-radius="8px"')
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

  it('uses the surfaceAlt background by default', () => {
    const result = detailCard('Test')
    expect(result).toContain(B.surfaceAlt)
  })

  it('accepts custom colors', () => {
    const result = detailCard('Test', '#f0f0f0', '#333333')
    expect(result).toContain('#f0f0f0')
    expect(result).toContain('#333333')
  })
})

// ── ledeText ──────────────────────────────────────────────────────────────────

describe('ledeText', () => {
  it('renders body copy in the secondary text color', () => {
    const result = ledeText('Hello there')
    expect(result).toContain('Hello there')
    expect(result).toContain(B.textSec)
  })
})

// ── microNote ─────────────────────────────────────────────────────────────────

describe('microNote', () => {
  it('renders microcopy in the muted text color', () => {
    const result = microNote('Fine print')
    expect(result).toContain('Fine print')
    expect(result).toContain(B.textMute)
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
