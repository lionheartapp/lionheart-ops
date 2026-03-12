/**
 * AI Assistant — Workflow Planning Tool
 *
 * Allows Leo to plan multi-step operations that the user can approve
 * and execute as a batch.
 */

import { registerTools, type ToolRegistryEntry } from './_registry'

const tools: Record<string, ToolRegistryEntry> = {
  plan_workflow: {
    definition: {
      name: 'plan_workflow',
      description:
        'Plan a multi-step workflow when the user requests an operation that requires 3+ sequential actions. Returns a workflow plan card for user approval before execution. Example: "Create a ticket, assign to Tom, and mark it urgent" = 3 steps.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the workflow (e.g. "Create and assign urgent ticket")' },
          steps: {
            type: 'string',
            description: 'JSON array of step objects, each with: { "tool": "tool_name", "description": "human-readable description", "input": { ...tool input parameters } }',
          },
        },
        required: ['title', 'steps'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN', // The plan itself is read-only; execution requires separate approval
    execute: async (input) => {
      const title = String(input.title || 'Workflow')
      let steps: Array<{ tool: string; description: string; input: Record<string, unknown> }>
      try {
        steps = JSON.parse(String(input.steps || '[]'))
      } catch {
        return JSON.stringify({ error: 'Invalid steps format. Must be a JSON array.' })
      }

      if (!Array.isArray(steps) || steps.length < 2) {
        return JSON.stringify({ error: 'A workflow must have at least 2 steps.' })
      }

      return JSON.stringify({
        workflowPlan: true,
        title,
        steps: steps.map((s, i) => ({
          stepNumber: i + 1,
          tool: s.tool,
          description: s.description,
          input: s.input,
          status: 'pending',
        })),
        stepCount: steps.length,
        message: `I've prepared a ${steps.length}-step workflow: "${title}". Please review and approve to execute.`,
      })
    },
  },
}

registerTools(tools)
