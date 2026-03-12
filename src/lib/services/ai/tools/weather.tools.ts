/**
 * AI Assistant — Weather Domain Tools
 * Moved from assistant-tools.ts: get_weather_forecast
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { rawPrisma } from '@/lib/db'
import { fetchWeatherForecast } from '@/lib/services/weatherService'

const tools: Record<string, ToolRegistryEntry> = {
  get_weather_forecast: {
    definition: {
      name: 'get_weather_forecast',
      description: 'Get weather forecast for a specific date. Uses the organization\'s location.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Target date in YYYY-MM-DD format. Must be within 16 days from today.' },
        },
        required: ['date'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const targetDate = String(input.date || '')
      if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return JSON.stringify({ error: 'Please provide a date in YYYY-MM-DD format.' })
      }

      const org = await rawPrisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { latitude: true, longitude: true, name: true },
      })
      if (!org?.latitude || !org?.longitude) {
        return JSON.stringify({ error: `Location data is not configured for ${org?.name || 'your organization'}.` })
      }

      const forecast = await fetchWeatherForecast(org.latitude, org.longitude, targetDate)
      if (!forecast) {
        return JSON.stringify({ error: `Could not fetch weather data for ${targetDate}.` })
      }

      return JSON.stringify({
        date: forecast.date, location: org.name,
        high: `${forecast.tempMax}F`, low: `${forecast.tempMin}F`,
        condition: forecast.condition, precipitationChance: `${forecast.precipitationChance}%`,
        message: `${forecast.condition} on ${forecast.date} -- High ${forecast.tempMax}F, Low ${forecast.tempMin}F, ${forecast.precipitationChance}% chance of precipitation.`,
      })
    },
  },
}

registerTools(tools)
