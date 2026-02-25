import { prisma } from '@/lib/db';

export async function getSettingsForTenant(tenantSlug: string) {
  // Find tenant organization
  const org = await prisma.organization.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: { id: true },
  });
  if (!org) return {};

  // Fetch settings scoped by tenant
  const settings = await prisma.settings.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      key: true,
      value: true,
    },
  });
  return settings;
}
