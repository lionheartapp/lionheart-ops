/**
 * Resource item normalization.
 *
 * `metadata.avNeeds` and `metadata.facilityNeeds` historically stored plain
 * `string[]`. New UIs store `ResourceItem[]` (`{ name, qty?, note? }`) so users
 * can attach context. Both shapes coexist in production data — always read
 * through this helper to get a consistent shape.
 */

export interface ResourceItem {
  name: string
  qty?: number
  note?: string
}

type StoredResource = string | { name?: unknown; qty?: unknown; note?: unknown }

function normalize(raw: StoredResource): ResourceItem | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed ? { name: trimmed } : null
  }
  if (!raw || typeof raw !== 'object') return null

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  return {
    name,
    qty: typeof raw.qty === 'number' && raw.qty > 1 ? raw.qty : undefined,
    note: typeof raw.note === 'string' && raw.note.trim().length > 0 ? raw.note.trim() : undefined,
  }
}

/**
 * Read a resource list from a metadata blob, normalizing string entries to
 * objects. Returns an empty array if the field is missing or malformed.
 */
export function readResourceItems(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): ResourceItem[] {
  if (!meta) return []
  const raw = meta[key]
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is StoredResource => entry !== null && entry !== undefined)
    .map(normalize)
    .filter((item): item is ResourceItem => item !== null)
}

/** Convenience for legacy renderers that just want the names as a string array. */
export function readResourceItemNames(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  return readResourceItems(meta, key).map((item) => item.name)
}
