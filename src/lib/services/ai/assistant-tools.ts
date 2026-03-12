/**
 * AI Assistant — Tool Definitions & Execution (Barrel Export)
 *
 * All tools are now defined in domain modules under ./tools/.
 * This file imports them (triggering self-registration) and
 * re-exports the public API from the central registry.
 */

// Import domain modules — each self-registers its tools on load
import './tools/maintenance.tools'
import './tools/events.tools'
import './tools/it.tools'
import './tools/users.tools'
import './tools/inventory.tools'
import './tools/campus.tools'
import './tools/communication.tools'
import './tools/search.tools'
import './tools/weather.tools'
import './tools/workflow.tools'
import './tools/memory.tools'

// Re-export public API
export { getAvailableTools, executeTool, getToolRiskTier } from './tools/_registry'
export type { GeminiFunctionDeclaration, ToolContext, ToolRegistryEntry, RiskTier } from './tools/_registry'
