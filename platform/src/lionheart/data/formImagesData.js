/**
 * Form Builder image library: user uploads, stock images, templates.
 * Stored in localStorage under lionheart-form-images.
 */

const STORAGE_KEY = 'lionheart-form-images'
const CUSTOM_STOCK_KEY = 'lionheart-form-custom-stock'

export const STOCK_IMAGES = [
  { id: 'stock-1', name: 'Logo', url: '/stock-images/download-b1726dae-455d-4670-b0d1-bba378015bb8.png' },
  { id: 'stock-2', name: 'Classroom', url: '/stock-images/image1-c64f4769-6ad5-45b1-afa8-4ab7ccdb37e3.png' },
  { id: 'stock-3', name: 'School Logo', url: '/stock-images/Logo-a2baa17c-6598-4a18-8395-3efbf7d893bb.png' },
  { id: 'stock-4', name: 'Students & Staff', url: '/stock-images/image4-b32b7720-e993-4df4-a31a-d52335f42928.png' },
  { id: 'stock-5', name: 'Lion Logo', url: '/stock-images/images-b5e3493e-752a-4401-b7af-9e5d5a07313a.png' },
  { id: 'stock-6', name: 'Campus Group', url: '/stock-images/image_3-d114adc9-15ee-4dcd-b8df-98b856907b59.png' },
  { id: 'stock-7', name: 'Student in Classroom', url: '/stock-images/image2-e9be0fe2-063f-442c-855c-a4274aa6dd0f.png' },
]

/** School Logo template */
export const LOGO_TEMPLATE = {
  id: 'template-logo',
  name: 'School Logo',
  type: 'logo',
  url: '/stock-images/Logo-a2baa17c-6598-4a18-8395-3efbf7d893bb.png',
}

/** Header templates – full-width banners */
export const HEADER_TEMPLATES = [
  {
    id: 'template-header-1',
    name: 'Blue gradient',
    type: 'header',
    url: 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
  <defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%233b82f6"/><stop offset="100%" style="stop-color:%231d4ed8"/></linearGradient></defs>
  <rect width="800" height="200" fill="url(%23g1)"/>
</svg>`),
  },
  {
    id: 'template-header-2',
    name: 'Neutral header',
    type: 'header',
    url: 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
  <defs><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:%23e4e4e7"/><stop offset="100%" style="stop-color:%23d4d4d8"/></linearGradient></defs>
  <rect width="800" height="200" fill="url(%23g2)"/>
</svg>`),
  },
  {
    id: 'template-header-3',
    name: 'Dark header',
    type: 'header',
    url: 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
  <defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:%2317181b"/><stop offset="100%" style="stop-color:%233f3f46"/></linearGradient></defs>
  <rect width="800" height="200" fill="url(%23g3)"/>
</svg>`),
  },
]

export function loadUserImages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveUserImages(images) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images))
  } catch (_) {}
}

export function addUserImage(dataUrl, name = 'Image') {
  const images = loadUserImages()
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const next = [...images, { id, url: dataUrl, name }]
  saveUserImages(next)
  return next
}

export function removeUserImage(id) {
  const images = loadUserImages().filter((i) => i.id !== id)
  saveUserImages(images)
  return images
}

export function loadCustomStockImages() {
  try {
    const raw = localStorage.getItem(CUSTOM_STOCK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addCustomStockImage(url, name = 'Custom') {
  const images = loadCustomStockImages()
  const id = `custom-${Date.now()}`
  const next = [...images, { id, url, name }]
  try {
    localStorage.setItem(CUSTOM_STOCK_KEY, JSON.stringify(next))
  } catch (_) {}
  return next
}

export function removeCustomStockImage(id) {
  const images = loadCustomStockImages().filter((i) => i.id !== id)
  try {
    localStorage.setItem(CUSTOM_STOCK_KEY, JSON.stringify(images))
  } catch (_) {}
  return images
}

export function resolveImageRef(ref) {
  if (!ref || typeof ref !== 'string') return null
  if (ref.startsWith('data:') || ref.startsWith('http')) return ref
  if (ref.startsWith('template:')) {
    const key = ref.replace('template:', '')
    if (key === 'logo') return LOGO_TEMPLATE.url
    const t = HEADER_TEMPLATES.find((h) => h.id === key || h.id.endsWith(key))
    return t?.url ?? null
  }
  if (ref.startsWith('stock:')) {
    const idx = parseInt(ref.replace('stock:', ''), 10)
    const all = [...STOCK_IMAGES, ...loadCustomStockImages()]
    const s = all[idx]
    return s?.url ?? null
  }
  if (ref.startsWith('my:')) {
    const id = ref.replace('my:', '')
    const img = loadUserImages().find((i) => i.id === id)
    return img?.url ?? null
  }
  return null
}
