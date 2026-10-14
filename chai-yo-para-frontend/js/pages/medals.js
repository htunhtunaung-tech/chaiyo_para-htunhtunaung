// Medals and statistics: medal table by event group, medals by day, top athletes.
import { POLL_MS } from '../config.js'
import { countryColor, countryName } from '../countries.js'
import { days, loadEventsWithResults, medalTable } from '../data.js'
import { formatDate } from '../format.js'
import { downloadCSV, renderAppShell, statCard } from '../manage-ui.js'
import { animateNumbers, countryChip, esc, flip, icon, poll, skeletonRows, stateMessage } from '../ui.js'

renderAppShell({ active: 'medals', title: 'Medals and statistics', th: 'ตารางเหรียญและสถิติ' })
const app = document.getElementById('app')
let events = null, group = '', lastKey = '', first = true

app.innerHTML = `<div class="stack">
  <section class="between anim-rise">
    <div class="chips" role="tablist" aria-label="Event group">${[['', 'All events'], ['track', 'Track'], ['field', 'Field'], ['road', 'Road']].map(([v, l]) =>
      `<button type="button" role="tab" class="chip" data-g="${v}" aria-selected="${v === ''}" aria-pressed="${v === ''}">${v ? `<span class="dot" style="background:var(--${v})"></span>` : ''}${l}</button>`).join('')}</div>
    <button type="button" class="btn" id="export">${icon('down', 18)}Export medal table (CSV)</button>
  </section>
  <section class="stats" id="stats"></section>
  <div class="cols">
    <section class="card" aria-labelledby="mt-h"><div class="card-head"><h2 id="mt-h">Medal table</h2><span class="small muted">Gold first, then silver, then bronze</span></div><div id="table">${skeletonRows(8)}</div></section>
    <div class="stack">
      <section class="card card-pad stack" style="gap:16px" aria-labelledby="day-h"><div class="between"><h2 id="day-h">Medals by day</h2>
        <div class="legend"><span><i style="background:var(--gold)"></i>Gold</span><span><i style="background:var(--silver)"></i>Silver</span><span><i style="background:var(--bronze)"></i>Bronze</span></div></div><div id="byday"></div></section>
      <section class="card card-pad stack" style="gap:12px" aria-labelledby="top-h"><h2 id="top-h">Top athletes</h2><div id="top" class="stack" style="gap:10px"></div></section>
    </div>
  </div>
</div>`

const COLS = '40px minmax(0,2fr) repeat(3, 44px) 52px minmax(80px,1fr)'
const COLS_BIG = '48px minmax(0,1fr) repeat(3, 52px) 64px' // largest text: the share bars make way for country names
function draw() {
  if (!events) return
  const key = JSON.stringify([group, events.map((e) => [e.id, e.status, e.results.map((r) => r.medal)])])
  if (key === lastKey) return
  lastKey = key
  const scoped = events.filter((e) => !group || e.type === group)
  const table = medalTable(events, group)
  const medals = table.reduce((s, r) => s + r.total, 0)
  document.getElementById('stats').innerHTML = [
    statCard({ label: 'Events decided', key: `m-dec`, value: scoped.filter((e) => e.status === 'result').length, note: `of ${scoped.length} events`, icon: 'flag', i: 0 }),
    statCard({ label: 'Medals awarded', key: `m-med`, value: medals, note: `${table.reduce((s, r) => s + r.gold, 0)} gold`, icon: 'medal', tone: 'warn', i: 1 }),
    statCard({ label: 'Countries with medals', key: `m-cty`, value: table.length, icon: 'globe', i: 2 }),
    statCard({ label: 'Athletes on the podium', key: `m-ath`, value: new Set(scoped.flatMap((e) => e.results.filter((r) => r.medal).map((r) => r.athleteId))).size, icon: 'users', tone: 'ok', i: 3 }),
  ].join('')
  if (!first) document.querySelectorAll('#stats .anim-rise').forEach((el) => el.classList.remove('anim-rise'))

  const box = document.getElementById('table'), max = Math.max(1, ...table.map((r) => r.total))
  const after = flip(box.querySelector('.flip-list'))
  box.innerHTML = table.length === 0 ? stateMessage({ title: 'No medals yet', text: group ? `No ${group} event has medals yet.` : 'Medals appear here when results have medals set.' }) : `<div role="table" aria-label="Medal table" class="medals-tbl" style="--cols:${COLS};--cols-big:${COLS_BIG}">
    <div role="row" class="table-head" style="grid-template-columns:var(--cols)"><span role="columnheader">Rank</span><span role="columnheader">Country</span>
      <span role="columnheader" class="center"><span class="medal medal-gold" aria-label="Gold">G</span></span><span role="columnheader" class="center"><span class="medal medal-silver" aria-label="Silver">S</span></span>
      <span role="columnheader" class="center"><span class="medal medal-bronze" aria-label="Bronze">B</span></span><span role="columnheader" class="center">Total</span><span role="columnheader" class="share-col">Share</span></div>
    <div class="flip-list">${table.map((r, i) => `<div role="row" data-key="${r.code}" class="table-row${first ? ' anim-rise' : ''}${i === 0 ? ' is-first' : ''}" style="grid-template-columns:var(--cols);--i:${i}">
      <span role="cell" class="num rank-cell">${i + 1}</span><span role="cell">${countryChip(r.code, true)}</span>
      <span role="cell" class="center num" style="font-size:1.5rem"><span data-num="mg-${r.code}-${group}" data-value="${r.gold}"></span></span>
      <span role="cell" class="center num" style="font-size:1.25rem"><span data-num="ms-${r.code}-${group}" data-value="${r.silver}"></span></span>
      <span role="cell" class="center num" style="font-size:1.25rem"><span data-num="mb-${r.code}-${group}" data-value="${r.bronze}"></span></span>
      <span role="cell" class="center num total"><span data-num="mt-${r.code}-${group}" data-value="${r.total}"></span></span>
      <span role="cell" aria-hidden="true" class="share-col"><span class="share-bar bar-grow" style="--i:${i};width:${(r.total / max) * 100}%"><span style="flex:${r.gold};background:var(--gold)"></span><span style="flex:${r.silver};background:var(--silver)"></span><span style="flex:${r.bronze};background:var(--bronze)"></span></span></span></div>`).join('')}</div></div>`
  after()

  const ds = days(scoped)
  const per = ds.map((d) => { const m = { gold: 0, silver: 0, bronze: 0 }; scoped.filter((e) => e.date === d).forEach((e) => e.results.forEach((r) => { if (r.medal) m[r.medal] += 1 })); return [d, m] })
  const dmax = Math.max(1, ...per.map(([, m]) => m.gold + m.silver + m.bronze))
  document.getElementById('byday').innerHTML = `<div role="img" aria-label="${per.map(([, m], i) => `Day ${i + 1}: ${m.gold + m.silver + m.bronze} medals`).join('. ')}">
    <div class="bars" style="grid-template-columns:repeat(${ds.length}, minmax(0,1fr));height:200px">${per.map(([d, m], i) => {
      const t = m.gold + m.silver + m.bronze
      return `<div class="bar-col"><span class="num" style="font-size:1.25rem">${t}</span><div class="bar-stack" style="--i:${i};height:${(t / dmax) * 150}px">${['bronze', 'silver', 'gold'].filter((k) => m[k]).map((k) =>
        `<span style="flex:${m[k]};background:var(--${k});color:#1A0E00;box-shadow:inset 0 0 0 1px rgba(26,14,0,.3)">${m[k]}</span>`).join('')}</div></div>`
    }).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(${ds.length}, minmax(0,1fr));gap:20px;text-align:center;margin-top:8px">${ds.map((d, i) => `<span class="stack" style="gap:0"><strong>Day ${i + 1}</strong><span class="small muted">${esc(formatDate(d, { weekday: 'short', day: 'numeric' }))}</span></span>`).join('')}</div></div>`

  const ath = {}
  scoped.forEach((e) => e.results.forEach((r) => { if (!r.medal) return; ath[r.athleteId] ??= { name: r.name, country: r.country, gold: 0, silver: 0, bronze: 0, id: r.athleteId }; ath[r.athleteId][r.medal] += 1 }))
  const top = Object.values(ath).sort((a, b) => b.gold - a.gold || (b.gold + b.silver + b.bronze) - (a.gold + a.silver + a.bronze)).slice(0, 6)
  document.getElementById('top').innerHTML = top.length === 0 ? '<p class="muted">No medallists yet.</p>' : top.map((a, i) => `
    <a href="athlete.html?id=${a.id}" class="row anim-rise" style="--i:${i};justify-content:space-between;text-decoration:none;color:var(--text);padding:8px 0;border-top:${i ? '1px solid var(--border)' : '0'}">
      <span class="row" style="min-width:0"><span class="avatar" style="width:40px;height:40px;font-size:.875rem;--ring:${countryColor(a.country)}">${esc(a.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>
        <span class="stack" style="gap:0;min-width:0"><strong>${esc(a.name)}</strong><span class="small muted">${esc(countryName(a.country))}</span></span></span>
      <span class="row" style="gap:4px">${['gold', 'silver', 'bronze'].flatMap((m) => Array(a[m]).fill(`<span class="medal medal-${m}" style="width:24px;height:24px;font-size:.6875rem" aria-label="${m}">${m[0].toUpperCase()}</span>`)).join('')}</span></a>`).join('')
  animateNumbers(app)
  first = false
}

app.addEventListener('click', (e) => {
  const g = e.target.closest('[data-g]')
  if (!g) return
  group = g.dataset.g
  document.querySelectorAll('[data-g]').forEach((b) => { b.setAttribute('aria-pressed', b === g); b.setAttribute('aria-selected', b === g) })
  first = true; draw()
})
document.getElementById('export').addEventListener('click', () => {
  const t = medalTable(events || [], group)
  downloadCSV(`medal-table${group ? `-${group}` : ''}.csv`, [['Rank', 'Country', 'Code', 'Gold', 'Silver', 'Bronze', 'Total'], ...t.map((r, i) => [i + 1, r.name, r.code, r.gold, r.silver, r.bronze, r.total])])
})
poll(loadEventsWithResults, POLL_MS, { onData: (d) => { events = d; draw() }, onError: (err) => { if (!events) document.getElementById('table').innerHTML = stateMessage({ kind: 'error', title: "Medals didn't load", text: err.message }) } })
