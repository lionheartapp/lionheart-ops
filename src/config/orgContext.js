/**
 * Organization context for AI features. The AI uses this to know the school/organization
 * name and details so users don't have to type them in every time.
 *
 * Set these in .env to customize:
 * - VITE_ORG_NAME: Organization name (e.g. "your school" - or comes from logged-in user's org)
 * - VITE_ORG_WEBSITE: Website URL (optional)
 * - VITE_ORG_CONTEXT: Optional extra context (paste key info from your website, mission statement, etc.)
 */

const ORG_NAME = import.meta.env.VITE_ORG_NAME?.trim() || ''
const ORG_WEBSITE = import.meta.env.VITE_ORG_WEBSITE?.trim() || ''
const ORG_CONTEXT = import.meta.env.VITE_ORG_CONTEXT?.trim() || ''

/** Build the context string injected into AI system instructions */
export function getOrgContextForAI() {
  const name = ORG_NAME || 'your organization'
  let context = `ORGANIZATION CONTEXT: This application is for ${name}${ORG_WEBSITE ? ` (${ORG_WEBSITE})` : ''}. When creating or editing forms, event names, or content, assume the context is for this organization unless the user specifies otherwise. Use "${name}" in titles and descriptions when appropriate rather than asking the user to type it.`

  if (ORG_CONTEXT) {
    context += `\n\nAdditional organization context (use when relevant):\n${ORG_CONTEXT}`
  }

  return context
}

export { ORG_NAME, ORG_WEBSITE }
