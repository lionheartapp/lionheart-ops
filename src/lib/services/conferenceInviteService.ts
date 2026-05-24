import { rawPrisma } from '@/lib/db'

export async function redeemConferenceInvite(token: string, organizationId: string) {
  const invite = await rawPrisma.conferenceInvite.findUnique({
    where: { token },
    include: { conference: true },
  })

  if (!invite || invite.status !== 'PENDING') return null

  if (invite.expiresAt.getTime() < Date.now()) {
    await rawPrisma.conferenceInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    })
    return null
  }

  await rawPrisma.$transaction([
    rawPrisma.conferenceMembership.upsert({
      where: {
        conferenceId_organizationId: {
          conferenceId: invite.conferenceId,
          organizationId,
        },
      },
      create: {
        conferenceId: invite.conferenceId,
        organizationId,
        status: 'ACTIVE',
        invitedBy: invite.invitedBy,
        acceptedAt: new Date(),
      },
      update: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    }),
    rawPrisma.conferenceInvite.update({
      where: { id: invite.id },
      data: {
        status: 'REDEEMED',
        acceptedAt: new Date(),
        redeemedOrgId: organizationId,
      },
    }),
  ])

  return invite.conference
}
