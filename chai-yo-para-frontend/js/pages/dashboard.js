// Admin dashboard: what needs attention, today's events, finals by day, medal leaders.
import { getAthletes, getJudges, isMock } from '../api.js'
import { POLL_MS } from '../config.js'
import { loadEventsWithResults, medalTable, days, today } from '../data.js'
import { getBookings } from '../demo-data.js'
import { formatDate } from '../format.js'
import { renderAppShell, statCard } from '../manage-ui.js'
import { animateNumbers, countryChip, esc, icon, poll, skeletonRows, statusBadge, TYPE_COLOR, typeDot } from '../ui.js'

const pendingBookings = getBookings().filter((b) => b.status === 'pending').length
renderAppShell({ active: 'dashboard', title: 'Dashboard', th: 'แดชบอร์ดผู้ดูแลการแข่งขัน', badges: { venues: pendingBookings || '' } })
const app = document.getElementById('app')
let athletesCount = 0, firstDraw = true, lastKey = '', pendingJudges = []

app.innerHTML = `<div class="stack">
  <section class="between anim-rise photo-banner" style="--pos:center 62%">
    <div class="photo-layer" aria-hidden="true" style="background-image:url('images/banner-blocks.webp')"></div>
    <div class="stack" style="gap:4px"><span class="eyebrow">Para Athletics Open · Staff dashboard</span><h2 style="font-size:1.75rem">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</h2>
      <p class="muted" id="summary">Loading the meet…</p></div>
    <div class="row" style="flex-wrap:wrap"><a href="announcements.html" class="btn">${icon('mega', 18)}New announcement</a><a href="events-admin.html?new=1" class="btn btn-primary">${icon('plus', 18)}New event</a></div>
  </section>
  <section class="stats" id="stats">${skeletonRows(1)}</section>
  <div class="cols">
    <section class="card" aria-labelledby="att-h"><div class="card-head"><h2 id="att-h">Needs your attention</h2><span class="badge badge-live" id="att-count">…</span></div><div id="attention">${skeletonRows(4)}</div></section>
    <section class="card" aria-labelledby="next-h"><div class="card-head"><h2 id="next-h">Coming up</h2><a href="timetable.html">Timetable</a></div><div id="next">${skeletonRows(4)}</div></section>
  </div>
  <div class="cols">
    <section class="card card-pad stack" aria-labelledby="fin-h" style="gap:16px">
      <div class="between"><div class="stack" style="gap:2px"><h2 id="fin-h">Finals by day</h2><span class="small muted" id="fin-note"></span></div>
        <div class="legend"><span><i style="background:var(--track)"></i>Track</span><span><i style="background:var(--field)"></i>Field</span><span><i style="background:var(--road)"></i>Road</span></div></div>
      <div id="chart"></div>
    </section>
    <section class="card" aria-labelledby="lead-h"><div class="card-head"><h2 id="lead-h">Medal leaders</h2><a href="medals.html">All medals</a></div><div id="leaders">${skeletonRows(5)}</div></section>
  </div>
</div>`

function draw(events) {
  const key = JSON.stringify([athletesCount, pendingJudges.map((u) => u.id), events.map((e) => [e.id, e.status, e.results.map((r) => [r.rank, r.medal])])])
  if (key === lastKey) return // nothing changed: keep the page still
  lastKey = key
  const decided = events.filter((e) => e.status === 'result').length
  const live = events.filter((e) => e.status === 'live')
  const needMedals = events.filter((e) => e.status === 'result' && e.results.some((r) => r.rank) && !e.results.some((r) => r.medal))
  const pending = getBookings().filter((b) => b.status === 'pending')
  const users = pendingJudges
  document.getElementById('summary').textContent = `${live.length} ${live.length === 1 ? 'event is' : 'events are'} live now. ${decided} of ${events.length} events have results.`

  document.getElementById('stats').innerHTML = [
    statCard({ label: 'Athletes', key: 'd-ath', value: athletesCount, note: 'Across all delegations', icon: 'users', href: 'delegation.html', i: 0 }),
    statCard({ label: 'Events decided', key: 'd-dec', value: decided, note: `of ${events.length} events`, icon: 'flag', href: 'events-admin.html', i: 1 }),
    statCard({ label: 'Live now', key: 'd-live', value: live.length, note: 'Results being entered', icon: 'timer', tone: 'warn', href: 'results-entry.html', i: 2 }),
    statCard({ label: 'Waiting for you', key: 'd-wait', value: pending.length + users.length + needMedals.length, note: 'Bookings, accounts and medals', icon: 'bell', tone: 'warn', i: 3 }),
  ].join('')
  if (!firstDraw) document.querySelectorAll('#stats .anim-rise').forEach((el) => el.classList.remove('anim-rise'))
  const pct = events.length ? Math.round((decided / events.length) * 100) : 0
  document.querySelector('#stats .stat:nth-child(2)').insertAdjacentHTML('beforeend', `<span class="progress" aria-hidden="true"><span style="width:${pct}%"></span></span>`)

  const items = [
    ...live.map((e) => ['warn', 'timer', e.name, 'Live now. Enter results as they come in.', `results-entry.html?id=${e.id}`, 'Enter results', 'Live']),
    ...needMedals.map((e) => ['info', 'medal', e.name, 'Results are in but no medals are set.', `results-entry.html?id=${e.id}`, 'Set medals', 'Medals']),
    ...(pending.length ? [['danger', 'pin', `${pending.length} venue ${pending.length === 1 ? 'request' : 'requests'}`, pending.map((b) => `${b.team} · ${b.facility}`).slice(0, 3).join(', '), 'venues.html', 'Review', 'Venues']] : []),
    ...(users.length ? [['info', 'users', `${users.length} judge ${users.length === 1 ? 'request' : 'requests'} waiting`, users.map((u) => u.username).slice(0, 3).join(', '), 'admin.html', 'Open', 'Accounts']] : []),
  ]
  document.getElementById('att-count').textContent = `${items.length} open`
  document.getElementById('attention').innerHTML = items.length === 0 ? '<p class="card-pad muted">Nothing needs you right now.</p>' : items.map(([tone, ic, title, text, href, cta, tag], i) => `
    <div class="list-row${firstDraw ? ' anim-rise' : ''}" style="--i:${i}">
      <span class="icon-tile tone-${tone}">${icon(ic, 22)}</span>
      <span class="stack" style="gap:2px;min-width:0"><span class="row" style="flex-wrap:wrap"><strong>${esc(title)}</strong><span class="badge badge-${tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'info'}">${tag}</span></span><span class="small muted">${esc(text)}</span></span>
      <a href="${href}" class="btn">${cta}</a></div>`).join('')

  const upcoming = events.filter((e) => e.status !== 'result').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6)
  document.getElementById('next').innerHTML = upcoming.map((e, i) => `
    <a href="events-admin.html?id=${e.id}" class="list-row" style="grid-template-columns:64px minmax(0,1fr) auto;text-decoration:none;color:var(--text)">
      <span class="stack" style="gap:0"><span class="num" style="font-size:1.25rem">${esc(e.time)}</span><span class="small muted">${esc(formatDate(e.date, { day: 'numeric', month: 'short' }))}</span></span>
      <span class="stack" style="gap:2px;min-width:0"><strong>${esc(e.name)}</strong><span class="row small muted" style="align-items:baseline">${typeDot(e.type)}<span>${esc(e.venue)} · ${e.results.length || 0} athletes</span></span></span>
      ${statusBadge(e.status)}</a>`).join('') || '<p class="card-pad muted">Every event has finished.</p>'

  const ds = days(events), max = Math.max(1, ...ds.map((d) => events.filter((e) => e.date === d).length))
  document.getElementById('fin-note').textContent = `${events.length} events over ${ds.length} days`
  document.getElementById('chart').innerHTML = `<div role="img" aria-label="${ds.map((d, i) => `Day ${i + 1}: ${events.filter((e) => e.date === d).length} events`).join('. ')}">
    <div class="bars" style="grid-template-columns:repeat(${ds.length}, minmax(0, 1fr))">${ds.map((d, i) => {
      const segs = ['road', 'field', 'track'].map((t) => [t, events.filter((e) => e.date === d && e.type === t).length]).filter(([, n]) => n)
      const total = segs.reduce((s, [, n]) => s + n, 0)
      return `<div class="bar-col"><span class="num" style="font-size:1.25rem">${total}</span><div class="bar-stack${firstDraw ? '' : ''}" style="--i:${i};height:${(total / max) * 170}px">${segs.map(([t, n]) =>
        `<span style="flex:${n};background:${TYPE_COLOR[t]};color:${t === 'track' ? '#fff' : '#1A0E00'}">${n}</span>`).join('')}</div></div>`
    }).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(${ds.length}, minmax(0, 1fr));gap:20px;text-align:center;margin-top:8px">${ds.map((d, i) =>
      `<span class="stack" style="gap:0"><strong>Day ${i + 1}</strong><span class="small muted">${esc(formatDate(d, { weekday: 'short', day: 'numeric' }))}${d === today() ? ' · today' : ''}</span></span>`).join('')}</div></div>`

  const table = medalTable(events).slice(0, 5)
  document.getElementById('leaders').innerHTML = table.length === 0 ? '<p class="card-pad muted">No medals yet.</p>' : `<div role="table" aria-label="Medal leaders">${table.map((r, i) => `
    <div role="row" class="table-row" style="grid-template-columns:28px minmax(0,1fr) repeat(3, 36px) 44px">
      <span role="cell" class="num" style="font-size:1.25rem;color:var(--text-2)">${i + 1}</span><span role="cell">${countryChip(r.code, true)}</span>
      <span role="cell" class="center"><span class="medal medal-gold">${r.gold}</span></span><span role="cell" class="center"><span class="medal medal-silver">${r.silver}</span></span>
      <span role="cell" class="center"><span class="medal medal-bronze">${r.bronze}</span></span><span role="cell" class="right num" style="font-size:1.25rem">${r.total}</span></div>`).join('')}</div>`
  animateNumbers(app)
  firstDraw = false
}

getAthletes().then((a) => { athletesCount = a.length }).catch(() => {})
// Judge requests waiting for approval are real accounts (admins only; judges just get an empty list).
async function refreshPending() {
  if (isMock) return
  try { pendingJudges = await getJudges('pending') } catch { pendingJudges = [] }
  const link = document.querySelector('a[href="admin.html"]')
  if (link && !link.querySelector('.side-badge')) { if (pendingJudges.length) link.insertAdjacentHTML('beforeend', `<span class="side-badge">${pendingJudges.length}</span>`) }
  else if (link) { const b = link.querySelector('.side-badge'); if (pendingJudges.length) b.textContent = pendingJudges.length; else b.remove() }
}
poll(async () => { const evs = await loadEventsWithResults(); await refreshPending(); return evs }, POLL_MS, { onData: draw, onError: (err) => { document.getElementById('summary').textContent = err.message } })
