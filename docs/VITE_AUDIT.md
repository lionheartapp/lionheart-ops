
# Environment Variable Migration Audit

All legacy VITE_* env patterns have been fully removed from runtime code and documentation. The platform now uses Next.js env patterns exclusively:

- `process.env.NEXT_PUBLIC_*` for client-side variables
- `process.env.*` for server-only variables

## Recommended Next.js Environment Variables

| Variable | Usage |
|----------|-------|
| NEXT_PUBLIC_PLATFORM_URL | Platform URL for client code |
| NEXT_PUBLIC_CURRENT_ORG_ID | Current org ID for client code |
| NEXT_PUBLIC_ORG_NAME | School/org name for client code |
| NEXT_PUBLIC_ORG_WEBSITE | School/org website for client code |
| NEXT_PUBLIC_GEMINI_API_KEY | Gemini API key for client code |
| GEMINI_API_KEY | Gemini API key for server code |

## Status

✅ All code and docs now use Next.js env patterns. No legacy VITE_* references remain.
