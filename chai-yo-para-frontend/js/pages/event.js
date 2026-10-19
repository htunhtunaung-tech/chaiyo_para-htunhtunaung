// Event page (event.html?id=5): podium, live or final results, or the start list.
import { getEvent, getEventResults } from '../api.js'
import { POLL_MS } from '../config.js'
import { formatDate, genderLabel } from '../format.js'
import { countryChip, esc, flip, icon, medalChip, poll, refreshRing, renderShell, skeletonRows, stateMessage, statusBadge, typeDot, wireRefreshRing } from '../ui.js'

renderShell('competition')
const app = document.getElementById('app')
const id = new URLSearchParams(location.search).get('id')
const COLS = '64px minmax(0, 1.8fr) 64px minmax(80px, 1fr) 72px'
let first = true, lastKey = ''

app.innerHTML = `<div class="card">${skeletonRows(8)}</div>`

function podium(results) {
  // Athletes who tie share a step: two golds stand together on step 1 (and then there is no silver).
  const hasMedals = results.some((x) => x.medal)
  const pick = (m, r) => results.filter((x) => (hasMedals ? x.medal === m : x.rank === r) && x.rank)
  const spots = [['silver', 2, 120, 0.15], ['gold', 1, 160, 0], ['bronze', 3, 92, 0.3]].map(([medal, place, h, delay]) => ({ medal, place, h, delay, who: pick(medal, place) }))
  if (!spots.some((s) => s.who.length)) return ''
  const person = (w) => `<div class="podium-person">
        ${w.athleteId ? `<a href="athlete.html?id=${encodeURIComponent(w.athleteId)}" class="podium-name">${esc(w.name)}</a>` : `<span class="podium-name">${esc(w.name)}</span>`}
        ${countryChip(w.country)}<span class="num podium-score">${esc(w.score)}</span>
      </div>`
  // An empty step (e.g. no silver after a tie for gold) keeps its place, so gold stays in the middle.
  return `<section aria-label="Podium" class="podium">${spots.map((s) => !s.who.length ? '<div class="podium-spot" aria-hidden="true"></div>' : `
    <div class="podium-spot">
      <div class="podium-who anim-rise" style="animation-delay:${0.5 + s.delay}s">
        ${medalChip(s.who[0].medal || s.medal, s.who[0].rank || s.place, 'podium-medal')}
        ${s.who.length > 1 ? `<span class="badge">Tied · ${s.who.length} athletes</span>` : ''}
        <div class="podium-people">${s.who.map(person).join('')}</div>
      </div>
      <div class="podium-block col-grow podium-${s.medal}" style="height:${s.h}px;animation-delay:${s.delay}s"><span class="num">${s.who[0].rank || s.place}</span></div>
    </div>`).join('')}</section>`
}

function draw({ event, results }) {
  const isStart = event.status === 'start-list'
  const list = isStart && results.length === 0 ? event.participants : results
  const ranked = results.filter((r) => r.rank)
  const key = JSON.stringify([event.status, list.map((r) => [r.id, r.rank, r.score, r.points, r.medal])])
  if (key === lastKey) return // nothing changed since the last refresh
  lastKey = key
  document.title = `${event.name} · Chai-Yo Para`
  const anim = first ? ' anim-rise' : ''
  const after = flip(app.querySelector('.flip-list'))
  app.innerHTML = `<div class="stack">
    <a href="competition.html" class="btn btn-ghost back-link">${icon('chevL', 18)}Competition</a>
    <section class="event-hero card${anim} type-${esc(event.type || 'none')}">
      <div class="stack" style="gap:8px">
        <div class="row" style="flex-wrap:wrap">${statusBadge(event.status)}${event.classification ? `<span class="badge badge-info">${esc(event.classification)}</span>` : ''}</div>
        <h1>${esc(event.name)}</h1>
        <div class="event-meta">
          <span class="row">${icon('cal', 18)}${esc(formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${event.time ? ` · ${esc(event.time)}` : ''}</span>
          ${event.venue ? `<span class="row">${icon('pin', 18)}${esc(event.venue)}</span>` : ''}
          <span class="row">${typeDot(event.type)}${esc([event.sport, genderLabel(event.gender)].filter(Boolean).join(' · '))}</span>
          ${event.judge ? `<span class="row">${icon('flag', 18)}Judge: ${esc(event.judge)}</span>` : ''}
        </div>
      </div>
      ${event.status !== 'result' ? refreshRing('ring') : ''}
    </section>
    ${ranked.length ? `<div class="stack" style="gap:8px;align-items:center">${event.status === 'live' ? '<span class="badge badge-warn">Current top three · not final yet</span>' : ''}${first || event.status !== 'live' ? podium(ranked) : podium(ranked).replace(/ col-grow| anim-rise/g, '')}</div>` : ''}
    <section class="card" aria-labelledby="res-title">
      <div class="card-head"><h2 id="res-title">${isStart ? 'Start list' : event.status === 'live' ? 'Live results' : 'Final results'}</h2>
        <span class="small muted">${event.status === 'live' ? 'Updates automatically' : event.status === 'result' ? 'Official' : 'Results appear here when the event starts'}</span></div>
      ${list.length === 0 ? stateMessage({ title: 'No athletes entered yet', text: 'The start list is published the day before the event.' }) : `
      <div role="table" aria-label="${isStart ? 'Start list' : 'Results'}">
        <div role="row" class="table-head" style="grid-template-columns:${COLS}">
          <span role="columnheader">${isStart ? 'Order' : 'Rank'}</span><span role="columnheader">Athlete</span>
          <span role="columnheader" class="center">Lane</span><span role="columnheader" class="right">Result</span><span role="columnheader" class="right">Points</span></div>
        <div class="flip-list">${list.map((r, i) => `
          <div role="row" data-key="${esc(r.id ?? i)}" class="table-row${anim}${r.medal === 'gold' ? ' is-first' : ''}" style="grid-template-columns:${COLS};--i:${i}">
            <span role="cell">${isStart ? `<span class="num">${i + 1}</span>` : medalChip(r.medal, r.rank)}</span>
            <span role="cell" class="row" style="min-width:0">${countryChip(r.country)}${r.athleteId ? `<a href="athlete.html?id=${encodeURIComponent(r.athleteId)}" class="athlete-link">${esc(r.name)}</a>` : `<span class="athlete-link">${esc(r.name)}</span>`}</span>
            <span role="cell" class="center muted">${esc(r.lane || '–')}</span>
            <span role="cell" class="right num result-mark">${r.score ? esc(r.score) : `<span class="muted small" style="font-family:var(--font-body);font-weight:600">${event.status === 'live' ? 'Waiting' : '–'}</span>`}</span>
            <span role="cell" class="right">${r.points !== '' && r.points !== null ? esc(r.points) : '–'}</span>
          </div>`).join('')}</div>
      </div>`}
    </section></div>`
  first = false
  after()
  if (event.status !== 'result') { updateRing = wireRefreshRing('ring', eventPoll, POLL_MS); updateRing() }
  else eventPoll.stop()
}

let updateRing = () => {}
const eventPoll = poll(async () => {
  if (!id) throw Object.assign(new Error('No event was chosen.'), { status: 404 })
  const [event, results] = await Promise.all([getEvent(id), getEventResults(id)])
  return { event, results }
}, POLL_MS, {
  onData: draw,
  onError: (err) => {
    if (lastKey) { updateRing(); return }
    app.innerHTML = stateMessage({ kind: 'error', title: err.status === 404 ? 'We could not find this event' : "This event didn't load", text: err.message,
      action: '<a href="competition.html" class="btn btn-primary">Back to the schedule</a>' })
    eventPoll.stop()
  },
  onTick: () => updateRing(),
})
