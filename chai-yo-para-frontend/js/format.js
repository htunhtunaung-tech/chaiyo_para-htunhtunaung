export function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', opts)
}
export function formatTime(t) {
  if (!t) return ''
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5)
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? t : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}
export function genderLabel(g) {
  return { M: 'Men', F: 'Women', X: 'Mixed', male: 'Men', female: 'Women', mixed: 'Mixed', men: 'Men', women: 'Women' }[g] || g || ''
}
export function groupBy(list, keyFn) {
  const out = new Map()
  for (const item of list) {
    const k = keyFn(item)
    if (!out.has(k)) out.set(k, [])
    out.get(k).push(item)
  }
  return [...out.entries()]
}
export function secondsAgo(date) {
  if (!date) return ''
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  return s < 5 ? 'just now' : `${s} s ago`
}
