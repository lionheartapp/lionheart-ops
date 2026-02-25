export {}
// Minimal API response helpers
export function ok(data: unknown) {
  return { success: true, ok: true, data };
}

export function fail(code: string, message: string, details?: unknown) {
  const body: { success: false; ok: false; code: string; message: string; details?: unknown } = { success: false, ok: false, code, message };
  if (details !== undefined) body.details = details;
  return body;
}
