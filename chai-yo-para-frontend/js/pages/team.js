// Team manager view: one delegation's athletes, events, results and medals.
import { getAthletes } from '../api.js'
import { POLL_MS } from '../config.js'
import { countryColor, countryFlag, countryName, countryThai } from '../countries.js'
import { loadEventsWithResults, medalTable, days } from '../data.js'
import { formatDate } from '../format.js'
import { renderAppShell, statCard } from '../manage-ui.js'
import { animateNumbers, countryChip, esc, icon, medalChip, poll, skeletonRows, statusBadge, typeDot } from '../ui.js'

renderAppShell({ active: 'team', title: 'Team manager view', th: 'มุมมองผู้จัดการทีม' })
const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
let country = params.get('country') || 'THA', athletes = [], events = null, lastKey = ''

app.innerHTML = `<div class="stack">
  <section class="between anim-rise">
    <div class="row" style="gap:16px"><img class="flag flag-lg" id="flag-img" src="flags/neutral.svg" alt="" width="64" height="48" style="width:64px;height:48px"><span class="country" id="flag" style="min-width:72px;height:48px;font-size:1.125rem;border-radius:10px"></span>
      <div class="stack" style="gap:2px"><h2 style="font-size:1.5rem" id="team-name"></h2><span class="muted th" lang="th" id="team-th"></span></div></div>
    <label class="field" style="min-width:240px"><span class="label">Delegation</span><select class="select" id="country"></select></label>
  </section>
  <section class="stats" id="stats"></section>
  <section class="card" aria-labelledby="ev-h"><div class="card-head"><h2 id="ev-h">Our athletes' events</h2><span class="small muted" id="ev-note"></span></div><div id="events">${skeletonRows(6)}</div></section>
  <div class="cols">
    <section class="card card-pad stack" style="gap:16px" aria-labelledby="mbd-h"><div class="between"><h2 id="mbd-h">Medals by day</h2>
      <div class="legend"><span><i style="background:var(--gold)"></i>Gold</span><span><i style="background:var(--silver)"></i>Silver</span><span><i style="background:var(--bronze)"></i>Bronze</span></div></div><div id="mbd"></div></section>
    <section class="card" aria-labelledby="roster-h"><div class="card-head"><h2 id="roster-h">Athletes</h2><a href="delegation.html" id="roster-link">Full delegation</a></div><div id="roster">${skeletonRows(6)}</div></section>
  </div>
</div>`

const countrySelect = document.getElementById('country')
countrySelect.addEventListener('change', () => {
  country = countrySelect.value
  history.replaceState(null, '', `?country=${country}`)
  lastKey = ''
  draw()
})

function draw() {
  if (!events) return
  const ours = athletes.filter((a) => a.country === country)
  const codes = [...new Set(athletes.map((a) => a.country))].sort()
  if (!countrySelect.options.length) countrySelect.innerHTML = codes.map((c) => `<option value="${c}">${esc(countryName(c))} (${c})</option>`).join('')
  countrySelect.value = country
  const key = JSON.stringify([country, events.map((e) => [e.id, e.status, e.results.map((r) => [r.rank, r.medal, r.score])])])
  if (key === lastKey) return
  const fresh = lastKey === '' ; lastKey = key
  document.getElementById('flag').style.background = countryColor(country)
  document.getElementById('flag').textContent = country
  document.getElementById('flag-img').src = countryFlag(country)
  document.getElementById('team-name').textContent = countryName(country)
  document.getElementById('team-th').textContent = countryThai(country)
  document.getElementById('roster-link').href = `delegation.html?country=${country}`

  const table = medalTable(events), row = table.find((r) => r.code === country) || { gold: 0, silver: 0, bronze: 0, total: 0 }
  const rank = table.findIndex((r) => r.code === country) + 1
  const ourEvents = events.filter((e) => e.participants.some((p) => p.country === country) || e.results.some((r) => r.country === country))
  document.getElementById('stats').innerHTML = [
    statCard({ label: 'Medal table', key: 't-rank', value: rank, note: rank ? `Place ${rank} of ${table.length}` : 'No medals yet', icon: 'medal', href: 'medals.html', i: 0 }),
    statCard({ label: 'Medals', key: 't-med', value: row.total, note: `${row.gold} gold · ${row.silver} silver · ${row.bronze} bronze`, icon: 'star', tone: 'warn', i: 1 }),
    statCard({ label: 'Events entered', key: 't-ev', value: ourEvents.length, note: `${ourEvents.filter((e) => e.status !== 'result').length} still to come`, icon: 'flag', i: 2 }),
    statCard({ label: 'Athletes', key: 't-ath', value: ours.length, note: 'In this delegation', icon: 'users', i: 3 }),
  ].join('')

  const list = ourEvents.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  document.getElementById('ev-note').textContent = `${list.length} events`
  const COLS = '96px minmax(0,1.6fr) minmax(0,1.6fr) minmax(0,1fr) 110px'
  document.getElementById('events').innerHTML = list.length === 0 ? '<p class="card-pad muted">No athletes from this delegation are entered yet.</p>' : `<div role="table" aria-label="Events with our athletes">
    <div role="row" class="table-head" style="grid-template-columns:${COLS}"><span role="columnheader">When</span><span role="columnheader">Event</span><span role="columnheader">Our athletes</span><span role="columnheader">Best result</span><span role="columnheader">Status</span></div>
    ${list.map((e, i) => {
      const mine = e.results.filter((r) => r.country === country)
      const names = (mine.length ? mine : e.participants.filter((p) => p.country === country)).map((r) => r.name)
      const best = mine.filter((r) => r.rank).sort((a, b) => a.rank - b.rank)[0]
      return `<div role="row" class="table-row${fresh ? ' anim-rise' : ''}" style="grid-template-columns:${COLS};--i:${Math.min(i, 10)}">
        <span role="cell" class="stack" style="gap:0"><span class="num" style="font-size:1.25rem">${esc(e.time)}</span><span class="small muted">${esc(formatDate(e.date, { weekday: 'short', day: 'numeric' }))}</span></span>
        <span role="cell" class="row" style="min-width:0;align-items:baseline">${typeDot(e.type)}<a href="event.html?id=${e.id}" class="athlete-link">${esc(e.name)}</a></span>
        <span role="cell" class="small">${esc(names.join(', '))}</span>
        <span role="cell" class="row">${best ? `${medalChip(best.medal, best.rank)}<span class="num" style="font-size:1.125rem">${esc(best.score)}</span>` : '<span class="muted small">–</span>'}</span>
        <span role="cell">${statusBadge(e.status)}</span></div>`
    }).join('')}</div>`

  const ds = days(events)
  const per = ds.map((d) => {
    const m = { gold: 0, silver: 0, bronze: 0 }
    events.filter((e) => e.date === d).forEach((e) => e.results.forEach((r) => { if (r.country === country && r.medal) m[r.medal] += 1 }))
    return [d, m]
  })
  const max = Math.max(1, ...per.map(([, m]) => m.gold + m.silver + m.bronze))
  document.getElementById('mbd').innerHTML = `<div class="stack" style="gap:14px" role="img" aria-label="${per.map(([d, m], i) => `Day ${i + 1}: ${m.gold} gold, ${m.silver} silver, ${m.bronze} bronze`).join('. ')}">${per.map(([d, m], i) => {
    const total = m.gold + m.silver + m.bronze
    return `<div class="hbar" style="grid-template-columns:110px minmax(0,1fr) 32px"><span class="stack" style="gap:0"><strong>Day ${i + 1}</strong><span class="small muted">${esc(formatDate(d))}</span></span>
      <span style="display:flex;gap:2px;height:32px;width:${(total / max) * 100}%;min-width:${total ? 0 : 4}px;transform-origin:left;animation:grow-x .8s cubic-bezier(.2,.7,.2,1) both;animation-delay:${i * 80}ms">${['gold', 'silver', 'bronze'].filter((k) => m[k]).map((k) =>
        `<span style="flex:${m[k]};background:var(--${k});color:#1A0E00;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;box-shadow:inset 0 0 0 1px rgba(26,14,0,.3)">${m[k]}</span>`).join('')}</span>
      <span class="num right" style="font-size:1.25rem">${total}</span></div>`
  }).join('')}</div>`

  document.getElementById('roster').innerHTML = ours.map((a) => {
    const medals = events.flatMap((e) => e.results.filter((r) => r.athleteId === a.id && r.medal))
    return `<a href="athlete.html?id=${a.id}" class="list-row" style="grid-template-columns:44px minmax(0,1fr) auto;text-decoration:none;color:var(--text)">
      <span class="avatar" style="width:44px;height:44px;font-size:.9375rem;--ring:${countryColor(a.country)}">${esc(a.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>
      <span class="stack" style="gap:0;min-width:0"><strong>${esc(a.name)}</strong><span class="small muted">${esc([a.classification, a.sport].filter(Boolean).join(' · '))}</span></span>
      <span class="row" style="gap:4px">${medals.map((r) => `<span class="medal medal-${r.medal}" aria-label="${r.medal} medal" style="width:24px;height:24px;font-size:.6875rem">${r.medal[0].toUpperCase()}</span>`).join('')}</span></a>`
  }).join('') || '<p class="card-pad muted">No athletes yet.</p>'
  animateNumbers(app)
}

getAthletes().then((a) => { athletes = a; draw() })
poll(loadEventsWithResults, POLL_MS, { onData: (data) => { events = data; draw() } })
