// Event setup: create, edit and delete events, manage who competes, and move
// an event through start list → live → results → medals.
import { countryName } from '../countries.js'
import { addParticipant, autoMedals, createEvent, deleteEvent, getAthletes, getEvent, getEventResults, getEvents, getSports, removeParticipant, setEventStatus, updateEvent, canReopen } from '../api.js'
import { GENDER_OPTIONS } from '../config.js'
import { formatDate, genderLabel, groupBy } from '../format.js'
import { openModal, renderAppShell, toast } from '../manage-ui.js'
import { countryChip, esc, icon, medalChip, skeletonRows, stateMessage, statusBadge, TYPE_COLOR, typeDot, flagImg } from '../ui.js'

renderAppShell({ active: 'events', title: 'Event setup', th: 'จัดการรายการแข่งขัน' })
const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
let events = [], sports = [], athletes = [], selected = Number(params.get('id')) || null, filter = '', current = null

app.innerHTML = `<div style="display:grid;grid-template-columns:minmax(300px, 360px) minmax(0,1fr);gap:24px;align-items:start">
  <section class="card" aria-labelledby="list-h" style="position:sticky;top:96px;max-height:calc(100vh - 120px);display:flex;flex-direction:column">
    <div class="card-head"><h2 id="list-h">Events</h2><button type="button" class="btn btn-primary" id="new">${icon('plus', 18)}New event</button></div>
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)"><label class="search"><span class="visually-hidden">Find an event</span>${icon('search', 20, 'search-icon')}<input id="q" class="input" type="search" placeholder="Find an event" autocomplete="off" style="min-height:44px"></label></div>
    <div id="list" style="overflow-y:auto">${skeletonRows(8)}</div>
  </section>
  <div id="editor" class="stack"></div>
</div>`

function drawList() {
  const q = filter.toLowerCase()
  const shown = events.filter((e) => !q || `${e.name} ${e.sport} ${e.venue}`.toLowerCase().includes(q)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  document.getElementById('list').innerHTML = shown.length === 0 ? '<p class="card-pad muted">No events match.</p>' : groupBy(shown, (e) => e.date).map(([d, evs]) => `
    <div class="eyebrow" style="padding:12px 16px 4px">${esc(formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</div>
    ${evs.map((e) => `<button type="button" data-id="${e.id}" aria-pressed="${e.id === selected}" class="ev-pick" style="--type:${TYPE_COLOR[e.type] || 'var(--border-strong)'}">
      <span class="num" style="font-size:1.0625rem">${esc(e.time)}</span>
      <span class="stack" style="gap:0;min-width:0;text-align:left"><strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</strong><span class="small muted">${esc(e.venue)}</span></span>
      ${statusBadge(e.status)}</button>`).join('')}`).join('')
}

// Sport class and venue boxes appear only with demo data: the backend takes the class from the
// event name ("Men's 100m T54") and the venue from the sport group.
const STEPS = [['Details', 'Name, time, venue'], ['Entries', 'Athletes added'], ['Live', 'Results coming in'], ['Results', 'Finished'], ['Medals', 'Gold, silver, bronze']]
function stepIndex(ev, results) {
  if (results.some((r) => r.medal)) return 5
  if (ev.status === 'result') return 4
  if (ev.status === 'live') return 2
  return (results.length || ev.participants.length) ? 2 : 1
}

function formHtml(ev = {}) {
  const sel = (v, x) => (String(v) === String(x) ? ' selected' : '')
  return `<div class="form-grid">
    <label class="field" style="grid-column:1/-1"><span class="label">Event name</span><input class="input" name="name" required value="${esc(ev.name || '')}" placeholder="Men's 100 m T54 Final"></label>
    <label class="field"><span class="label">Sport</span><select class="select input" name="sport">${sports.map((s) => `<option value="${s.id}"${sel(ev.sportId, s.id)}>${esc(s.name)} (${esc(s.sport_type)})</option>`).join('')}</select></label>
    <label class="field"><span class="label">Gender</span><select class="select input" name="gender">${GENDER_OPTIONS.filter((g) => g.value).map((g) => `<option value="${g.value}"${sel(ev.gender, g.value)}>${g.label}</option>`).join('')}</select></label>
    ${canReopen ? `<label class="field"><span class="label">Sport class</span><input class="input" name="classification" value="${esc(ev.classification || '')}" placeholder="T54"></label>` : ''}
    <label class="field"><span class="label">Date</span><input class="input" type="date" name="date" required value="${esc(ev.date || '')}"></label>
    <label class="field"><span class="label">Start time</span><input class="input" type="time" name="start_time" required value="${esc(ev.time || '')}"></label>
    ${canReopen ? `<label class="field"><span class="label">Venue</span><input class="input" name="venue" value="${esc(ev.venue || '')}" placeholder="Main track"></label>` : ''}
    <label class="field"><span class="label">${canReopen ? 'Judge' : 'Judge user ID'} <span class="muted" style="font-weight:400">(optional${!canReopen && ev.judge ? `, now ${esc(ev.judge)}` : ''})</span></span><input class="input" name="judge" ${canReopen ? '' : 'inputmode="numeric" placeholder="e.g. 2"'} value="${esc(canReopen ? ev.judge || '' : ev.judgeId ?? '')}"></label>
  </div>`
}
const readForm = (root) => Object.fromEntries([...root.querySelectorAll('[name]')].map((el) => [el.name, el.value.trim()]))
function validate(data) {
  if (!data.name) return 'Give the event a name.'
  if (!data.date) return 'Choose the date.'
  if (!data.start_time) return 'Choose the start time.'
  return ''
}

async function drawEditor() {
  const box = document.getElementById('editor')
  if (!selected) { box.innerHTML = `<div class="card">${stateMessage({ title: 'Choose an event', text: 'Or create a new one with "New event".' })}</div>`; return }
  box.innerHTML = `<div class="card">${skeletonRows(8)}</div>`
  let ev, results
  try { [ev, results] = await Promise.all([getEvent(selected), getEventResults(selected)]) } catch (err) {
    box.innerHTML = `<div class="card">${stateMessage({ kind: 'error', title: "This event didn't load", text: err.message })}</div>`; return
  }
  current = ev
  const step = stepIndex(ev, results)
  const entries = results.length ? results : ev.participants
  const inEvent = new Set(entries.map((r) => String(r.athleteId)))
  const pool = athletes.filter((a) => !inEvent.has(String(a.id)) && (ev.gender === 'X' || !a.gender || a.gender === ev.gender))
  box.innerHTML = `
    <section class="card anim-rise" style="border-top:6px solid ${TYPE_COLOR[ev.type] || 'var(--border-strong)'}">
      <div class="card-head" style="border-bottom:0"><div class="stack" style="gap:6px"><div class="row">${statusBadge(ev.status)}${ev.classification ? `<span class="badge badge-info">${esc(ev.classification)}</span>` : ''}</div>
        <h2 style="font-size:1.75rem">${esc(ev.name)}</h2><span class="row small muted" style="align-items:baseline">${typeDot(ev.type)}<span>${esc([ev.sport, genderLabel(ev.gender), formatDate(ev.date), ev.time, ev.venue].filter(Boolean).join(' · '))}</span></span></div>
        <div class="row" style="flex-wrap:wrap"><a class="btn" href="event.html?id=${ev.id}">${icon('globe', 18)}Public page</a><a class="btn" href="results-entry.html?id=${ev.id}">${icon('timer', 18)}Enter results</a></div></div>
      <ol class="stepper" aria-label="Event progress">${STEPS.map(([l, n], i) => {
        const cls = i < step ? 'is-done' : i === step ? 'is-now' : ''
        return `<li class="${cls}"${i === step ? ' aria-current="step"' : ''}><span class="step-top"><span class="step-dot">${i < step ? icon('check', 16) : i + 1}</span>${i < 4 ? `<span class="step-line">${i < step ? '<span></span>' : ''}</span>` : ''}</span><span class="stack" style="gap:0"><strong>${l}</strong><span class="small muted">${n}</span></span></li>`
      }).join('')}</ol>
      <div class="between" style="padding:16px 24px;border-top:1px solid var(--border);background:var(--surface-2)">
        <span class="small muted">Status changes are saved straight away and show on the public site.</span>
        <div class="row" style="flex-wrap:wrap">
          ${ev.status === 'start-list' ? `<button type="button" class="btn btn-primary" data-status="live">${icon('timer', 18)}Start the event</button>` : ''}
          ${ev.status === 'live' ? `<button type="button" class="btn btn-primary" data-status="result">${icon('check', 18)}Finish and publish results</button>` : ''}
          ${ev.status === 'result' ? `<button type="button" class="btn btn-primary" id="auto">${icon('medal', 18)}Set medals from ranks</button>${canReopen ? '<button type="button" class="btn" data-status="live">Reopen</button>' : ''}` : ''}
        </div></div>
    </section>
    <div class="stack" style="gap:24px">
      <section class="card card-pad stack anim-rise" style="gap:16px;--i:1" aria-labelledby="det-h">
        <h2 id="det-h">Details</h2><form id="details" class="stack" style="gap:16px">${formHtml(ev)}
          <div class="between"><button type="button" class="btn" id="delete" style="color:var(--danger);border-color:var(--danger)">${icon('trash', 18)}Delete event</button><button type="submit" class="btn btn-primary">${icon('save', 18)}Save changes</button></div></form>
      </section>
      <section class="card anim-rise" style="--i:2" aria-labelledby="ent-h">
        <div class="card-head"><h2 id="ent-h">Athletes</h2><span class="small muted">${entries.length} entered</span></div>
        <form id="add" class="row" style="padding:16px 24px;border-bottom:1px solid var(--border)">
          <label class="field" style="flex:1"><span class="visually-hidden">Athlete to add</span><select class="select input" name="athlete" ${pool.length ? '' : 'disabled'}>${pool.length ? pool.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.country)}${a.classification ? ` · ${esc(a.classification)}` : ''}</option>`).join('') : '<option>Everyone eligible is already in</option>'}</select></label>
          <button type="submit" class="btn btn-primary" ${pool.length ? '' : 'disabled'}>${icon('plus', 18)}Add</button></form>
        <div id="entries">${entries.length === 0 ? '<p class="card-pad muted">No athletes yet. Add them above.</p>' : entries.map((r, i) => `
          <div class="list-row" style="grid-template-columns:36px minmax(0,1fr) auto auto;padding:10px 24px">
            ${r.rank ? medalChip(r.medal, r.rank) : `<span class="num muted">${i + 1}</span>`}
            <span class="row" style="min-width:0;gap:8px" title="${esc(countryName(r.country))}">${flagImg(r.country, 'sm')}<strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</strong></span>
            <span class="num" style="font-size:1.125rem">${esc(r.score || '')}</span>
            <button type="button" class="btn btn-icon" data-remove="${r.athleteId}" aria-label="Remove ${esc(r.name)}">${icon('x', 18)}</button></div>`).join('')}</div>
      </section>
    </div>`
}

async function act(fn, ok) {
  try { await fn(); toast(ok); await refreshList(); await drawEditor() } catch (err) { toast(err.message, 'error') }
}
document.getElementById('editor').addEventListener('click', (e) => {
  const st = e.target.closest('[data-status]'), rm = e.target.closest('[data-remove]')
  if (st) act(() => setEventStatus(selected, st.dataset.status), st.dataset.status === 'live' ? 'The event is live.' : 'Results are published.')
  if (rm) act(() => removeParticipant(selected, rm.dataset.remove), 'Athlete removed.')
  if (e.target.closest('#auto')) act(() => autoMedals(selected), 'Medals set: 1st gold, 2nd silver, 3rd bronze.')
  if (e.target.closest('#delete')) {
    const m = openModal({ title: 'Delete this event?', body: `<p>"${esc(current.name)}" and all its results will be removed. This cannot be undone.</p>`,
      actions: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" id="confirm-del" style="background:var(--danger);border-color:var(--danger)">Delete event</button>' })
    m.el.querySelector('#confirm-del').addEventListener('click', () => { m.close(); act(async () => { await deleteEvent(selected); selected = null }, 'Event deleted.') })
  }
})
document.getElementById('editor').addEventListener('submit', (e) => {
  e.preventDefault()
  if (e.target.id === 'details') {
    const data = readForm(e.target), msg = validate(data)
    if (msg) { toast(msg, 'error'); return }
    act(() => updateEvent(selected, data), 'Changes saved.')
  }
  if (e.target.id === 'add') act(() => addParticipant(selected, e.target.athlete.value), 'Athlete added.')
})
document.getElementById('list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]')
  if (!b) return
  selected = Number(b.dataset.id); history.replaceState(null, '', `?id=${selected}`); drawList(); drawEditor()
})
document.getElementById('q').addEventListener('input', (e) => { filter = e.target.value.trim(); drawList() })
function openNew() {
  const m = openModal({ title: 'New event', body: `<form id="new-form" class="stack" style="gap:16px">${formHtml({ date: events[0]?.date || '', venue: '' })}<p class="small muted" id="new-err" role="alert"></p></form>`,
    actions: '<button type="button" class="btn" data-close>Cancel</button><button type="submit" form="new-form" class="btn btn-primary">Create event</button>' })
  m.el.querySelector('#new-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = readForm(e.target), msg = validate(data)
    if (msg) { m.el.querySelector('#new-err').textContent = msg; return }
    try { const created = await createEvent(data); m.close(); selected = created.id; toast('Event created.'); await refreshList(); drawEditor(); history.replaceState(null, '', `?id=${selected}`) }
    catch (err) { m.el.querySelector('#new-err').textContent = err.message }
  })
}
document.getElementById('new').addEventListener('click', openNew)

async function refreshList() { events = await getEvents(); drawList() }
Promise.all([getEvents(), getSports().catch(() => []), getAthletes().catch(() => [])]).then(([e, s, a]) => {
  events = e; sports = s; athletes = a
  if (!selected && !params.get('new')) selected = events.find((x) => x.status === 'live')?.id || events[0]?.id || null
  drawList(); drawEditor()
  if (params.get('new')) openNew()
}).catch((err) => { document.getElementById('list').innerHTML = stateMessage({ kind: 'error', title: "Events didn't load", text: err.message }) })
