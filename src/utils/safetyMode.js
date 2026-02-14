/** Biohazard keywords that trigger Safety Mode overlay */
const BIOHAZARD_KEYWORDS = [
  'vomit',
  'blood',
  'chemical',
  'biohazard',
  'bodily fluid',
  'bodily fluids',
  'contamination',
  'hazardous',
  'bleach spill',
  'chemical spill',
  'blood spill',
  'vomit cleanup',
  // Bathroom / toilet cleaning (plunging, overflows, bodily fluids)
  'plunger',
  'plunging',
  'stopped up',
  'clogged toilet',
  'toilet overflow',
  'toilet backup',
  'urine',
  'splash',
  'overflow',
]

/** Check if a ticket (title + description) contains biohazard keywords */
export function requiresSafetyMode(ticket) {
  if (!ticket) return false
  const text = [
    ticket.title || '',
    ticket.description || '',
    (ticket.requestedItems || []).map((i) => (typeof i === 'string' ? i : i?.item || '')).join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return BIOHAZARD_KEYWORDS.some((kw) => text.includes(kw))
}
