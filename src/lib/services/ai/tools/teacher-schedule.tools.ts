/**
 * AI Assistant — Teacher Schedule Domain Tools
 *
 * Read-only tools for checking teacher schedules and finding free periods.
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { prisma } from '@/lib/db'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: Check Teacher Schedule ───────────────────────────────────────
  check_teacher_schedule: {
    definition: {
      name: 'check_teacher_schedule',
      description:
        'Look up a teacher\'s class schedule by name and optional day of week. Two-pass lookup: first by teacherName field, then by linked User name. Use when someone asks "when does Mrs. Johnson teach?" or "is Mr. Smith in class on Monday?"',
      parameters: {
        type: 'object',
        properties: {
          teacher_name: { type: 'string', description: 'Teacher\'s name (e.g. "Mrs. Johnson", "Smith")' },
          day: { type: 'string', description: 'Day of week (e.g. "Monday", "Tuesday"). If omitted, returns all days.' },
        },
        required: ['teacher_name'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const name = String(input.teacher_name || '').trim()
      if (!name) return JSON.stringify({ error: 'teacher_name is required.' })

      const dayFilter = input.day ? String(input.day).trim() : ''
      const dayIndex = dayFilter ? DAY_NAMES.findIndex(d => d.toLowerCase() === dayFilter.toLowerCase()) : -1

      // Pass 1: search by teacherName field
      let schedules = await prisma.teacherSchedule.findMany({
        where: {
          teacherName: { contains: name, mode: 'insensitive' },
          ...(dayIndex >= 0 ? { dayOfWeek: dayIndex } : {}),
        },
        orderBy: [{ dayOfWeek: 'asc' }, { periodStart: 'asc' }],
      })

      // Pass 2: if no results, try matching via linked User name
      if (schedules.length === 0) {
        const user = await prisma.user.findFirst({
          where: { name: { contains: name, mode: 'insensitive' } },
          select: { id: true, name: true },
        })

        if (user) {
          schedules = await prisma.teacherSchedule.findMany({
            where: {
              teacherId: user.id,
              ...(dayIndex >= 0 ? { dayOfWeek: dayIndex } : {}),
            },
            orderBy: [{ dayOfWeek: 'asc' }, { periodStart: 'asc' }],
          })
        }
      }

      if (schedules.length === 0) {
        return JSON.stringify({
          error: `No schedule found for "${name}"${dayFilter ? ` on ${dayFilter}` : ''}. They may not have a schedule entered in the system.`,
        })
      }

      const teacherLabel = schedules[0].teacherName || name

      return JSON.stringify({
        teacher: teacherLabel,
        ...(dayFilter ? { day: dayFilter } : {}),
        periods: schedules.map((s: any) => ({
          day: DAY_NAMES[s.dayOfWeek] || `Day ${s.dayOfWeek}`,
          start: s.periodStart,
          end: s.periodEnd,
        })),
        count: schedules.length,
      })
    },
  },

  // ── GREEN: Find Teacher Free Periods ────────────────────────────────────
  find_teacher_free_periods: {
    definition: {
      name: 'find_teacher_free_periods',
      description:
        'Find free periods (gaps) in a teacher\'s schedule for a specific day. Assumes school day is 7:30 AM to 3:30 PM. Use when scheduling meetings with teachers or checking when they\'re available.',
      parameters: {
        type: 'object',
        properties: {
          teacher_name: { type: 'string', description: 'Teacher\'s name (e.g. "Mrs. Johnson")' },
          day: { type: 'string', description: 'Day of week (e.g. "Monday", "Tuesday")' },
        },
        required: ['teacher_name', 'day'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const name = String(input.teacher_name || '').trim()
      const dayStr = String(input.day || '').trim()
      if (!name || !dayStr) return JSON.stringify({ error: 'Both teacher_name and day are required.' })

      const dayIndex = DAY_NAMES.findIndex(d => d.toLowerCase() === dayStr.toLowerCase())
      if (dayIndex < 0) return JSON.stringify({ error: `Invalid day: "${dayStr}". Use Monday, Tuesday, etc.` })

      // Get schedule for that day (two-pass lookup)
      let schedules = await prisma.teacherSchedule.findMany({
        where: { teacherName: { contains: name, mode: 'insensitive' }, dayOfWeek: dayIndex },
        orderBy: { periodStart: 'asc' },
      })

      if (schedules.length === 0) {
        const user = await prisma.user.findFirst({
          where: { name: { contains: name, mode: 'insensitive' } },
          select: { id: true },
        })
        if (user) {
          schedules = await prisma.teacherSchedule.findMany({
            where: { teacherId: user.id, dayOfWeek: dayIndex },
            orderBy: { periodStart: 'asc' },
          })
        }
      }

      const SCHOOL_START = '07:30'
      const SCHOOL_END = '15:30'

      if (schedules.length === 0) {
        return JSON.stringify({
          teacher: name,
          day: DAY_NAMES[dayIndex],
          message: `No schedule entries found for ${name} on ${DAY_NAMES[dayIndex]}. They may be free all day or their schedule hasn't been entered.`,
          freePeriods: [{ start: SCHOOL_START, end: SCHOOL_END, label: 'Full school day' }],
          busyPeriods: [],
        })
      }

      const teacherLabel = schedules[0].teacherName || name

      // Build busy periods
      const busyPeriods = schedules.map((s: any) => ({
        start: s.periodStart,
        end: s.periodEnd,
      }))

      // Calculate free gaps
      const freePeriods: Array<{ start: string; end: string }> = []
      let cursor = SCHOOL_START

      for (const busy of busyPeriods) {
        if (busy.start > cursor) {
          freePeriods.push({ start: cursor, end: busy.start })
        }
        if (busy.end > cursor) cursor = busy.end
      }

      if (cursor < SCHOOL_END) {
        freePeriods.push({ start: cursor, end: SCHOOL_END })
      }

      return JSON.stringify({
        teacher: teacherLabel,
        day: DAY_NAMES[dayIndex],
        freePeriods,
        busyPeriods,
        freeCount: freePeriods.length,
        busyCount: busyPeriods.length,
        message: freePeriods.length > 0
          ? `${teacherLabel} has ${freePeriods.length} free period(s) on ${DAY_NAMES[dayIndex]}.`
          : `${teacherLabel} has no free periods on ${DAY_NAMES[dayIndex]} — their schedule is full.`,
      })
    },
  },
}

registerTools(tools)
