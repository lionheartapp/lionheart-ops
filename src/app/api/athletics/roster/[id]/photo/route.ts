import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAthlete, getTeams, updateAthlete } from '@/lib/services/athleticsService'
import { uploadPlayerPhoto, deletePlayerPhoto } from '@/lib/services/storageService'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'

const UploadSchema = z.object({
  fileBase64: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
})

const DeleteSchema = z.object({
  imageUrl: z.string().min(1),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Athlete = NonNullable<Awaited<ReturnType<typeof getAthlete>>>
type AthleteRoster = Athlete['rosters'][number]

function athleteIsOnAssignedTeam(athlete: Athlete, teams: Team[], userId: string) {
  const assignedTeamIds = new Set(
    teams.filter((team: Team) => team.coachUserId === userId).map((team: Team) => team.id)
  )
  return athlete.rosters.some((roster: AthleteRoster) => assignedTeamIds.has(roster.athleticTeam.id))
}

async function assertCanManagePlayer(playerId: string, userId: string, canManageAllTeams: boolean) {
  if (canManageAllTeams) return null

  const [athlete, teams] = await Promise.all([getAthlete(playerId), getTeams()])
  if (!athlete) {
    return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
  }
  if (!athleteIsOnAssignedTeam(athlete, teams, userId)) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only manage players on assigned teams'), { status: 403 })
  }
  return null
}

export const POST = withAuth<z.infer<typeof UploadSchema>>(async ({ orgId, params, body, ctx, permissions }) => {
  const playerId = params.id
  const canManageAllTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  const accessError = await assertCanManagePlayer(playerId, ctx.userId, canManageAllTeams)
  if (accessError) return accessError

  const fileBuffer = Buffer.from(body.fileBase64, 'base64')
  const uploadCheck = validateFileUpload(
    { type: body.contentType, size: fileBuffer.length, name: 'player-photo' },
    { allowedTypes: ALLOWED_IMAGE_TYPES, maxSizeBytes: 5 * 1024 * 1024 }
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  const photoUrl = await uploadPlayerPhoto(orgId, playerId, fileBuffer, body.contentType)

  await updateAthlete(playerId, { photoUrl })

  return NextResponse.json(ok({ photoUrl }))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: UploadSchema })

export const DELETE = withAuth<z.infer<typeof DeleteSchema>>(async ({ orgId, params, body, ctx, permissions }) => {
  const playerId = params.id
  const canManageAllTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  const accessError = await assertCanManagePlayer(playerId, ctx.userId, canManageAllTeams)
  if (accessError) return accessError

  // Verify URL belongs to this org
  if (!body.imageUrl.includes(`/logos/${orgId}/players/`)) {
    return NextResponse.json(fail('FORBIDDEN', 'Image does not belong to this organization'), { status: 403 })
  }

  try {
    await deletePlayerPhoto(body.imageUrl)
  } catch {
    // Continue even if storage delete fails
  }

  await updateAthlete(playerId, { photoUrl: null })

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: DeleteSchema })
