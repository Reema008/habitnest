/**
 * CORS for browser-invoked Edge Functions. Only the HabitNest origins may call them.
 */
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://reema008.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

/** Answers a CORS preflight, or returns null for any other method. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  const origin = req.headers.get('Origin') ?? ''
  return new Response(null, { status: ALLOWED_ORIGINS.has(origin) ? 204 : 403, headers: corsHeaders(req) })
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
