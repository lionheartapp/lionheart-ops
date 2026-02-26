import { prisma } from '@/lib/db';

export async function getEventsForTenant(tenantSlug: string) {
  // Find tenant organization
  const org = await prisma.organization.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: { id: true },
  });
  if (!org) return [];

  // Fetch events scoped by tenant
  const events = await prisma.event.findMany({
    where: { organizationId: org.id },
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
    },
  });
  return events;
}
