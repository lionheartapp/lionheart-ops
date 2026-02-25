// Stub: extract user from request (e.g. JWT in Authorization header)
export async function getUserContext(_req: unknown): Promise<{ userId: string }> {
  // TODO: Implement real user context extraction from request
  return { userId: 'demo-user' }
}
