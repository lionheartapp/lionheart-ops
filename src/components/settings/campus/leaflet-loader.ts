/* ------------------------------------------------------------------ */
/*  Leaflet CDN loader (singleton)                                     */
/* ------------------------------------------------------------------ */

let leafletLoaded = false
let leafletPromise: Promise<void> | null = null

export function loadLeaflet(): Promise<void> {
  if (leafletLoaded && (window as any).L) return Promise.resolve()
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    if ((window as any).L) {
      leafletLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.crossOrigin = ''
    script.onload = () => {
      leafletLoaded = true
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })

  return leafletPromise
}
