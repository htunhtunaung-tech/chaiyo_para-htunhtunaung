// Competition page: schedule and results with filters.
// Filters are kept in the address bar (?sport_type=track&gender=F&date=...&status=live).
import { getEvents } from '../api.js'
import { GENDER_OPTIONS, POLL_MS, SPORT_TYPE_OPTIONS } from '../config.js'
import { formatDate, genderLabel, groupBy } from '../format.js'
import { esc, icon, pageHeader, poll, refreshRing, renderShell, skeletonRows, stateMessage, statusBadge, TYPE_COLOR, typeDot, wireRefreshRing } from '../ui.js'

renderShell('competition')
const app = document.getElementById('app')
const STATUS_TABS = [['', 'All'], ['live', 'Live now'], ['start-list', 'Coming up'], ['result', 'Results']]
const params = new URLSearchParams(location.search)
const f = { sport_type: params.get('sport_type') || '', gender: params.get('gender') || '', date: params.get('date') || '', status: params.get('status') || '' }
let days = [], events = null, firstDraw = true

app.innerHTML = `<div class="stack">
  ${pageHeader({ title: 'Competition', th: 'ตารางการแข่งขันและผลการแข่งขัน', eyebrow: 'Schedule and results', right: refreshRing('ring'), photo: 'images/banner-blocks.webp', pos: 'center 60%' })}
  <section class="card card-pad filters anim-rise" aria-label="Filters" style="--i:1">
    <div class="stack" style="gap:8px"><span class="label">Day</span><div class="chips" id="days"></div></div>
    <div class="filters-row">
      <div class="stack" style="gap:8px"><span class="label">Event group</span><div class="chips">
        ${SPORT_TYPE_OPTIONS.map((o) => `<button type="button" class="chip" data-f="sport_type" data-v="${o.value}">${o.value ? `<span class="dot" style="background:${TYPE_COLOR[o.value]}"></span>` : ''}${o.label}</button>`).join('')}
      </div></div>
      <div class="stack" style="gap:8px"><span class="label">Gender</span><div class="seg" role="group" aria-label="Gender">
        ${GENDER_OPTIONS.map((o) => `<button type="button" data-f="gender" data-v="${o.value}">${o.label}</button>`).join('')}
      </div></div>
    </div>
  </section>
  <div class="tabs" role="tablist" aria-label="Status">
    ${STATUS_TABS.map(([k, label]) => `<button type="button" role="tab" class="tab-btn" data-f="status" data-v="${k}">${k === 'live' ? '<span class="dot pulse" style="background:var(--accent)"></span>' : ''}${label}<span class="tab-count" data-count="${k}">0</span></button>`).join('')}
  </div>
  <div id="list"><div class="card">${skeletonRows(6)}</div></div>
</div>`

function syncButtons() {
  app.querySelectorAll('[data-f]').forEach((b) => {
    const on = f[b.dataset.f] === b.dataset.v
    b.setAttribute(b.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', on)
  })
}
function drawDays() {
  document.getElementById('days').innerHTML = `<button type="button" class="chip" data-f="date" data-v="">All days</button>` +
    days.map((d, i) => `<button type="button" class="chip day-chip" data-f="date" data-v="${esc(d)}"><span class="num">Day ${i + 1}</span><span class="small">${esc(formatDate(d))}</span></button>`).join('')
  syncButtons()
}

function drawList() {
  const box = document.getElementById('list')
  if (!events) return
  STATUS_TABS.forEach(([k]) => { app.querySelector(`[data-count="${k}"]`).textContent = events.filter((e) => !k || e.status === k).length })
  const shown = events.filter((e) => !f.status || e.status === f.status).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const key = shown.map((e) => e.id + e.status).join()
  if (box.dataset.key === key) return // nothing new: don't redraw (keeps scroll and focus)
  box.dataset.key = key
  if (shown.length === 0) {
    box.innerHTML = stateMessage({ kind: 'search', title: 'No events match these filters', text: 'Try another day or event group.', action: '<button type="button" class="btn" id="clear">Clear filters</button>' })
    document.getElementById('clear').addEventListener('click', () => { Object.keys(f).forEach((k) => { f[k] = '' }); changed() })
    return
  }
  const anim = firstDraw ? ' anim-rise' : ''
  firstDraw = false
  box.innerHTML = groupBy(shown, (e) => e.date || 'Date to be confirmed').map(([date, evs], g) => {
    const long = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
    return `<section class="stack" style="gap:12px;margin-bottom:24px" aria-label="${esc(long)}">
      <h2 class="day-title${anim}" style="--i:${g}">${esc(long)}<span class="small muted">${evs.length} ${evs.length === 1 ? 'event' : 'events'}</span></h2>
      <ol class="timeline">${evs.map((e, i) => `<li class="${anim.trim()}" style="--i:${i}">
        <a href="event.html?id=${encodeURIComponent(e.id)}" class="event-row card lift${e.status === 'live' ? ' is-live' : ''}" style="--type:${TYPE_COLOR[e.type] || 'var(--border-strong)'}">
          <span class="num event-time">${esc(e.time || '--:--')}</span>
          <span class="stack" style="gap:2px;min-width:0"><span class="event-name">${esc(e.name)}</span>
            <span class="row small muted" style="align-items:baseline">${typeDot(e.type)}<span>${esc([e.sport, genderLabel(e.gender), e.venue].filter(Boolean).join(' · '))}</span></span></span>
          <span class="row event-end">${statusBadge(e.status)}${icon('chevR')}</span>
        </a></li>`).join('')}</ol></section>`
  }).join('')
}

function changed() {
  const p = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
  history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`)
  syncButtons()
  firstDraw = true
  document.getElementById('list').dataset.key = ''
  listPoll.refresh()
}
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]')
  if (!b) return
  f[b.dataset.f] = b.dataset.v
  if (b.dataset.f === 'status') { syncButtons(); drawList(); history.replaceState(null, '', `${location.pathname}?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`); return }
  changed()
})

syncButtons()
poll(() => getEvents(), 0, { onData: (all) => { days = [...new Set(all.map((e) => e.date).filter(Boolean))].sort(); drawDays() } })
const listPoll = poll(() => getEvents({ sport_type: f.sport_type, gender: f.gender, date: f.date }), POLL_MS, {
  onData: (data) => { events = data; drawList() },
  onError: (err) => {
    if (events) return
    document.getElementById('list').innerHTML = stateMessage({ kind: 'error', title: "The schedule didn't load", text: err.message, action: `<button type="button" class="btn btn-primary" id="retry">${icon('refresh', 18)}Try again</button>` })
    document.getElementById('retry').addEventListener('click', () => listPoll.refresh())
  },
  onTick: () => updateRing(),
})
const updateRing = wireRefreshRing('ring', listPoll, POLL_MS)
