// Helpers that combine several API calls for the staff pages.
import { getEventResults, getEvents } from './api.js'
import { countryName } from './countries.js'

// All events, with their results attached for events that have started.
export async function loadEventsWithResults() {
  const events = await getEvents()
  return Promise.all(events.map(async (e) => ({ ...e, results: e.status === 'start-list' ? [] : await getEventResults(e.id).catch(() => []) })))
}

// Medal table worked out from results, optionally for one event group (track, field, road).
export function medalTable(events, type = '') {
  const t = {}
  for (const e of events) {
    if (type && e.type !== type) continue
    for (const r of e.results || []) {
      if (!r.medal) continue
      t[r.country] ??= { code: r.country, name: countryName(r.country), gold: 0, silver: 0, bronze: 0 }
      t[r.country][r.medal] += 1
    }
  }
  return Object.values(t).map((r) => ({ ...r, total: r.gold + r.silver + r.bronze }))
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name))
}

export const days = (events) => [...new Set(events.map((e) => e.date).filter(Boolean))].sort()
export const today = () => new Date().toISOString().slice(0, 10)
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
export const toMinutes = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0) }
