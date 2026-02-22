/** CORS headers for Vite/Lionheart app calling platform APIs */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id',
  'Access-Control-Expose-Headers': 'Authorization',
}
