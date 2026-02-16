/**
 * Organization context for AI features. The AI uses this to know the school/organization
 * name and details so users don't have to type them in every time.
 *
 * Dynamic data from API takes precedence. Fallback to .env:
 * - VITE_ORG_NAME, VITE_ORG_WEBSITE, VITE_ORG_CONTEXT
 */

const FALLBACK_ORG_NAME = import.meta.env.VITE_ORG_NAME?.trim() || ''
const FALLBACK_ORG_WEBSITE = import.meta.env.VITE_ORG_WEBSITE?.trim() || ''
const ORG_CONTEXT = import.meta.env.VITE_ORG_CONTEXT?.trim() || ''

let _dynamicOrg = { name: '', website: '' }

/** Called by OrgModulesContext when org data loads from API. Takes precedence over env. */
export function setOrgContextFromAPI(data) {
  _dynamicOrg = {
    name: (data?.name ?? '').trim(),
    website: (data?.website ?? '').trim(),
  }
}

/** Build the context string injected into AI system instructions */
export function getOrgContextForAI() {
  const name = _dynamicOrg.name || FALLBACK_ORG_NAME || 'your organization'
  const website = _dynamicOrg.website || FALLBACK_ORG_WEBSITE
  let context = `ORGANIZATION CONTEXT: This application is for ${name}${website ? ` (${website})` : ''}. When creating or editing forms, event names, or content, assume the context is for this organization unless the user specifies otherwise. Use "${name}" in titles and descriptions when appropriate rather than asking the user to type it.`

  if (ORG_CONTEXT) {
    context += `\n\nAdditional organization context (use when relevant):\n${ORG_CONTEXT}`
  }

  return context
}
