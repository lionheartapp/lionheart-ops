import { prisma } from '@/lib/db';

export async function getSettingsForTenant(tenantSlug: string) {
  // No settings model exists; return empty array
  return [];
}
