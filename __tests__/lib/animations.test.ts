import { describe, it, expect } from 'vitest'
import {
  EASE_OUT_CUBIC,
  EASE_SPRING,
  fadeInUp,
  fadeIn,
  scaleIn,
  staggerContainer,
  listItem,
  cardEntrance,
  tabContent,
  dropdownVariants,
  pageTransition,
  badgePop,
  toastSlideIn,
  expandCollapse,
  buttonTap,
  buttonHover,
  quickTransition,
  normalTransition,
  slowTransition,
} from '@/lib/animations'

describe('easing constants', () => {
  it('EASE_OUT_CUBIC is a 4-element cubic bezier', () => {
    expect(EASE_OUT_CUBIC).toHaveLength(4)
    expect(EASE_OUT_CUBIC).toEqual([0.25, 0.1, 0.25, 1])
  })

  it('EASE_SPRING has type, stiffness, and damping', () => {
    expect(EASE_SPRING.type).toBe('spring')
    expect(EASE_SPRING.stiffness).toBeGreaterThan(0)
    expect(EASE_SPRING.damping).toBeGreaterThan(0)
  })
})

describe('animation variants structure', () => {
  it('fadeInUp has hidden and visible states', () => {
    expect(fadeInUp).toHaveProperty('hidden')
    expect(fadeInUp).toHaveProperty('visible')
    expect(fadeInUp.hidden).toHaveProperty('opacity', 0)
  })

  it('fadeIn has hidden and visible states', () => {
    expect(fadeIn.hidden).toHaveProperty('opacity', 0)
    expect(fadeIn.visible).toHaveProperty('opacity', 1)
  })

  it('scaleIn starts smaller and scales to 1', () => {
    expect(scaleIn.hidden).toHaveProperty('scale', 0.95)
    expect(scaleIn.visible).toHaveProperty('scale', 1)
  })

  it('tabContent has exit state', () => {
    expect(tabContent).toHaveProperty('exit')
  })

  it('dropdownVariants has exit state', () => {
    expect(dropdownVariants).toHaveProperty('exit')
  })

  it('expandCollapse has collapsed and expanded states', () => {
    expect(expandCollapse).toHaveProperty('collapsed')
    expect(expandCollapse).toHaveProperty('expanded')
  })
})

describe('staggerContainer', () => {
  it('returns variants with staggerChildren in visible transition', () => {
    const variants = staggerContainer(0.1, 0.2)
    const visible = variants.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, number>
    expect(transition.staggerChildren).toBe(0.1)
    expect(transition.delayChildren).toBe(0.2)
  })

  it('uses defaults when no args provided', () => {
    const variants = staggerContainer()
    const visible = variants.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, number>
    expect(transition.staggerChildren).toBe(0.05)
    expect(transition.delayChildren).toBe(0)
  })
})

describe('transition presets', () => {
  it('quickTransition is fastest', () => {
    expect(quickTransition.duration).toBeLessThan(normalTransition.duration as number)
  })

  it('slowTransition is slowest', () => {
    expect(slowTransition.duration).toBeGreaterThan(normalTransition.duration as number)
  })
})

describe('button micro-interactions', () => {
  it('buttonTap scales down', () => {
    expect(buttonTap.scale).toBeLessThan(1)
  })

  it('buttonHover scales up', () => {
    expect(buttonHover.scale).toBeGreaterThan(1)
  })
})
