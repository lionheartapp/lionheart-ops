#!/usr/bin/env node

/**
 * Lionheart MCP Server
 *
 * Exposes Lionheart Operations Platform tools via the Model Context Protocol.
 * AI assistants (Claude, Leo, Cursor, etc.) can use these tools to:
 *
 * - Query calendars and check for event conflicts
 * - Find available rooms and buildings
 * - Browse event templates
 * - Check maintenance/facility status
 * - Look up staff, teams, and school info
 *
 * Usage:
 *   LIONHEART_API_URL=https://yourschool.lionheartapp.com \
 *   LIONHEART_API_KEY=your-key \
 *   node dist/index.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { calendarTools } from './tools/calendar.js'
import { campusTools } from './tools/campus.js'
import { maintenanceTools } from './tools/maintenance.js'

// ── Collect all tools ──────────────────────────────────────────────────────

type ToolDef = {
  description: string
  inputSchema: z.ZodType
  execute: (input: any) => Promise<any>
}

const ALL_TOOLS: Record<string, ToolDef> = {
  ...calendarTools,
  ...campusTools,
  ...maintenanceTools,
}

// ── Convert Zod schemas to JSON Schema for MCP ─────────────────────────────

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Simple Zod → JSON Schema converter for common types
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      const isOptional = value instanceof z.ZodOptional || value instanceof z.ZodDefault
      const inner = isOptional
        ? (value as any)._def.innerType || value
        : value

      properties[key] = zodTypeToJsonSchema(inner)

      // Add description if available
      const desc = (value as any)._def?.description || (inner as any)?._def?.description
      if (desc) (properties[key] as any).description = desc

      if (!isOptional) required.push(key)
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    }
  }

  return { type: 'object', properties: {} }
}

function zodTypeToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodString) return { type: 'string' }
  if (schema instanceof z.ZodNumber) return { type: 'number' }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' }
  if (schema instanceof z.ZodArray) return { type: 'array', items: zodTypeToJsonSchema((schema as any)._def.type) }
  if (schema instanceof z.ZodOptional) return zodTypeToJsonSchema((schema as any)._def.innerType)
  if (schema instanceof z.ZodDefault) return zodTypeToJsonSchema((schema as any)._def.innerType)
  return { type: 'string' }
}

// ── MCP Server Setup ───────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'lionheart-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// ── List Tools Handler ─────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = Object.entries(ALL_TOOLS).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: zodToJsonSchema(def.inputSchema) as Tool['inputSchema'],
  }))

  return { tools }
})

// ── Call Tool Handler ──────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const tool = ALL_TOOLS[name]

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  }

  try {
    // Validate input
    const validatedInput = tool.inputSchema.parse(args || {})
    const result = await tool.execute(validatedInput)

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ── Start Server ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Lionheart MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
