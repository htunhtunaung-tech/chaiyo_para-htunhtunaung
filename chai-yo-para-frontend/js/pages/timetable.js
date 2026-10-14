// Timetable: one day, one column per venue, events placed by start time.
import { getEvents } from '../api.js'
import { POLL_MS } from '../config.js'
import { days, nowMinutes, today, toMinutes } from '../data.js'
import { formatDate } from '../format.js'
import { renderAppShell, eventLink, isAdmin } from '../manage-ui.js'
import { esc, icon, poll, skeletonRows, statusBadge, TYPE_COLOR } from '../ui.js'

renderAppShell({ active: 'timetable', title: 'Timetable', th: 'ตารางเวลาการแข่งขัน' })
const app = document.getElementById('app')
const PX = 2.6 // pixels per minute
const LENGTH = { track: 15, field: 75, road: 120 } // how long each kind of event usually runs, in minutes
let events = null, day = new URLSearchParams(location.search).get('day') || '', group = '', lastKey = ''

app.innerHTML = `<div class="stack">
  <section class="between anim-rise">
    <div class="chips" role="tablist" aria-label="Competition day" id="days"></div>
    <div class="row" style="flex-wrap:wrap">
      <div class="seg" role="group" aria-label="Event group" id="groups">${[['', 'All'], ['track', 'Track'], ['field', 'Field'], ['road', 'Road']].map(([v, l]) => `<button type="button" data-g="${v}" aria-pressed="${v === ''}">${l}</button>`).join('')}</div>
      ${isAdmin() ? `<a href="events-admin.html?new=1" class="btn btn-primary">${icon('plus', 18)}Add event</a>` : ''}</div>
  </section>
  <section class="card card-pad anim-rise" style="--i:1;overflow-x:auto" aria-labelledby="tt-h">
    <div class="between" style="margin-bottom:12px"><h2 id="tt-h">Timetable</h2>
      <div class="legend"><span>${statusBadge('result')}</span><span>${statusBadge('live')}</span><span>${statusBadge('start-list')}</span></div></div>
    <div id="tt">${skeletonRows(6)}</div>
  </section>
</div>`

function draw() {
  if (!events) return
  const ds = days(events)
  if (!day || !ds.includes(day)) day = ds.includes(today()) ? today() : ds[0]
  const key = JSON.stringify([day, group, events.map((e) => [e.id, e.status, e.time, e.venue])]) + (day === today() ? Math.floor(nowMinutes() / 5) : '')
  if (key === lastKey) return
  lastKey = key
  document.getElementById('days').innerHTML = ds.map((d, i) => `<button type="button" role="tab" class="chip day-chip" data-day="${d}" aria-selected="${d === day}" aria-pressed="${d === day}">
    <span class="num">Day ${i + 1}</span><span class="small">${esc(formatDate(d))}${d === today() ? ' · today' : ''}</span></button>`).join('')
  const list = events.filter((e) => e.date === day && (!group || e.type === group))
  const box = document.getElementById('tt')
  if (list.length === 0) { box.innerHTML = '<p class="muted">No events on this day for this group.</p>'; return }
  const venues = [...new Set(list.map((e) => e.venue || 'Venue to be confirmed'))]
  const starts = list.map((e) => toMinutes(e.time)), ends = list.map((e) => toMinutes(e.time) + (LENGTH[e.type] || 30))
  const from = Math.floor(Math.min(...starts) / 60) * 60, to = Math.ceil(Math.max(...ends) / 60) * 60
  const height = (to - from) * PX
  const cols = `64px repeat(${venues.length}, minmax(180px, 1fr))`
  const ticks = []
  for (let m = from; m <= to; m += 30) ticks.push(m)
  const label = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const now = day === today() ? nowMinutes() : null
  box.innerHTML = `<div style="min-width:${64 + venues.length * 190}px">
    <div style="display:grid;grid-template-columns:${cols};gap:8px;padding-bottom:8px;border-bottom:2px solid var(--border-strong)"><span></span>${venues.map((v) => `<strong style="padding-left:6px">${esc(v)}</strong>`).join('')}</div>
    <div class="tt" style="grid-template-columns:${cols};height:${height}px;margin:12px 0;background-image:repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${30 * PX}px)">
      <div style="position:relative">${ticks.map((m) => `<span class="num small" style="position:absolute;top:${(m - from) * PX}px;transform:translateY(2px);color:var(--text-2);font-size:.9375rem">${label(m)}</span>`).join('')}</div>
      ${venues.map((v) => `<div class="tt-col">${list.filter((e) => (e.venue || 'Venue to be confirmed') === v).map((e, i) => {
        const len = LENGTH[e.type] || 30, h = Math.max(len * PX - 4, 30), tall = h >= 64
        return `<a href="${eventLink(e.id)}" class="tt-block${e.status === 'live' ? ' is-live' : e.status === 'result' ? ' is-done' : ''}" style="--type:${TYPE_COLOR[e.type] || 'var(--border-strong)'};--i:${i};top:${(toMinutes(e.time) - from) * PX}px;height:${h}px">
          ${tall ? `<span class="row" style="justify-content:space-between;gap:6px"><span class="num" style="font-size:.9375rem">${esc(e.time)}</span>${e.status === 'live' ? '<span class="badge badge-live pulse" style="height:18px;font-size:.6875rem">LIVE</span>' : e.status === 'result' ? `<span style="color:var(--ok)" aria-label="Results in">${icon('check', 14)}</span>` : ''}</span><strong>${esc(e.name)}</strong><span class="muted">${e.participants.length} athletes</span>`
            : `<span class="row" style="gap:8px;flex-wrap:nowrap;min-width:0"><span class="num" style="font-size:.9375rem;flex:none">${esc(e.time)}</span><strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</strong>${e.status === 'live' ? '<span class="badge badge-live pulse" style="height:18px;font-size:.6875rem">LIVE</span>' : e.status === 'result' ? `<span style="color:var(--ok)" aria-label="Results in">${icon('check', 14)}</span>` : ''}</span>`}</a>`
      }).join('')}</div>`).join('')}
      ${now !== null && now >= from && now <= to ? `<div class="tt-now" style="top:${(now - from) * PX}px" aria-hidden="true"><span>${label(now)}</span></div>` : ''}
    </div></div>`
}

app.addEventListener('click', (e) => {
  const d = e.target.closest('[data-day]'), g = e.target.closest('[data-g]')
  if (d) { day = d.dataset.day; history.replaceState(null, '', `?day=${day}`); draw() }
  if (g) { group = g.dataset.g; document.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', b === g)); draw() }
})
poll(() => getEvents(), POLL_MS, { onData: (data) => { events = data; draw() } })
setInterval(draw, 60000)
