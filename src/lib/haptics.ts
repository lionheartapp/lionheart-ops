/**
 * Haptic feedback utility for mobile.
 * Uses navigator.vibrate() where available (Android Chrome).
 * No-ops gracefully on iOS Safari (not supported) and desktop.
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [30, 10, 30],
  success: [10, 30, 10],
  error: [50, 30, 50],
}

export function haptic(pattern: HapticPattern): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patterns[pattern])
    } catch {
      // Silently ignore — vibrate may throw in restricted contexts
    }
  }
}
