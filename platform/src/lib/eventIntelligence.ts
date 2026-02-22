/**
 * Event-to-Inventory Intelligence Handler
 * Coordinates automatic ticket creation, HVAC overrides, and setup suggestions
 * based on event details, inventory, and teacher schedules.
 */

import { prisma, prismaBase } from '../../lib/prisma'

export interface EventIntelligenceResult {
  hvacOverride?: { ticketId: string; reason: string }
  lowStockAlert?: { ticketId: string; shortages: string[] }
  setupSuggestion?: { prepWindow: string; prepTeacher: string; reason: string }
}

/**
 * Check if event is after 4 PM and create HVAC Override ticket if needed.
 * Buildings that cut power (Elementary/High) triggers warning.
 */
export async function checkHVACOverride(
  eventId: string,
  date: string,
  startTime: string,
  endTime: string,
  roomId: string,
  organizationId: string,
  buildingDivision?: string
): Promise<{ ticketId: string; reason: string } | null> {
  try {
    const [hours] = startTime.split(':').map(Number)
    const endHours = (endTime ? endTime.split(':')[0] : '18').split(':').map(Number)[0]

    // HVAC typically cuts at 4 PM (16:00); event needs override if extends past school hours
    const needsOverride = endHours >= 16 && (buildingDivision === 'ELEMENTARY' || buildingDivision === 'HIGH')
    if (!needsOverride) return null

    const ticket = await prisma.ticket.create({
      data: {
        organizationId,
        title: `HVAC Override — Event "${date}" in ${buildingDivision || 'Building'}`,
        description: `Event from ${startTime} to ${endTime || '18:00'} requires HVAC override. Building cuts power after 4 PM.`,
        category: 'MAINTENANCE',
        priority: 'NORMAL',
        roomId,
        safetyProtocolChecklist: ['Verify HVAC is enabled', 'Check thermostat before event', 'Confirm power is restored after event'],
      },
    })

    return { ticketId: ticket.id, reason: 'Event extends past standard 4 PM building shutdown' }
  } catch (err) {
    console.error('checkHVACOverride error:', err)
    return null
  }
}

/**
 * Calculate inventory usage as percentage and create Low Stock alert if > 80%.
 */
export async function checkInventoryStock(
  organizationId: string,
  requested: Array<{ itemId: string; quantity: number }>,
  eventDate: string,
  eventName: string,
  roomId?: string
): Promise<{ ticketId: string; shortages: string[] } | null> {
  try {
    if (!requested || requested.length === 0) return null

    const shortages: string[] = []
    let totalUsage = 0
    let totalCapacity = 0

    for (const { itemId, quantity } of requested) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        include: { stock: true },
      })

      if (!item) continue

      const totalStock = item.stock.reduce((sum, s) => sum + s.quantity, 0)
      const usagePercent = (quantity / totalStock) * 100

      if (usagePercent >= 80) {
        shortages.push(`${item.name}: requesting ${quantity} of ${totalStock} (${usagePercent.toFixed(0)}%)`)
      }

      totalUsage += quantity
      totalCapacity += totalStock
    }

    if (shortages.length === 0) return null

    const ticket = await prisma.ticket.create({
      data: {
        organizationId,
        title: `Low Stock Warning — Event "${eventName}" on ${eventDate}`,
        description: `Inventory usage exceeds 80% for this event:\n${shortages.join('\n')}\n\nTotal usage: ${totalUsage}/${totalCapacity} items`,
        category: 'MAINTENANCE',
        priority: 'HIGH',
        roomId,
      },
    })

    return { ticketId: ticket.id, shortages }
  } catch (err) {
    console.error('checkInventoryStock error:', err)
    return null
  }
}

/**
 * Find best setup window by analyzing teacher schedule prep periods.
 * Returns next available gap of 30+ minutes during school hours (8 AM - 4 PM).
 */
export async function suggestSetupWindow(
  roomId: string,
  eventDate: string
): Promise<{ prepWindow: string; prepTeacher: string; reason: string } | null> {
  try {
    // Parse date to get day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const dateObj = new Date(eventDate)
    const dayOfWeek = dateObj.getDay() // JS getDay: 0=Sunday

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend — full day available
      return {
        prepWindow: '8:00 AM - 4:00 PM',
        prepTeacher: 'Weekend (all staff available)',
        reason: 'No teacher schedule conflicts on weekends',
      }
    }

    // Fetch all schedules for this room on this day
    const schedules = await prisma.teacherSchedule.findMany({
      where: { roomId, dayOfWeek },
      include: { user: { select: { name: true } } },
    })

    // Sort by startTime to identify gaps
    const sorted = schedules.sort((a, b) => a.startTime.localeCompare(b.startTime))

    // School hours: 8 AM (08:00) to 4 PM (16:00)
    const schoolStart = '08:00'
    const schoolEnd = '16:00'
    const minimumGap = 30 // minutes

    const gaps: Array<{ start: string; end: string; duration: number }> = []

    // Check gap before first class
    if (sorted.length > 0) {
      const firstStart = sorted[0].startTime
      const gapMinutes = timeToMinutes(firstStart) - timeToMinutes(schoolStart)
      if (gapMinutes >= minimumGap) {
        gaps.push({
          start: schoolStart,
          end: firstStart,
          duration: gapMinutes,
        })
      }
    } else {
      // No classes all day
      gaps.push({
        start: schoolStart,
        end: schoolEnd,
        duration: 8 * 60,
      })
    }

    // Check gaps between classes (prep periods / passing time)
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStart = sorted[i].endTime
      const gapEnd = sorted[i + 1].startTime
      const gapMinutes = timeToMinutes(gapEnd) - timeToMinutes(gapStart)

      if (gapMinutes >= minimumGap) {
        gaps.push({
          start: gapStart,
          end: gapEnd,
          duration: gapMinutes,
        })
      }
    }

    // Check gap after last class
    if (sorted.length > 0) {
      const lastEnd = sorted[sorted.length - 1].endTime
      const gapMinutes = timeToMinutes(schoolEnd) - timeToMinutes(lastEnd)
      if (gapMinutes >= minimumGap) {
        gaps.push({
          start: lastEnd,
          end: schoolEnd,
          duration: gapMinutes,
        })
      }
    }

    if (gaps.length === 0) {
      return {
        prepWindow: '7:00 AM (before school)',
        prepTeacher: 'Early arrival required',
        reason: 'No available gaps during school hours; setup before 8 AM recommended',
      }
    }

    // Return the longest gap (best setup window)
    const bestGap = gaps.reduce((best, g) => (g.duration > best.duration ? g : best))

    return {
      prepWindow: `${bestGap.start} - ${bestGap.end} (${bestGap.duration} min)`,
      prepTeacher: 'Optimal setup window identified from teacher prep periods',
      reason: `Window represents gap(s) in classroom schedule; setup staff won't conflict with classes`,
    }
  } catch (err) {
    console.error('suggestSetupWindow error:', err)
    return null
  }
}

/**
 * Orchestrate all intelligence checks when event is saved.
 */
export async function analyzeEventIntelligence(
  event: {
    id: string
    date: string
    startTime: string
    endTime?: string
    roomId?: string
    name: string
    facilitiesRequested?: Array<{ item: string; quantity: number }> | null
    techRequested?: Array<{ item: string; quantity: number }> | null
    tablesRequested?: number
    chairsRequested?: number
  },
  organizationId: string,
  buildingDivision?: string
): Promise<EventIntelligenceResult> {
  const result: EventIntelligenceResult = {}

  // 1. HVAC Override check
  if (event.roomId) {
    const hvac = await checkHVACOverride(
      event.id,
      event.date,
      event.startTime,
      event.endTime || '18:00',
      event.roomId,
      organizationId,
      buildingDivision
    )
    if (hvac) result.hvacOverride = hvac
  }

  // 2. Inventory Low Stock check
  const requested = [
    ...(event.facilitiesRequested || []).map((f) => ({ itemId: f.item, quantity: f.quantity })),
    ...(event.techRequested || []).map((t) => ({ itemId: t.item, quantity: t.quantity })),
  ]
  if (requested.length > 0) {
    const stock = await checkInventoryStock(organizationId, requested, event.date, event.name, event.roomId)
    if (stock) result.lowStockAlert = stock
  }

  // 3. Setup Suggestion from prep windows
  if (event.roomId) {
    const suggestion = await suggestSetupWindow(event.roomId, event.date)
    if (suggestion) result.setupSuggestion = suggestion
  }

  return result
}

/**
 * Helper: Convert HH:MM to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Helper: Convert minutes since midnight to HH:MM.
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
