// Permission checks (stub: always allow; replace with real checks when wiring to DB/roles)
export async function assertCan(_userId: string, _permission: string): Promise<void> {
  // TODO: Implement real permission check and throw if denied
}

export async function can(_userId: string, _permission: string): Promise<boolean> {
  // TODO: Implement real permission check
  return true
}
