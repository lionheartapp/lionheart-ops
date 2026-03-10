/**
 * IT AI Diagnostic Service
 *
 * Uses Anthropic Claude (when configured) to provide intelligent diagnostics:
 * - Ticket analysis: categorization, severity, troubleshooting steps
 * - Device health scoring: based on repair history and ticket patterns
 *
 * Falls back to rule-based heuristics when ANTHROPIC_API_KEY is not set.
 *
 * Migrated from Google Gemini to Anthropic Claude.
 */

import { prisma } from '@/lib/db'
import { claudeTextCompletion, extractJson, getClaudeClient } from '@/lib/services/ai/claude-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  steps: string[]
  estimatedTime: string
  confidence: number
}

export interface DeviceDiagnosticResult {
  healthScore: number
  issues: string[]
  recommendations: string[]
}

// ─── Diagnose Ticket ──────────────────────────────────────────────────────────

export async function diagnoseTicket(ticketId: string): Promise<DiagnosticResult> {
  const ticket = await prisma.iTTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      description: true,
      issueType: true,
      avSubType: true,
      priority: true,
      device: { select: { assetTag: true, deviceType: true, make: true, model: true } },
    },
  })
  if (!ticket) throw new Error('Ticket not found')

  // Check if Claude API is available
  if (!getClaudeClient()) {
    return {
      category: ticket.issueType || 'General',
      severity: ticket.priority === 'URGENT' ? 'critical' : ticket.priority === 'HIGH' ? 'high' : 'medium',
      steps: [
        'Review the ticket description for details',
        'Check if the device has known issues',
        'Contact the user for more information',
        'Attempt standard troubleshooting steps',
      ],
      estimatedTime: '30-60 minutes',
      confidence: 0.3,
    }
  }

  // Enhanced AV diagnostic prompts by sub-type
  const avPromptEnhancements: Record<string, string> = {
    PROJECTOR: `\nAV Sub-type: Projector\nCommon resolutions (75% success rate): Check HDMI/VGA cable connection, verify input source selection, replace projector lamp if dim/flickering, check remote control batteries, verify laptop display output settings (Win+P or System Preferences > Displays).`,
    DISPLAY: `\nAV Sub-type: TV/Display\nCommon resolutions (70% success rate): Check power cable and outlet, verify HDMI input source, try different HDMI port, factory reset display settings, check for firmware updates.`,
    SOUNDBOARD: `\nAV Sub-type: Audio System\nCommon resolutions (65% success rate): Check mute switch on amplifier, verify audio cable connections, test with different audio source, check volume levels at each stage (source > mixer > amplifier > speakers), check speaker wire connections.`,
    APPLE_TV: `\nAV Sub-type: Apple TV / Streaming Device\nCommon resolutions (80% success rate): Restart Apple TV (Settings > System > Restart), check HDMI connection, verify Wi-Fi connection, re-pair remote (hold Menu + Volume Up 5 seconds), check AirPlay settings.`,
    OTHER_AV: `\nAV Sub-type: Other A/V Equipment\nGeneral A/V troubleshooting: Check all cable connections, verify power to all components, test each component individually, check signal path from source to output.`,
  }

  try {
    const avEnhancement = ticket.issueType === 'DISPLAY_AV' && ticket.avSubType ? (avPromptEnhancements[ticket.avSubType] || '') : ''

    const prompt = `You are an IT help desk diagnostic assistant. Analyze this IT support ticket and provide a JSON response.

Ticket: "${ticket.title}"
Description: "${ticket.description || 'No description provided'}"
Issue Type: ${ticket.issueType || 'Unknown'}
Device: ${ticket.device ? `${ticket.device.make} ${ticket.device.model} (${ticket.device.deviceType})` : 'Not specified'}${avEnhancement}

Respond with ONLY valid JSON (no markdown):
{
  "category": "string - specific IT category (e.g., 'Hardware - Screen', 'Software - OS', 'Network')",
  "severity": "low|medium|high|critical",
  "steps": ["array of 3-6 troubleshooting steps"],
  "estimatedTime": "string like '15-30 minutes'",
  "confidence": 0.0-1.0
}`

    const result = await claudeTextCompletion(prompt)
    if (result) {
      const parsed = extractJson<DiagnosticResult>(result)
      if (parsed) return parsed
    }
  } catch (e) {
    console.error('AI diagnostic failed:', e)
  }

  return {
    category: ticket.issueType || 'General',
    severity: 'medium',
    steps: ['Review ticket details', 'Check device history', 'Standard troubleshooting'],
    estimatedTime: '30 minutes',
    confidence: 0.2,
  }
}

// ─── Diagnose Device ──────────────────────────────────────────────────────────

export async function diagnoseDevice(deviceId: string): Promise<DeviceDiagnosticResult> {
  const device = await prisma.iTDevice.findUnique({
    where: { id: deviceId },
    include: {
      repairs: { orderBy: { repairDate: 'desc' }, take: 10 },
      tickets: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, issueType: true, status: true },
      },
    },
  })
  if (!device) throw new Error('Device not found')

  if (!getClaudeClient()) {
    const repairCount = device.repairs.length
    const healthScore = Math.max(20, 100 - repairCount * 15)
    return {
      healthScore,
      issues: device.isLemon ? ['Device flagged as lemon - frequent repairs'] : repairCount > 0 ? ['Has repair history'] : [],
      recommendations: repairCount >= 3
        ? ['Consider device replacement', 'Review repair cost vs replacement cost']
        : ['Continue monitoring', 'Schedule preventive maintenance'],
    }
  }

  try {
    const repairHistory = device.repairs.map((r) => `${r.repairType || 'Unknown'}: ${r.description || 'No details'} (Cost: $${r.repairCost})`).join('\n')

    const prompt = `You are an IT device health analyst. Analyze this device's history and provide a JSON response.

Device: ${device.make} ${device.model} (${device.deviceType})
Asset Tag: ${device.assetTag}
Status: ${device.status}
Is Lemon: ${device.isLemon}
Purchase Date: ${device.purchaseDate || 'Unknown'}
Repair Count: ${device.repairs.length}
Repair History:
${repairHistory || 'No repairs recorded'}

Recent Tickets: ${device.tickets.map((t) => t.title).join(', ') || 'None'}

Respond with ONLY valid JSON (no markdown):
{
  "healthScore": 0-100,
  "issues": ["array of identified issues"],
  "recommendations": ["array of 2-4 recommendations"]
}`

    const result = await claudeTextCompletion(prompt)
    if (result) {
      const parsed = extractJson<DeviceDiagnosticResult>(result)
      if (parsed) return parsed
    }
  } catch (e) {
    console.error('AI device diagnostic failed:', e)
  }

  return {
    healthScore: device.isLemon ? 30 : 70,
    issues: device.isLemon ? ['Flagged as lemon'] : [],
    recommendations: ['Schedule review', 'Monitor performance'],
  }
}
