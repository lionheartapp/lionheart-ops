/**
 * Planning Center Services — Two-Way Sync Service
 *
 * Handles fetching PCO service types, plans, and items (songs/media/headers),
 * importing them as Lionheart schedule blocks, and pushing local changes back to PCO.
 *
 * Architecture:
 *   PCO Service Type  →  (not stored, used for browsing)
 *   PCO Service Plan  →  PCOServiceLink  →  EventScheduleSection
 *   PCO Plan Item     →  PCOItemMapping  →  EventScheduleBlock
 */

import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const PCO_BASE_URL = 'https://api.planningcenteronline.com'
const log = logger.child({ service: 'pco-services-sync' })

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PCOServiceType {
  id: string
  name: string
  frequency: string | null
  lastPlanDate: string | null
}

export interface PCOPlanSummary {
  id: string
  serviceTypeId: string
  title: string | null
  seriesTitle: string | null
  dates: string | null       // Human-readable date string from PCO
  sortDate: string | null    // ISO date for sorting
  planningCenterUrl: string | null
  itemCount: number
}

export interface PCOPlanItem {
  id: string
  itemType: 'song' | 'media' | 'item' | 'header'
  title: string
  description: string | null
  length: number | null       // Duration in seconds
  songId: string | null
  arrangementId: string | null
  key: string | null          // Musical key
  sequence: number            // Sort order within plan
  htmlDetails: string | null
  servicePosition: 'pre' | 'during' | 'post' | null  // Where in the service this item falls
}

export interface PCOPlanDetail {
  plan: PCOPlanSummary
  items: PCOPlanItem[]
}

export interface ImportResult {
  blocksCreated: number
  blocksUpdated: number
  blocksRemoved: number
  errors: string[]
}

export interface PushResult {
  itemsUpdated: number
  itemsCreated: number
  errors: string[]
}

// ─── Token helper ─────────────────────────────────────────────────────────

async function getValidAccessToken(organizationId: string): Promise<string | null> {
  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'planning_center', isActive: true },
  })

  if (!cred?.accessToken) return null

  // Refresh if token expires within 5 minutes
  const needsRefresh =
    cred.tokenExpiresAt && cred.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return cred.accessToken

  if (!cred.refreshToken) return null

  try {
    const response = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: cred.refreshToken,
        client_id: process.env.PCO_APP_ID,
        client_secret: process.env.PCO_SECRET,
      }),
    })

    if (!response.ok) return cred.accessToken

    const tokenData = await response.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000)

    await rawPrisma.integrationCredential.update({
      where: { id: cred.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || cred.refreshToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    })

    return tokenData.access_token
  } catch {
    return cred.accessToken
  }
}

// ─── PCO API Helpers ────────────────────────────────────────────────────────

async function pcoFetch(accessToken: string, path: string, options?: RequestInit) {
  const url = path.startsWith('http') ? path : `${PCO_BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PCO API ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ─── Fetch Service Types ────────────────────────────────────────────────────

/**
 * List all PCO service types for an org (e.g., "Sunday Service", "Wednesday Night").
 */
export async function listServiceTypes(organizationId: string): Promise<PCOServiceType[]> {
  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) throw new Error('Not connected to Planning Center')

  const data = await pcoFetch(accessToken, '/services/v2/service_types?per_page=50')
  const types: PCOServiceType[] = (data.data || []).map((st: Record<string, unknown>) => {
    const attrs = st.attributes as Record<string, unknown> || {}
    return {
      id: st.id as string,
      name: (attrs.name as string) || 'Untitled',
      frequency: (attrs.frequency as string) || null,
      lastPlanDate: (attrs.last_plan_from as string) || null,
    }
  })

  return types
}

// ─── Fetch Plans for a Service Type ─────────────────────────────────────────

/**
 * List recent plans for a specific service type.
 * Returns the most recent 25 plans by default.
 */
export async function listPlans(
  organizationId: string,
  serviceTypeId: string,
  options?: { limit?: number; filter?: 'future' | 'past' | 'no_dates' }
): Promise<PCOPlanSummary[]> {
  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) throw new Error('Not connected to Planning Center')

  const limit = options?.limit || 25
  const filter = options?.filter || 'future'

  const data = await pcoFetch(
    accessToken,
    `/services/v2/service_types/${serviceTypeId}/plans?per_page=${limit}&filter=${filter}&order=-sort_date`
  )

  const plans: PCOPlanSummary[] = (data.data || []).map((plan: Record<string, unknown>) => {
    const attrs = plan.attributes as Record<string, unknown> || {}
    return {
      id: plan.id as string,
      serviceTypeId,
      title: (attrs.title as string) || null,
      seriesTitle: (attrs.series_title as string) || null,
      dates: (attrs.dates as string) || null,
      sortDate: (attrs.sort_date as string) || null,
      planningCenterUrl: (attrs.planning_center_url as string) || null,
      itemCount: (attrs.items_count as number) || 0,
    }
  })

  return plans
}

// ─── Fetch Plan Items (Songs, Media, Headers) ──────────────────────────────

/**
 * Fetch all items in a specific plan. Items include songs, media, custom items, and headers.
 * Returns items sorted by their sequence within the plan.
 */
export async function getPlanItems(
  organizationId: string,
  serviceTypeId: string,
  planId: string
): Promise<PCOPlanDetail> {
  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) throw new Error('Not connected to Planning Center')

  // Fetch plan metadata
  const planData = await pcoFetch(
    accessToken,
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}`
  )

  const planAttrs = (planData.data?.attributes as Record<string, unknown>) || {}
  const plan: PCOPlanSummary = {
    id: planId,
    serviceTypeId,
    title: (planAttrs.title as string) || null,
    seriesTitle: (planAttrs.series_title as string) || null,
    dates: (planAttrs.dates as string) || null,
    sortDate: (planAttrs.sort_date as string) || null,
    planningCenterUrl: (planAttrs.planning_center_url as string) || null,
    itemCount: (planAttrs.items_count as number) || 0,
  }

  // Fetch plan items — includes songs, media, custom items, headers
  const itemsData = await pcoFetch(
    accessToken,
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items?per_page=100&include=song,arrangement`
  )

  const included = (itemsData.included || []) as Array<Record<string, unknown>>
  const songMap = new Map<string, Record<string, unknown>>()
  const arrangementMap = new Map<string, Record<string, unknown>>()

  for (const inc of included) {
    if (inc.type === 'Song') songMap.set(inc.id as string, inc)
    if (inc.type === 'Arrangement') arrangementMap.set(inc.id as string, inc)
  }

  const items: PCOPlanItem[] = ((itemsData.data || []) as Array<Record<string, unknown>>).map(
    (item: Record<string, unknown>, index: number) => {
      const attrs = (item.attributes as Record<string, unknown>) || {}
      const rels = (item.relationships as Record<string, unknown>) || {}

      // Determine item type
      const itemType = (attrs.item_type as string)?.toLowerCase() || 'item'
      let mappedType: PCOPlanItem['itemType'] = 'item'
      if (itemType === 'song') mappedType = 'song'
      else if (itemType === 'media') mappedType = 'media'
      else if (itemType === 'header') mappedType = 'header'

      // Extract song/arrangement IDs from relationships
      const songRel = rels.song as Record<string, unknown> | undefined
      const songRelData = songRel?.data as Record<string, unknown> | undefined
      const songId = songRelData?.id as string | null

      const arrRel = rels.arrangement as Record<string, unknown> | undefined
      const arrRelData = arrRel?.data as Record<string, unknown> | undefined
      const arrangementId = arrRelData?.id as string | null

      // Get key name from arrangement
      let key: string | null = null
      if (arrangementId) {
        const arr = arrangementMap.get(arrangementId)
        if (arr) {
          const arrAttrs = arr.attributes as Record<string, unknown> | undefined
          key = (arrAttrs?.chord_chart_key as string) || null
        }
      }

      // Extract service_position (pre, during, post)
      const rawPosition = (attrs.service_position as string)?.toLowerCase() || null
      const servicePosition: PCOPlanItem['servicePosition'] =
        rawPosition === 'pre' || rawPosition === 'during' || rawPosition === 'post'
          ? rawPosition
          : null

      return {
        id: item.id as string,
        itemType: mappedType,
        title: (attrs.title as string) || 'Untitled',
        description: (attrs.description as string) || null,
        length: (attrs.length as number) || null,
        songId: songId || null,
        arrangementId: arrangementId || null,
        key,
        sequence: (attrs.sequence as number) || index,
        htmlDetails: (attrs.html_details as string) || null,
        servicePosition,
      }
    }
  )

  // Sort by sequence
  items.sort((a, b) => a.sequence - b.sequence)

  return { plan, items }
}

// ─── Import PCO Plan → Lionheart Schedule Blocks ────────────────────────────

/**
 * Import a PCO service plan into a Lionheart schedule section.
 * Creates/updates EventScheduleBlocks and PCOItemMappings.
 *
 * Strategy:
 * 1. If a PCOServiceLink exists, update it. Otherwise, create one.
 * 2. For each PCO item, check if a mapping exists:
 *    - If yes → update the existing block
 *    - If no  → create a new block + mapping
 * 3. Blocks that existed before but no longer have a PCO counterpart are left alone
 *    (we don't auto-delete — the user may have added custom blocks).
 */
export async function importPlanToSection(
  organizationId: string,
  eventProjectId: string,
  sectionId: string,
  serviceTypeId: string,
  planId: string,
  options?: { syncDirection?: 'import_only' | 'export_only' | 'both'; autoSync?: boolean; selectedItemIds?: string[] }
): Promise<ImportResult> {
  const result: ImportResult = { blocksCreated: 0, blocksUpdated: 0, blocksRemoved: 0, errors: [] }

  try {
    // 1. Verify PCO connection
    const cred = await rawPrisma.integrationCredential.findFirst({
      where: { organizationId, provider: 'planning_center', isActive: true },
    })
    if (!cred) throw new Error('Not connected to Planning Center')

    // 2. Fetch plan items from PCO
    const planDetail = await getPlanItems(organizationId, serviceTypeId, planId)

    // 3. Get/create the service link
    const existingLink = await rawPrisma.pCOServiceLink.findUnique({
      where: { sectionId },
      include: { itemMappings: true },
    })

    let serviceLinkId: string
    if (existingLink) {
      // Update existing link
      await rawPrisma.pCOServiceLink.update({
        where: { id: existingLink.id },
        data: {
          pcoServiceTypeId: serviceTypeId,
          pcoPlanId: planId,
          pcoPlanDate: planDetail.plan.sortDate ? new Date(planDetail.plan.sortDate) : null,
          pcoPlanTitle: planDetail.plan.title || planDetail.plan.dates,
          pcoServiceTypeName: null, // Will be updated below
          syncDirection: options?.syncDirection || existingLink.syncDirection,
          autoSync: options?.autoSync ?? existingLink.autoSync,
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          updatedAt: new Date(),
        },
      })
      serviceLinkId = existingLink.id
    } else {
      const link = await rawPrisma.pCOServiceLink.create({
        data: {
          organizationId,
          eventProjectId,
          sectionId,
          credentialId: cred.id,
          pcoServiceTypeId: serviceTypeId,
          pcoPlanId: planId,
          pcoPlanDate: planDetail.plan.sortDate ? new Date(planDetail.plan.sortDate) : null,
          pcoPlanTitle: planDetail.plan.title || planDetail.plan.dates,
          syncDirection: options?.syncDirection || 'both',
          autoSync: options?.autoSync ?? false,
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
        },
      })
      serviceLinkId = link.id
    }

    // Update service type name
    try {
      const types = await listServiceTypes(organizationId)
      const matchingType = types.find((t) => t.id === serviceTypeId)
      if (matchingType) {
        await rawPrisma.pCOServiceLink.update({
          where: { id: serviceLinkId },
          data: { pcoServiceTypeName: matchingType.name },
        })
      }
    } catch {
      // Non-fatal
    }

    // 4. Get section details for time computation
    const section = await rawPrisma.eventScheduleSection.findUnique({
      where: { id: sectionId },
    })
    if (!section) throw new Error('Schedule section not found')

    // Parse section start time for block time computation.
    // IMPORTANT: section.date is a Prisma @db.Date → midnight UTC. We must use
    // getUTC*() to extract the correct calendar date, then build a local-time
    // Date that matches how the frontend constructs block dates (e.g.
    // `new Date("2026-04-08T00:00:00")` without a Z suffix).
    const [startH, startM] = (section.startTime || '09:00').split(':').map(Number)
    const sectionDate = new Date(section.date)
    const baseDate = new Date(
      sectionDate.getUTCFullYear(),
      sectionDate.getUTCMonth(),
      sectionDate.getUTCDate(),
      startH || 9,
      startM || 0
    )

    // 5. Build existing mapping index
    const existingMappings = existingLink?.itemMappings || []
    const mappingByPcoItemId = new Map(existingMappings.map((m) => [m.pcoItemId, m]))

    // 5b. Filter items by selectedItemIds if provided
    const selectedSet = options?.selectedItemIds ? new Set(options.selectedItemIds) : null

    // 6. Process each PCO item sequentially from section start time.
    // Pre/post items are placed in sequence order (matching PCO) and tagged
    // in metadata so the schedule UI can show position badges.
    // Calculate pre-service total so those items start BEFORE the section time
    const allImportable = planDetail.items.filter(
      (item) => item.itemType !== 'header' && (!selectedSet || selectedSet.has(item.id))
    )
    const preTotal = allImportable
      .filter((i) => i.servicePosition === 'pre')
      .reduce((sum, i) => sum + (i.length || 300), 0)
    let cursor = -preTotal // negative = before section start

    for (let i = 0; i < planDetail.items.length; i++) {
      const item = planDetail.items[i]

      // Skip headers — they're structural, not actual schedule items
      if (item.itemType === 'header') continue

      // Skip items not in the selection (if a selection was provided)
      if (selectedSet && !selectedSet.has(item.id)) continue

      // Reset cursor to 0 when transitioning from pre to during/post
      if (item.servicePosition !== 'pre' && cursor < 0) {
        cursor = 0
      }

      const duration = item.length || 300 // Default 5 min if no duration
      const startsAt = new Date(baseDate.getTime() + cursor * 1000)
      const endsAt = new Date(startsAt.getTime() + duration * 1000)

      // Map PCO item type to EventScheduleBlockType (using valid enum values)
      const blockType = 'SESSION'  // All PCO items map to SESSION — the block type enum doesn't have song/media variants

      // Build metadata with PCO-specific info
      const metadata: Record<string, unknown> = {
        pcoItemId: item.id,
        pcoItemType: item.itemType,
        servicePosition: item.servicePosition, // 'pre' | 'during' | 'post' | null
      }
      if (item.key) metadata.musicalKey = item.key
      if (item.songId) metadata.pcoSongId = item.songId
      if (item.arrangementId) metadata.pcoArrangementId = item.arrangementId

      const existingMapping = mappingByPcoItemId.get(item.id)

      if (existingMapping) {
        // Update existing block
        try {
          await rawPrisma.eventScheduleBlock.update({
            where: { id: existingMapping.blockId },
            data: {
              title: item.title,
              description: item.description,
              startsAt,
              endsAt,
              sortOrder: i,
              metadata,
              updatedAt: new Date(),
            },
          })

          await rawPrisma.pCOItemMapping.update({
            where: { id: existingMapping.id },
            data: {
              pcoKey: item.key,
              lastPcoUpdatedAt: new Date(),
              updatedAt: new Date(),
            },
          })

          result.blocksUpdated++
        } catch (err) {
          result.errors.push(`Failed to update block for PCO item ${item.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      } else {
        // Create new block + mapping
        try {
          const block = await rawPrisma.eventScheduleBlock.create({
            data: {
              organizationId,
              eventProjectId,
              sectionId,
              type: blockType,
              title: item.title,
              description: item.description,
              startsAt,
              endsAt,
              sortOrder: i,
              metadata,
            },
          })

          await rawPrisma.pCOItemMapping.create({
            data: {
              serviceLinkId,
              blockId: block.id,
              pcoItemId: item.id,
              pcoItemType: item.itemType,
              pcoSongId: item.songId,
              pcoArrangementId: item.arrangementId,
              pcoKey: item.key,
              lastPcoUpdatedAt: new Date(),
            },
          })

          result.blocksCreated++
        } catch (err) {
          result.errors.push(`Failed to create block for PCO item ${item.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }

      cursor += duration
    }

    // Log sync result
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId: cred.id,
        provider: 'planning_center',
        action: 'import_service_plan',
        status: result.errors.length > 0 ? 'partial' : 'success',
        recordsProcessed: result.blocksCreated + result.blocksUpdated,
        recordsFailed: result.errors.length,
        metadata: {
          planId,
          serviceTypeId,
          sectionId,
          created: result.blocksCreated,
          updated: result.blocksUpdated,
        },
      },
    })

    log.info(
      { organizationId, planId, created: result.blocksCreated, updated: result.blocksUpdated },
      'Imported PCO service plan'
    )
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown import error')
    log.error({ err, organizationId }, 'Failed to import PCO service plan')
  }

  return result
}

// ─── Push Lionheart Changes → PCO ──────────────────────────────────────────

/**
 * Push local schedule block changes back to Planning Center.
 * Only updates items that have a PCOItemMapping (doesn't create new PCO items).
 *
 * What gets pushed:
 * - Item title
 * - Item description
 * - Item length (duration)
 *
 * What does NOT get pushed (read-only in PCO):
 * - Song assignments (requires separate PCO workflow)
 * - Arrangement/key changes (managed in PCO)
 * - Item reordering (PCO has its own sequence logic)
 */
export async function pushSectionToPCO(
  organizationId: string,
  sectionId: string
): Promise<PushResult> {
  const result: PushResult = { itemsUpdated: 0, itemsCreated: 0, errors: [] }

  try {
    const accessToken = await getValidAccessToken(organizationId)
    if (!accessToken) throw new Error('Not connected to Planning Center')

    // Get the service link and its mappings
    const serviceLink = await rawPrisma.pCOServiceLink.findUnique({
      where: { sectionId },
      include: {
        itemMappings: {
          include: { block: true },
        },
      },
    })

    if (!serviceLink) throw new Error('No Planning Center link found for this section')
    if (serviceLink.syncDirection === 'import_only') {
      throw new Error('This section is configured for import-only sync')
    }

    // Push each mapped item
    for (const mapping of serviceLink.itemMappings) {
      const block = mapping.block
      if (!block) continue

      try {
        // Calculate duration in seconds from block times
        const startsAt = new Date(block.startsAt)
        const endsAt = new Date(block.endsAt)
        const durationSeconds = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 1000), 60)

        // Update the PCO plan item
        await pcoFetch(
          accessToken,
          `/services/v2/service_types/${serviceLink.pcoServiceTypeId}/plans/${serviceLink.pcoPlanId}/items/${mapping.pcoItemId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                type: 'Item',
                id: mapping.pcoItemId,
                attributes: {
                  title: block.title,
                  description: block.description || '',
                  length: durationSeconds,
                },
              },
            }),
          }
        )

        // Update mapping timestamp
        await rawPrisma.pCOItemMapping.update({
          where: { id: mapping.id },
          data: { lastPushedAt: new Date(), updatedAt: new Date() },
        })

        result.itemsUpdated++
      } catch (err) {
        result.errors.push(
          `Failed to push item ${mapping.pcoItemId}: ${err instanceof Error ? err.message : 'Unknown'}`
        )
      }
    }

    // Update link status
    await rawPrisma.pCOServiceLink.update({
      where: { id: serviceLink.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
        updatedAt: new Date(),
      },
    })

    // Log sync result
    const cred = await rawPrisma.integrationCredential.findFirst({
      where: { organizationId, provider: 'planning_center', isActive: true },
    })

    if (cred) {
      await rawPrisma.integrationSyncLog.create({
        data: {
          organizationId,
          credentialId: cred.id,
          provider: 'planning_center',
          action: 'push_service_plan',
          status: result.errors.length > 0 ? 'partial' : 'success',
          recordsProcessed: result.itemsUpdated,
          recordsFailed: result.errors.length,
          metadata: {
            planId: serviceLink.pcoPlanId,
            sectionId,
            updated: result.itemsUpdated,
          },
        },
      })
    }

    log.info(
      { organizationId, sectionId, updated: result.itemsUpdated },
      'Pushed schedule changes to PCO'
    )
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown push error')
    log.error({ err, organizationId }, 'Failed to push schedule changes to PCO')
  }

  return result
}

// ─── Get Link Status ────────────────────────────────────────────────────────

/**
 * Get the PCO service link for a section (if any).
 */
export async function getServiceLink(sectionId: string) {
  return rawPrisma.pCOServiceLink.findUnique({
    where: { sectionId },
    include: {
      itemMappings: {
        include: { block: { select: { id: true, title: true } } },
      },
    },
  })
}

/**
 * Per-section update info returned by auto-sync.
 */
export interface SectionSyncStatus {
  sectionId: string
  newItemCount: number       // Items in PCO not yet mapped (available to import)
  removedItemCount: number   // Items previously mapped but no longer in PCO
  updatedCount: number       // Existing mapped items that were refreshed
  newItemTitles: string[]    // Titles of new items (for the notification banner)
}

/**
 * Auto-sync all linked sections for a project. Called on schedule tab load.
 *
 * UPDATE-ONLY: only refreshes blocks that are already mapped (user previously
 * chose to import them). New items in PCO are detected but NOT imported —
 * the user must open the link modal to pick them.
 *
 * Detection of new/removed items ALWAYS runs (so the notification banner works).
 * Block updates are throttled to once per 2 minutes to avoid hammering PCO.
 */
export async function syncAllLinkedSections(
  organizationId: string,
  eventProjectId: string
): Promise<{ synced: number; skipped: number; errors: string[]; sections: SectionSyncStatus[] }> {
  const result = { synced: 0, skipped: 0, errors: [] as string[], sections: [] as SectionSyncStatus[] }

  try {
    const links = await rawPrisma.pCOServiceLink.findMany({
      where: { organizationId, eventProjectId },
      include: { itemMappings: true },
    })

    if (links.length === 0) return result

    const TWO_MIN = 2 * 60 * 1000

    for (const link of links) {
      const sectionStatus: SectionSyncStatus = {
        sectionId: link.sectionId,
        newItemCount: 0,
        removedItemCount: 0,
        updatedCount: 0,
        newItemTitles: [],
      }

      // Throttle: skip block updates if synced recently, but always check for new items
      const recentlyUpdated = link.lastSyncAt && Date.now() - link.lastSyncAt.getTime() < TWO_MIN

      try {
        // Always fetch latest plan items from PCO (needed for new-item detection)
        const planDetail = await getPlanItems(organizationId, link.pcoServiceTypeId, link.pcoPlanId)
        const pcoItems = planDetail.items.filter((i) => i.itemType !== 'header')

        // Build lookup of existing mappings by PCO item ID
        const mappedPcoItemIds = new Set(link.itemMappings.map((m) => m.pcoItemId))

        // Always detect new items (in PCO but not mapped)
        for (const item of pcoItems) {
          if (!mappedPcoItemIds.has(item.id)) {
            sectionStatus.newItemCount++
            sectionStatus.newItemTitles.push(item.title)
          }
        }

        // Always detect removed items (mapped but no longer in PCO)
        const currentPcoItemIds = new Set(pcoItems.map((i) => i.id))
        for (const mapping of link.itemMappings) {
          if (!currentPcoItemIds.has(mapping.pcoItemId)) {
            sectionStatus.removedItemCount++
          }
        }

        // Always report section status (for notification banners)
        result.sections.push(sectionStatus)

        // Only update blocks if not recently synced
        if (recentlyUpdated) {
          result.skipped++
          continue
        }

        // Get section for time computation
        const section = await rawPrisma.eventScheduleSection.findUnique({ where: { id: link.sectionId } })
        if (!section) continue

        const [startH, startM] = (section.startTime || '09:00').split(':').map(Number)
        const sectionDate = new Date(section.date)
        const baseDate = new Date(
          sectionDate.getUTCFullYear(),
          sectionDate.getUTCMonth(),
          sectionDate.getUTCDate(),
          startH || 9,
          startM || 0
        )

        // Update ONLY already-mapped items (don't create new ones)
        // Pre-service items start before the section time
        const preTotal = pcoItems
          .filter((i) => i.servicePosition === 'pre')
          .reduce((sum, i) => sum + (i.length || 300), 0)
        let cursor = -preTotal
        let sortIndex = 0
        for (const item of pcoItems) {
          const duration = item.length || 300

          // Reset cursor to 0 when transitioning from pre to during/post
          if (item.servicePosition !== 'pre' && cursor < 0) {
            cursor = 0
          }

          const mapping = link.itemMappings.find((m) => m.pcoItemId === item.id)

          if (mapping) {
            // Update the existing block with latest PCO data
            const startsAt = new Date(baseDate.getTime() + cursor * 1000)
            const endsAt = new Date(startsAt.getTime() + duration * 1000)

            const metadata: Record<string, unknown> = {
              pcoItemId: item.id,
              pcoItemType: item.itemType,
              servicePosition: item.servicePosition,
            }
            if (item.key) metadata.musicalKey = item.key
            if (item.songId) metadata.pcoSongId = item.songId
            if (item.arrangementId) metadata.pcoArrangementId = item.arrangementId

            try {
              await rawPrisma.eventScheduleBlock.update({
                where: { id: mapping.blockId },
                data: {
                  title: item.title,
                  description: item.description,
                  startsAt,
                  endsAt,
                  sortOrder: sortIndex,
                  metadata,
                  updatedAt: new Date(),
                },
              })
              await rawPrisma.pCOItemMapping.update({
                where: { id: mapping.id },
                data: {
                  pcoKey: item.key,
                  lastPcoUpdatedAt: new Date(),
                  updatedAt: new Date(),
                },
              })
              sectionStatus.updatedCount++
            } catch (err) {
              result.errors.push(`Failed to update block for PCO item ${item.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
            }
            cursor += duration
            sortIndex++
          } else {
            // New item — skip (don't import), but still advance cursor for time accuracy
            // of mapped items that come after this one
            cursor += duration
          }
        }

        // Update link sync timestamp
        await rawPrisma.pCOServiceLink.update({
          where: { id: link.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
            updatedAt: new Date(),
          },
        })

        result.synced++
      } catch (err) {
        result.errors.push(
          `Failed to sync section ${link.sectionId}: ${err instanceof Error ? err.message : 'Unknown'}`
        )
      }
    }

    log.info(
      { organizationId, eventProjectId, synced: result.synced, skipped: result.skipped },
      'Auto-synced linked PCO sections (update-only)'
    )
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown sync-all error')
    log.error({ err, organizationId }, 'Failed to auto-sync PCO sections')
  }

  return result
}

/**
 * Remove the PCO link from a section. Does NOT delete the blocks — just unlinks them.
 */
/**
 * Unlink a single PCO item mapping from a section.
 * Deletes the PCOItemMapping row and optionally the associated EventScheduleBlock.
 */
export async function unlinkItem(
  sectionId: string,
  pcoItemId: string,
  deleteBlock: boolean = false
): Promise<{ unlinked: true }> {
  const link = await rawPrisma.pCOServiceLink.findUnique({ where: { sectionId } })
  if (!link) throw new Error('No PCO link found for this section')

  const mapping = await rawPrisma.pCOItemMapping.findUnique({
    where: { serviceLinkId_pcoItemId: { serviceLinkId: link.id, pcoItemId } },
  })
  if (!mapping) throw new Error('No mapping found for this PCO item')

  if (deleteBlock) {
    // Delete the block first (cascade will also remove the mapping)
    await rawPrisma.eventScheduleBlock.delete({ where: { id: mapping.blockId } })
  } else {
    // Just remove the mapping, keep the block
    await rawPrisma.pCOItemMapping.delete({ where: { id: mapping.id } })
  }

  return { unlinked: true }
}

export async function unlinkSection(sectionId: string): Promise<void> {
  const link = await rawPrisma.pCOServiceLink.findUnique({ where: { sectionId } })
  if (link) {
    // Delete all item mappings first (cascade should handle this, but be explicit)
    await rawPrisma.pCOItemMapping.deleteMany({ where: { serviceLinkId: link.id } })
    await rawPrisma.pCOServiceLink.delete({ where: { id: link.id } })
  }
}
