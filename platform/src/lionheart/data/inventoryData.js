// teamId: 'av' | 'facilities' | 'it' = team inventory; 'personal' = user's personal inventory
// Item types (e.g. "8' table", "Folding chair")
export const INITIAL_INVENTORY_ITEMS = [
  { id: '1', name: "8' table", teamId: 'facilities' },
  { id: '2', name: "6' table", teamId: 'facilities' },
  { id: '3', name: 'Folding chair', teamId: 'facilities' },
  { id: '4', name: 'PA system', teamId: 'av' },
  { id: '5', name: 'Projector', teamId: 'av' },
  { id: '6', name: 'Laptop (loaner)', teamId: 'it' },
  { id: '7', name: 'HDMI cable', teamId: 'it' },
  { id: '8', name: 'Wireless mic', teamId: 'av' },
]

// Stock: itemId, location, quantity (scope inferred from item's teamId)
export const INITIAL_INVENTORY_STOCK = [
  { id: 's1', itemId: '1', location: 'Gym', quantity: 5 },
  { id: 's2', itemId: '1', location: 'Elementary School', quantity: 7 },
  { id: 's3', itemId: '2', location: 'Gym', quantity: 10 },
  { id: 's4', itemId: '2', location: 'Auditorium', quantity: 4 },
  { id: 's5', itemId: '3', location: 'Gym', quantity: 100 },
  { id: 's6', itemId: '3', location: 'Cafeteria', quantity: 80 },
  { id: 's7', itemId: '3', location: 'Elementary School', quantity: 60 },
  { id: 's8', itemId: '4', location: 'Auditorium', quantity: 2 },
  { id: 's9', itemId: '4', location: 'Gym', quantity: 1 },
  { id: 's10', itemId: '5', location: 'Auditorium', quantity: 3 },
  { id: 's11', itemId: '5', location: 'Library', quantity: 2 },
  { id: 's12', itemId: '6', location: 'IT Office', quantity: 5 },
  { id: 's13', itemId: '7', location: 'IT Office', quantity: 20 },
  { id: 's14', itemId: '8', location: 'Auditorium', quantity: 4 },
]

export const LOCATIONS = [
  'Gym',
  'Auditorium',
  'Cafeteria',
  'Library',
  'Elementary School',
  'Main Hall',
  'Classroom',
]

export function getTotalAvailable(stock, itemId) {
  return (stock || [])
    .filter((s) => s.itemId === itemId)
    .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
}

/** Get items filtered by scope (teamId or 'personal') */
export function getItemsByScope(items, scope) {
  return (items || []).filter((i) => (i.teamId ?? 'facilities') === scope)
}

/** Get stock for items in the given scope */
export function getStockByScope(stock, items, scope) {
  const itemIds = new Set(getItemsByScope(items, scope).map((i) => i.id))
  return (stock || []).filter((s) => itemIds.has(s.itemId))
}

export function checkItemsAvailable(items, stock, requested) {
  const result = { available: true, shortages: [] }
  for (const { itemId, quantity } of requested || []) {
    const need = Number(quantity) || 0
    if (need <= 0) continue
    const total = getTotalAvailable(stock, itemId)
    const itemName = items?.find((i) => i.id === itemId)?.name || itemId
    if (total < need) {
      result.available = false
      result.shortages.push({ itemName, needed: need, available: total })
    }
  }
  return result
}
