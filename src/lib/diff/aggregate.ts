/**
 * Aggregation rules for the Since-Yesterday diff.
 *
 * Groups raw DiffEvent rows into display items. Most categories
 * aggregate by count; some stay individual because the detail matters.
 */

interface RawDiffEvent {
  id: string
  resourceType: string
  resourceId: string
  changeType: string
  severity: string
  summary: string
  meta: unknown
  occurredAt: Date
  actorUserId: string | null
  targetUserId: string | null
  teamId: string | null
  handledBy: { userId: string; handledAt: Date; method: string }[]
}

export interface AggregatedDiffItem {
  id: string
  category: string
  severity: 'critical' | 'high' | 'normal' | 'good'
  summary: string
  deepLinkPath: string | null
  diffEventIds: string[]
  handled: boolean
  occurredAt: string // ISO string of the most recent event in this group
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  good: 3,
}

export function aggregateDiffEvents(
  events: RawDiffEvent[],
  userId: string,
  anchorIso: string
): { items: AggregatedDiffItem[]; totals: { unhandled: number; handled: number } } {
  // Partition into handled vs unhandled for this user
  const withHandledFlag = events.map((e) => ({
    ...e,
    handled: e.handledBy.length > 0,
  }))

  // Group by category bucket
  const buckets = new Map<string, typeof withHandledFlag>()
  for (const e of withHandledFlag) {
    const cat = categorize(e.resourceType, e.changeType)
    const list = buckets.get(cat) ?? []
    list.push(e)
    buckets.set(cat, list)
  }

  const items: AggregatedDiffItem[] = []

  for (const [category, group] of buckets) {
    const rule = AGGREGATION_RULES[category]
    if (!rule) {
      // Unknown category — show individually
      for (const e of group) {
        items.push(toIndividualItem(e, category))
      }
      continue
    }

    if (rule.mode === 'always_individual') {
      for (const e of group) {
        items.push(toIndividualItem(e, category))
      }
    } else if (rule.mode === 'always_aggregate') {
      items.push(toAggregatedItem(group, category, rule.summaryFn, anchorIso))
    } else {
      // Threshold: individual if <= threshold, aggregate if more
      if (group.length <= (rule.threshold ?? 2)) {
        for (const e of group) {
          items.push(toIndividualItem(e, category))
        }
      } else {
        items.push(toAggregatedItem(group, category, rule.summaryFn, anchorIso))
      }
    }
  }

  // Sort: severity first, then most recent
  items.sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
    if (sevDiff !== 0) return sevDiff
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  })

  const unhandled = items.filter((i) => !i.handled).length
  const handled = items.filter((i) => i.handled).length

  return { items, totals: { unhandled, handled } }
}

// ─── Category mapping ───────────────────────────────────────────────────────

function categorize(resourceType: string, changeType: string): string {
  if (resourceType === 'ticket' && changeType === 'created') return 'new_tickets'
  if (resourceType === 'ticket' && changeType === 'assigned') return 'assignments'
  if (changeType === 'completed') return 'completions'
  if (changeType === 'approved' || changeType === 'rejected') return 'approvals_waiting'
  if (resourceType === 'event' || resourceType === 'draft_event') return 'event_changes'
  if (resourceType === 'ticket' && changeType === 'status_changed') return 'ticket_updates'
  return 'other'
}

// ─── Aggregation rules ──────────────────────────────────────────────────────

interface AggRule {
  mode: 'always_aggregate' | 'always_individual' | 'threshold'
  threshold?: number
  summaryFn: (events: { severity: string; meta: unknown }[]) => string
  deepLinkPath?: (anchorIso: string) => string
}

const AGGREGATION_RULES: Record<string, AggRule> = {
  new_tickets: {
    mode: 'always_aggregate',
    summaryFn: (events) => {
      const total = events.length
      const highPri = events.filter(
        (e) => e.severity === 'critical' || e.severity === 'high'
      ).length
      let s = `${total} new ticket${total !== 1 ? 's' : ''} overnight`
      if (highPri > 0) s += ` · ${highPri} high priority`
      return s
    },
    deepLinkPath: (anchor) => `/tickets?since=${encodeURIComponent(anchor)}`,
  },
  approvals_waiting: {
    mode: 'always_aggregate',
    summaryFn: (events) => {
      const total = events.length
      return `${total} approval${total !== 1 ? 's' : ''} waiting on you`
    },
    deepLinkPath: () => '/events?tab=approvals',
  },
  assignments: {
    mode: 'always_aggregate',
    summaryFn: (events) => {
      const total = events.length
      return `${total} new ticket${total !== 1 ? 's' : ''} assigned to your team`
    },
    deepLinkPath: (anchor) => `/tickets?since=${encodeURIComponent(anchor)}`,
  },
  completions: {
    mode: 'always_individual',
    summaryFn: () => '',
  },
  event_changes: {
    mode: 'threshold',
    threshold: 2,
    summaryFn: (events) => {
      const total = events.length
      return `${total} event${total !== 1 ? 's' : ''} updated`
    },
    deepLinkPath: () => '/events',
  },
  ticket_updates: {
    mode: 'threshold',
    threshold: 2,
    summaryFn: (events) => {
      const total = events.length
      return `${total} ticket${total !== 1 ? 's' : ''} updated`
    },
    deepLinkPath: (anchor) => `/tickets?since=${encodeURIComponent(anchor)}`,
  },
}

// ─── Item builders ──────────────────────────────────────────────────────────

function toIndividualItem(
  e: RawDiffEvent & { handled: boolean },
  category: string
): AggregatedDiffItem {
  return {
    id: `diff_${e.id}`,
    category,
    severity: e.severity as AggregatedDiffItem['severity'],
    summary: e.summary,
    deepLinkPath: buildResourceLink(e.resourceType, e.resourceId),
    diffEventIds: [e.id],
    handled: e.handled,
    occurredAt: e.occurredAt.toISOString(),
  }
}

function toAggregatedItem(
  events: (RawDiffEvent & { handled: boolean })[],
  category: string,
  summaryFn: (events: { severity: string; meta: unknown }[]) => string,
  anchorIso: string
): AggregatedDiffItem {
  const ids = events.map((e) => e.id)
  const allHandled = events.every((e) => e.handled)
  const highestSeverity = events.reduce<string>((best, e) => {
    return (SEVERITY_ORDER[e.severity] ?? 2) < (SEVERITY_ORDER[best] ?? 2)
      ? e.severity
      : best
  }, 'good')
  const mostRecent = events.reduce((latest, e) =>
    e.occurredAt > latest.occurredAt ? e : latest
  )

  const rule = AGGREGATION_RULES[category]

  return {
    id: `agg_${category}_${ids[0]}`,
    category,
    severity: highestSeverity as AggregatedDiffItem['severity'],
    summary: summaryFn(events),
    deepLinkPath: rule?.deepLinkPath?.(anchorIso) ?? null,
    diffEventIds: ids,
    handled: allHandled,
    occurredAt: mostRecent.occurredAt.toISOString(),
  }
}

function buildResourceLink(resourceType: string, resourceId: string): string | null {
  switch (resourceType) {
    case 'ticket':
      return `/tickets/${resourceId}`
    case 'event':
    case 'draft_event':
      return `/events/${resourceId}`
    default:
      return null
  }
}
