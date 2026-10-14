// Home page: the live medal table (refreshes every POLL_MS).
import { getEvents, getMedals } from '../api.js'
import { POLL_MS } from '../config.js'
import { countryThai } from '../countries.js'
import { formatDate } from '../format.js'
import { animateNumbers, burst, countryChip, esc, flip, icon, poll, refreshRing, renderShell, skeletonRows, stateMessage, statusBadge, typeDot, wireRefreshRing } from '../ui.js'

renderShell('home')
const app = document.getElementById('app')
const COLS = '56px minmax(0, 1.6fr) repeat(3, 56px) 64px minmax(120px, 1fr)'
let medals = null, events = [], sortBy = 'gold', firstTable = true
let changes = {}           // country code -> { won: ['gold'], stamp }
let previous = null        // last table, to spot new medals


app.innerHTML = `
  <div class="stack" style="gap:32px">
    <section class="hero hero-photo anim-fade">
      <div class="photo-layer" aria-hidden="true"></div>
      <div class="hero-copy">
        <span class="eyebrow eyebrow-light"><span class="badge badge-live pulse">LIVE</span>Para Athletics Open</span>
        <h1>Live medal table</h1>
        <p class="th hero-th" lang="th">ตารางเหรียญรางวัล อัปเดตทุก ${Math.round(POLL_MS / 1000)} วินาที</p>
        <div class="hero-stats">
          <div><span class="num hero-num" data-num="medals" data-value="0"></span><span>Medals awarded</span></div>
          <div><span class="num hero-num" data-num="countries" data-value="0"></span><span>Countries on the table</span></div>
          <div><span class="num hero-num" data-num="decided" data-value="0"></span><span>Events decided</span></div>
        </div>
      </div>
    </section>
    <div id="leader"></div>
    <section class="card" aria-labelledby="mt-title">
      <div class="card-head">
        <div class="stack" style="gap:2px"><h2 id="mt-title">Medal table</h2><span class="small muted" id="sort-note">Ranked by gold, then silver, then bronze</span></div>
        <div class="row" style="flex-wrap:wrap">
          <div class="seg" role="group" aria-label="Sort the table">
            <button type="button" data-sort="gold" aria-pressed="true">By gold</button><button type="button" data-sort="total" aria-pressed="false">By total</button>
          </div>
          ${refreshRing('ring')}
        </div>
      </div>
      <div id="table">${skeletonRows(8)}</div>
    </section>
    <section aria-labelledby="now-title" class="stack" style="gap:16px">
      <div class="between"><h2 id="now-title">Happening now</h2><a href="competition.html" class="btn btn-ghost">Full schedule${icon('chevR', 18)}</a></div>
      <div class="grid-cards" id="now"></div>
    </section>
  </div>`
animateNumbers(app)

// Equal gold, silver and bronze share a place (shown as "=2").
function withRanks(rows) {
  const same = (a, b) => a && b && a.gold === b.gold && a.silver === b.silver && a.bronze === b.bronze
  let rank = 0
  return rows.map((r, i) => {
    if (!same(rows[i - 1], r)) rank = i + 1
    return { ...r, rank, tie: same(rows[i - 1], r) || same(r, rows[i + 1]) }
  })
}

function spotChanges(rows) {
  if (previous) {
    const stamp = Date.now()
    for (const r of rows) {
      const b = previous[r.code]
      if (!b) continue
      const won = ['gold', 'silver', 'bronze'].filter((m) => r[m] > b[m])
      if (won.length) {
        changes[r.code] = { won, stamp }
        setTimeout(() => { if (changes[r.code]?.stamp === stamp) { delete changes[r.code]; drawTable(false) } }, 2600)
      }
    }
  }
  previous = Object.fromEntries(rows.map((r) => [r.code, r]))
}

function drawTable(animateRows = true) {
  const box = document.getElementById('table')
  if (!medals) return
  if (medals.length === 0) { box.innerHTML = stateMessage({ title: 'No medals yet', text: 'Medals appear here as soon as the first final has a result.' }); return }
  const list = [...medals]
  if (sortBy === 'total') list.sort((a, b) => b.total - a.total || b.gold - a.gold || a.name.localeCompare(b.name))
  const rows = withRanks(list)
  const max = Math.max(1, ...rows.map((r) => r.total))
  const after = flip(box.querySelector('.flip-list'))
  box.innerHTML = `<div role="table" aria-label="Medal table" class="medal-table">
    <div role="row" class="table-head" style="grid-template-columns:${COLS}">
      <span role="columnheader">Rank</span><span role="columnheader">Country</span>
      <span role="columnheader" class="center"><span class="medal medal-gold" aria-label="Gold">G</span></span>
      <span role="columnheader" class="center"><span class="medal medal-silver" aria-label="Silver">S</span></span>
      <span role="columnheader" class="center"><span class="medal medal-bronze" aria-label="Bronze">B</span></span>
      <span role="columnheader" class="center">Total</span><span role="columnheader" class="hide-sm">Share</span>
    </div>
    <div class="flip-list">${rows.map((r, i) => {
      const ch = changes[r.code]
      return `<div role="row" data-key="${esc(r.code)}" class="table-row${firstTable ? ' anim-rise' : ''}${r.rank === 1 ? ' is-first' : ''}" style="grid-template-columns:${COLS};--i:${i}">
        ${ch && animateRows ? '<span class="flash-overlay" aria-hidden="true"></span>' : ''}
        <span role="cell" class="num rank-cell">${r.tie ? '=' : ''}${r.rank}</span>
        <span role="cell" class="row" style="min-width:0">${countryChip(r.code)}<span class="country-name">${esc(r.name)}</span>${ch ? `<span class="badge badge-live won-badge">+${ch.won.map((m) => m[0].toUpperCase()).join(' ')}</span>` : ''}</span>
        <span role="cell" class="center medal-count"><span class="num big" data-num="g-${esc(r.code)}" data-value="${r.gold}"></span>${ch?.won.includes('gold') && animateRows ? burst() : ''}</span>
        <span role="cell" class="center medal-count"><span class="num" data-num="s-${esc(r.code)}" data-value="${r.silver}"></span></span>
        <span role="cell" class="center medal-count"><span class="num" data-num="b-${esc(r.code)}" data-value="${r.bronze}"></span></span>
        <span role="cell" class="center"><span class="num total" data-num="t-${esc(r.code)}" data-value="${r.total}"></span></span>
        <span role="cell" class="hide-sm share" aria-hidden="true"><span class="share-bar${firstTable ? ' bar-grow' : ''}" style="--i:${i};width:${(r.total / max) * 100}%;transition:width .7s cubic-bezier(.2,.7,.2,1)">
          <span style="flex:${r.gold};background:var(--gold)"></span><span style="flex:${r.silver};background:var(--silver)"></span><span style="flex:${r.bronze};background:var(--bronze)"></span></span></span>
      </div>`
    }).join('')}</div></div>`
  firstTable = false
  animateNumbers(box)
  after()
  drawLeader(rows)
}

function drawLeader(rows) {
  const lead = rows[0], second = rows[1], box = document.getElementById('leader')
  if (!lead || lead.total === 0) { box.innerHTML = ''; return }
  const note = second && lead.gold > second.gold ? `${lead.gold - second.gold} gold ahead of ${second.name}` : second ? `Level on gold with ${second.name}` : 'The only country with medals so far'
  const fresh = !box.firstElementChild
  box.innerHTML = `<section class="leader card${fresh ? ' anim-rise' : ''}" aria-label="Leader">
    <span class="leader-crown">${icon('star', 28)}</span>
    <div class="stack" style="gap:4px;min-width:0"><span class="eyebrow">Leading the table</span>
      <div class="row" style="flex-wrap:wrap">${countryChip(lead.code)}<h2>${esc(lead.name)}</h2><span class="muted th" lang="th">${esc(countryThai(lead.code))}</span></div>
      <p class="muted">${esc(note)}</p></div>
    <div class="leader-medals">${['gold', 'silver', 'bronze'].map((m) => `<span class="leader-medal"><span class="medal medal-${m}">${m[0].toUpperCase()}</span><span class="num" data-num="lead-${m}" data-value="${lead[m]}"></span></span>`).join('')}</div>
  </section>`
  animateNumbers(box)
}

function drawStats() {
  const set = (k, v) => { const el = app.querySelector(`[data-num="${k}"]`); el.dataset.value = v }
  set('medals', (medals || []).reduce((s, r) => s + r.total, 0))
  set('countries', (medals || []).filter((r) => r.total > 0).length)
  set('decided', events.filter((e) => e.status === 'result').length)
  animateNumbers(app.querySelector('.hero-stats'))
}

function drawNow() {
  const live = events.filter((e) => e.status === 'live')
  const next = events.filter((e) => e.status === 'start-list').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3)
  const box = document.getElementById('now')
  const list = [...live, ...next]
  const key = list.map((e) => e.id + e.status).join()
  if (box.dataset.key === key) return // nothing changed: keep the cards still
  box.dataset.key = key
  box.innerHTML = list.length === 0 ? '<p class="muted">No events are running right now.</p>' : list.map((e, i) => `
    <a href="event.html?id=${encodeURIComponent(e.id)}" class="event-card card lift anim-rise${e.status === 'live' ? ' is-live' : ''}" style="--i:${i}">
      <div class="between">${statusBadge(e.status)}<span class="small muted">${esc(formatDate(e.date))} · ${esc(e.time)}</span></div>
      <h3>${esc(e.name)}</h3>
      <span class="row small muted" style="align-items:baseline">${typeDot(e.type)}<span>${esc(e.sport)} · ${esc(e.venue)}</span></span>
    </a>`).join('')
}

document.querySelector('[aria-label="Sort the table"]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]')
  if (!b) return
  sortBy = b.dataset.sort
  document.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', x === b))
  document.getElementById('sort-note').textContent = sortBy === 'gold' ? 'Ranked by gold, then silver, then bronze' : 'Ranked by total medals'
  drawTable(false)
})

const medalPoll = poll(getMedals, POLL_MS, {
  onData: (data) => { spotChanges(data); medals = data; drawTable(); drawStats() },
  onError: (err) => {
    if (medals) return // keep showing the last table; the ring turns red
    document.getElementById('table').innerHTML = stateMessage({ kind: 'error', title: "The medal table didn't load", text: err.message,
      action: `<button type="button" class="btn btn-primary" id="retry">${icon('refresh', 18)}Try again</button>` })
    document.getElementById('retry').addEventListener('click', () => medalPoll.refresh())
  },
  onTick: () => updateRing(),
})
const updateRing = wireRefreshRing('ring', medalPoll, POLL_MS)
poll(() => getEvents(), POLL_MS, { onData: (data) => { events = data; drawNow(); drawStats() } })
