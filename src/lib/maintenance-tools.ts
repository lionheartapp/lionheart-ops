export type RepairDecision = 'REPAIR' | 'REPLACE' | 'REVIEW'

export function getRepairDecision(input: {
  repairCost: number
  replacementCost: number
  repeatAttempts: number
  ageYears: number
  expectedLifeYears: number
  downtimeDays: number
}): { decision: RepairDecision; ratio: number | null; reasons: string[] } {
  const { repairCost, replacementCost, repeatAttempts, ageYears, expectedLifeYears, downtimeDays } = input
  const reasons: string[] = []
  const ratio = replacementCost > 0 ? repairCost / replacementCost : null

  if (ratio !== null && ratio >= 0.5) reasons.push('Repair is at least half the replacement cost.')
  if (repeatAttempts >= 3) reasons.push('There have been three or more repair attempts.')
  if (expectedLifeYears > 0 && ageYears >= expectedLifeYears * 0.8) reasons.push('The asset is near the end of expected life.')
  if (downtimeDays >= 5) reasons.push('Downtime is becoming operationally disruptive.')

  if (reasons.length >= 2) return { decision: 'REPLACE', ratio, reasons }
  if (reasons.length === 1) return { decision: 'REVIEW', ratio, reasons }
  return { decision: 'REPAIR', ratio, reasons: ['Repair still appears reasonable from the entered numbers.'] }
}

export function estimatePaintGallons(input: {
  squareFeet: number
  coats: number
  coveragePerGallon: number
  wastePct: number
}): number | null {
  const { squareFeet, coats, coveragePerGallon, wastePct } = input
  if (squareFeet <= 0 || coats <= 0 || coveragePerGallon <= 0 || wastePct < 0) return null
  return (squareFeet * coats * (1 + wastePct / 100)) / coveragePerGallon
}

export function estimateFlooringSquareFeet(input: {
  lengthFt: number
  widthFt: number
  wastePct: number
}): number | null {
  const { lengthFt, widthFt, wastePct } = input
  if (lengthFt <= 0 || widthFt <= 0 || wastePct < 0) return null
  return lengthFt * widthFt * (1 + wastePct / 100)
}

export function estimateFixtureCost(input: {
  quantity: number
  unitCost: number
  contingencyPct: number
}): number | null {
  const { quantity, unitCost, contingencyPct } = input
  if (quantity <= 0 || unitCost < 0 || contingencyPct < 0) return null
  return quantity * unitCost * (1 + contingencyPct / 100)
}
