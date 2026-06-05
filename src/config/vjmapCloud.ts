/** VJMAP cloud service (same values as Java `cad.proxy` / platform settings page). */
export const VJMAP_SERVICE_URL =
  (import.meta.env.VITE_VJMAP_SERVICE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://vjmap.com/server/api/v1'

export const VJMAP_ACCESS_TOKEN =
  (import.meta.env.VITE_VJMAP_ACCESS_TOKEN as string | undefined)?.trim() || ''
