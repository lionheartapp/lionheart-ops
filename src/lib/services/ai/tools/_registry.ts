/**
 * AI Assistant — Tool Registry (Central Hub)
 *
 * All domain tool modules self-register via `registerTools()`.
 * The chat route uses `getAvailableTools()`, `executeTool()`, and
 * `getToolRiskTier()` to drive the conversation loop.
 *
 * Risk tiers control confirmation behavior:
 *  - GREEN  → no confirmation, result fed back to LLM
 *  - YELLOW → executes immediately, no confirmation card (e.g. claim ticket, add comment)
 *  - ORANGE → current confirmation card (creates, status updates)
 *  - RED    → confirmation card with red warning (deletes, role changes)
 */

import { can } from '@/lib/auth/permissions'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskTier = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

/** Gemini-compatible function declaration */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolContext {
  userId: string
  organizationId: string
}

export interface ToolRegistryEntry {
  definition: GeminiFunctionDeclaration
  requiredPermission: string | null // null = no permission needed
  riskTier: RiskTier
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

// ─── Registry Store ──────────────────────────────────────────────────────────

const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {}

/**
 * Register one or more tools from a domain module.
 * Called at module load time by each `*.tools.ts` file.
 */
export function registerTools(tools: Record<string, ToolRegistryEntry>): void {
  for (const [name, entry] of Object.entries(tools)) {
    if (TOOL_REGISTRY[name]) {
      console.warn(`[tool-registry] Duplicate tool name: ${name} — overwriting`)
    }
    TOOL_REGISTRY[name] = entry
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get tool definitions filtered by user permissions.
 */
export async function getAvailableTools(
  userId: string
): Promise<GeminiFunctionDeclaration[]> {
  const tools: GeminiFunctionDeclaration[] = []

  for (const entry of Object.values(TOOL_REGISTRY)) {
    if (!entry.requiredPermission || (await can(userId, entry.requiredPermission))) {
      tools.push(entry.definition)
    }
  }

  return tools
}

/**
 * Execute a tool by name with permission enforcement.
 * Returns a JSON string result (or error message).
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const entry = TOOL_REGISTRY[toolName]
  if (!entry) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  // Permission check
  if (entry.requiredPermission) {
    const allowed = await can(ctx.userId, entry.requiredPermission)
    if (!allowed) {
      return JSON.stringify({
        error: `You don't have permission to use this feature. Required: ${entry.requiredPermission}`,
      })
    }
  }

  try {
    return await entry.execute(input, ctx)
  } catch (error) {
    console.error(`[ai-assistant] Tool "${toolName}" error:`, error)
    return JSON.stringify({
      error: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}

/**
 * Get the risk tier of a tool (used by chat route to decide confirmation behavior).
 */
export function getToolRiskTier(toolName: string): RiskTier | null {
  return TOOL_REGISTRY[toolName]?.riskTier ?? null
}

/**
 * Get all tool names currently registered (for system prompt).
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY)
}
