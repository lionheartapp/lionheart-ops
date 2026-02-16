/**
 * Pond thresholds per aquaculture & reptile care guidelines
 * Ideal / Warning / Danger zones for pH, Temp, DO, Turbidity, Alkalinity
 */

// --- Safety Thresholds (Prompt 1) ---
export const PH_SAFE_MIN = 6.5
export const PH_SAFE_MAX = 8.5
export const PH_IDEAL_MIN = 7.0
export const PH_IDEAL_MAX = 8.0
export const PH_DANGER_ACID = 5.5   // Acidosis
export const PH_DANGER_ALK = 9.5   // Alkalosis

export const TEMP_IDEAL_MIN_F = 65
export const TEMP_IDEAL_MAX_F = 78
export const TEMP_WARN_MIN_F = 50
export const TEMP_WARN_MAX_F = 85
export const TEMP_DANGER_F = 90   // High stress for Koi

export const DO_MIN = 5.0          // ppm - aeration trigger
export const DO_IDEAL_MIN = 6.0
export const DO_IDEAL_MAX = 9.0
export const DO_DANGER = 3.0       // Immediate fish kill risk

export const TURBIDITY_IDEAL_MAX = 10  // NTU
export const TURBIDITY_WARN = 25       // Cloudy
export const TURBIDITY_DANGER = 50     // Photosynthesis inhibited

export const ALKALINITY_MIN = 50       // ppm - below this: no Copper Sulfate
export const ALKALINITY_IDEAL_MIN = 90
export const ALKALINITY_IDEAL_MAX = 120
export const ALKALINITY_DANGER = 20    // High copper toxicity risk

export const POND_SAFEZONE = {
  pHMin: PH_SAFE_MIN,
  pHMax: PH_SAFE_MAX,
  turbidityMax: TURBIDITY_WARN,
  tempMin: 10,  // °C
  tempMax: 29,  // °C
}

export const POND_DEFAULT_VOLUME_GALLONS = 5000

/** Copper Sulfate: oz per 1000 gal per 0.1 ppm Cu */
export const COPPER_SULFATE_FACTOR = 0.24

/** Aquatic dye: oz per 1000 gal */
export const DYE_FACTOR_OZ_PER_1000_GAL = 0.5

/** Turtle sensitivity: max 0.2 ppm Copper regardless of calculated dose */
export const COPPER_MAX_PPM_TURTLES = 0.2

export type PondReading = {
  pH: number
  turbidity: number
  temperature: number
  dissolvedOxygen?: number
  alkalinity?: number
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string; severity: 'warning' | 'danger' }

/**
 * Safety Filter: If Alkalinity < 50 ppm, Copper Sulfate is DISABLED.
 * "Copper is highly toxic in soft water."
 */
export function validateWaterSafety(readings: {
  alkalinity?: number
  treatment?: string
}): ValidationResult {
  const alk = readings.alkalinity
  const treatment = (readings.treatment || '').toLowerCase()

  if (treatment !== 'copper' && treatment !== 'copper_sulfate') {
    return { ok: true }
  }

  if (alk == null || alk === undefined) {
    return {
      ok: false,
      error: 'Alkalinity required for Copper Sulfate. Enter ppm from a test kit. Below 50 ppm = do not use Copper.',
      severity: 'warning',
    }
  }

  if (alk < ALKALINITY_DANGER) {
    return {
      ok: false,
      error: 'Hazardous Condition: Alkalinity too low for Copper treatment. Do not apply chemicals. Use aquatic dye or aeration instead.',
      severity: 'danger',
    }
  }

  if (alk < ALKALINITY_MIN) {
    return {
      ok: false,
      error: 'Hazardous Condition: Alkalinity too low for Copper treatment. Do not apply chemicals.',
      severity: 'danger',
    }
  }

  return { ok: true }
}

/**
 * Max Safe Copper ppm = Total Alkalinity / 100
 */
export function getMaxSafeCopperPpm(alkalinityPpm: number): number {
  return Math.max(0, alkalinityPpm / 100)
}

/**
 * Copper dose (oz) - capped by Alkalinity/100 and optionally by turtle limit (0.2 ppm)
 */
export function calcCopperSulfateOz(
  volumeGallons: number,
  desiredPpm: number,
  alkalinityPpm?: number,
  hasTurtles?: boolean
): number {
  let ppm = desiredPpm

  if (hasTurtles) {
    ppm = Math.min(ppm, COPPER_MAX_PPM_TURTLES)
  }

  if (alkalinityPpm != null) {
    const maxPpm = getMaxSafeCopperPpm(alkalinityPpm)
    ppm = Math.min(ppm, maxPpm)
  }

  return (volumeGallons / 1000) * ppm * COPPER_SULFATE_FACTOR
}

export function calcDyeOz(volumeGallons: number): number {
  return (volumeGallons / 1000) * DYE_FACTOR_OZ_PER_1000_GAL
}

// --- Pool Chemistry (Chlorine / Acid) ---
/** Liquid chlorine (12.5%): oz per 10,000 gal to raise 1 ppm */
export const CHLORINE_OZ_PER_10K_GAL_PER_PPM = 10
/** Muriatic acid (31.45%): oz per 10,000 gal to lower pH by ~0.1 */
export const ACID_OZ_PER_10K_GAL_PER_0_1_PH = 10

/** Chlorine dose (oz liquid chlorine 12.5%) to raise from current to target ppm */
export function calcChlorineOz(
  volumeGallons: number,
  currentPpm: number,
  targetPpm: number
): number {
  const delta = Math.max(0, targetPpm - currentPpm)
  return (volumeGallons / 10000) * delta * CHLORINE_OZ_PER_10K_GAL_PER_PPM
}

/** Muriatic acid (oz) to lower pH by delta (e.g. 0.2 = two tenths) */
export function calcAcidOz(volumeGallons: number, pHDrop: number): number {
  return (volumeGallons / 10000) * (pHDrop * 10) * ACID_OZ_PER_10K_GAL_PER_0_1_PH
}

export function isInSafeZone(reading: PondReading, zone = POND_SAFEZONE): boolean {
  return (
    reading.pH >= zone.pHMin &&
    reading.pH <= zone.pHMax &&
    reading.turbidity <= zone.turbidityMax &&
    reading.temperature >= zone.tempMin &&
    reading.temperature <= zone.tempMax
  )
}

export function getOutOfRangeAlerts(reading: PondReading, zone = POND_SAFEZONE): string[] {
  const alerts: string[] = []
  if (reading.pH < zone.pHMin) alerts.push(`pH too low (${reading.pH} < ${zone.pHMin})`)
  if (reading.pH > zone.pHMax) alerts.push(`pH too high (${reading.pH} > ${zone.pHMax})`)
  if (reading.turbidity > zone.turbidityMax)
    alerts.push(`Turbidity high (${reading.turbidity} NTU > ${zone.turbidityMax})`)
  if (reading.temperature < zone.tempMin)
    alerts.push(`Temp too cold (${reading.temperature}°C < ${zone.tempMin})`)
  if (reading.temperature > zone.tempMax)
    alerts.push(`Temp too hot (${reading.temperature}°C > ${zone.tempMax})`)
  if (reading.dissolvedOxygen != null && reading.dissolvedOxygen < DO_MIN)
    alerts.push(`Dissolved oxygen low (${reading.dissolvedOxygen} ppm < ${DO_MIN})`)
  if (reading.alkalinity != null && reading.alkalinity < ALKALINITY_MIN)
    alerts.push(`Alkalinity low (${reading.alkalinity} ppm < ${ALKALINITY_MIN})`)
  return alerts
}

/** °F to °C */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9
}
