// Results entry for judges and admins: type scores, ranks, points and medals.
// Each row saves with PATCH /api/results/<id>/.
import { autoMedals, getEvent, getEventResults, getEvents, setEventStatus, updateResult } from '../api.js'
import { formatDate, genderLabel } from '../format.js'
import { renderAppShell, toast, isAdmin } from '../manage-ui.js'
import { countryChip, esc, flip, icon, medalChip, skeletonRows, stateMessage, statusBadge, TYPE_COLOR, typeDot } from '../ui.js'

renderAppShell({ active: 'results', title: 'Results entry', th: 'บันทึกผลการแข่งขัน' })
const app = document.getElementById('app')
let selected = Number(new URLSearchParams(location.search).get('id')) || null, events = [], event = null, rows = []
const COLS = '48px minmax(0,1.6fr) 56px 140px 96px 96px 150px 104px'

app.innerHTML = `<div class="stack">
  <section class="card card-pad between anim-rise">
    <label class="field" style="flex:1;max-width:520px"><span class="label">Event</span><select class="select input" id="pick"></select></label>
    <div class="row small muted">${icon('alert', 18)}${isAdmin() ? 'Each row saves on its own. Medals are set by admins.' : 'Judges can enter results for their own events while they are live. Admins set the medals.'}</div>
  </section>
  <div id="sheet" class="stack"><div class="card">${skeletonRows(8)}</div></div>
</div>`

function dirty(id) { const r = document.querySelector(`[data-key="${id}"]`); r?.classList.add('is-dirty'); r?.querySelector('[data-save]')?.removeAttribute('disabled') }

function draw(animate = true) {
  const box = document.getElementById('sheet')
  if (!event) return
  const after = flip(box.querySelector('.flip-list'))
  const done = rows.filter((r) => r.score).length
  box.innerHTML = `
    <section class="card${animate ? ' anim-rise' : ''}" style="border-top:6px solid ${TYPE_COLOR[event.type] || 'var(--border-strong)'}">
      <div class="card-head" style="border-bottom:0">
        <div class="stack" style="gap:6px"><div class="row">${statusBadge(event.status)}${event.classification ? `<span class="badge badge-info">${esc(event.classification)}</span>` : ''}</div>
          <h2 style="font-size:1.75rem">${esc(event.name)}</h2>
          <span class="row small muted" style="align-items:baseline">${typeDot(event.type)}<span>${esc([event.sport, genderLabel(event.gender), formatDate(event.date), event.time, event.venue].filter(Boolean).join(' · '))}</span></span></div>
        <div class="stack" style="gap:6px;align-items:flex-end"><span class="num" style="font-size:2rem">${done}<span class="muted" style="font-size:1.125rem"> / ${rows.length}</span></span><span class="small muted">results entered</span></div>
      </div>
      <div class="progress" style="margin:0 24px 16px" aria-hidden="true"><span style="width:${rows.length ? (done / rows.length) * 100 : 0}%"></span></div>
      <div class="between" style="padding:14px 24px;border-top:1px solid var(--border);background:var(--surface-2)">
        <span class="small muted">${event.status === 'start-list' ? 'Start the event to enter results.' : event.status === 'live' ? 'Results show on the public site as soon as you save them.' : 'Results are published. Set the medals when the ranks are final.'}</span>
        <div class="row" style="flex-wrap:wrap">
          <button type="button" class="btn" id="sort">${icon('swap', 18)}Sort by rank</button>
          <button type="button" class="btn" id="rank">${icon('flag', 18)}Rank from results</button>
          ${!isAdmin() ? '' : event.status === 'start-list' ? `<button type="button" class="btn btn-primary" data-status="live">${icon('timer', 18)}Start the event</button>` : ''}
          ${isAdmin() && event.status === 'live' ? `<button type="button" class="btn btn-primary" data-status="result">${icon('check', 18)}Finish and publish</button>` : ''}
          ${isAdmin() && event.status === 'result' ? `<button type="button" class="btn btn-primary" id="auto">${icon('medal', 18)}Set medals from ranks</button>` : ''}
        </div></div>
    </section>
    <section class="card" aria-labelledby="sheet-h">
      <div class="card-head"><h2 id="sheet-h">Result sheet</h2><button type="button" class="btn btn-primary" id="save-all">${icon('save', 18)}Save all changes</button></div>
      ${rows.length === 0 ? stateMessage({ title: 'No athletes in this event', text: isAdmin() ? 'Add athletes on the Event setup page first.' : 'An admin adds athletes on the Event setup page.', action: isAdmin() ? `<a class="btn" href="events-admin.html?id=${event.id}">Event setup</a>` : '' }) : `
      <div style="overflow-x:auto"><div style="min-width:920px">
        <div class="table-head" style="grid-template-columns:${COLS}"><span>Place</span><span>Athlete</span><span class="center">Lane</span><span>Result</span><span>Rank</span><span>Points</span><span>Medal</span><span></span></div>
        <div class="flip-list">${rows.map((r, i) => `
          <form class="table-row result-row${animate ? ' anim-rise' : ''}" data-key="${r.id}" style="grid-template-columns:${COLS};--i:${i};margin:0" aria-label="Result for ${esc(r.name)}">
            <span>${medalChip(r.medal, r.rank)}</span>
            <span class="row" style="min-width:0">${countryChip(r.country)}<strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</strong></span>
            <span class="center muted">${esc(r.lane || '–')}</span>
            <label><span class="visually-hidden">Result for ${esc(r.name)}</span><input class="input-sm num" name="score" value="${esc(r.score)}" placeholder="${event.type === 'field' ? 'm' : 'time'}" inputmode="decimal" style="font-size:1.125rem" ${event.status === 'start-list' ? 'disabled' : ''}></label>
            <label><span class="visually-hidden">Rank for ${esc(r.name)}</span><input class="input-sm" name="rank" type="number" min="1" value="${r.rank ?? ''}" ${event.status === 'start-list' ? 'disabled' : ''}></label>
            <label><span class="visually-hidden">Points for ${esc(r.name)}</span><input class="input-sm" name="point" type="number" min="0" value="${r.points ?? ''}" ${event.status === 'start-list' ? 'disabled' : ''}></label>
            <label><span class="visually-hidden">Medal for ${esc(r.name)}</span><select class="input-sm" name="medal" ${event.status === 'start-list' || !isAdmin() ? 'disabled' : ''}>${[['', 'None'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']].map(([v, l]) => `<option value="${v}"${(r.medal || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <button type="submit" class="btn" data-save disabled>${icon('save', 16)}Save</button>
          </form>`).join('')}</div></div></div>`}
    </section>`
  after()
}

async function load(animate = true) {
  try {
    const [ev, res] = await Promise.all([getEvent(selected), getEventResults(selected)])
    event = ev; rows = res.length ? res : ev.participants
    draw(animate)
  } catch (err) { document.getElementById('sheet').innerHTML = `<div class="card">${stateMessage({ kind: 'error', title: "This event didn't load", text: err.message })}</div>` }
}

async function saveRow(form) {
  const id = form.dataset.key
  const data = Object.fromEntries(new FormData(form))
  const body = { score: data.score, rank: data.rank === '' ? null : Number(data.rank), point: data.point === '' ? null : Number(data.point), medal: data.medal || null }
  const updated = await updateResult(id, body)
  const r = rows.find((x) => String(x.id) === String(id))
  Object.assign(r, { score: body.score, rank: body.rank, points: body.point, medal: body.medal || '' }, updated && updated.id ? {} : {})
  form.classList.remove('is-dirty'); form.querySelector('[data-save]').setAttribute('disabled', '')
  form.classList.remove('saved-flash'); void form.offsetWidth; form.classList.add('saved-flash')
  form.querySelector('.medal').outerHTML = medalChip(r.medal, r.rank)
}

const sheet = document.getElementById('sheet')
sheet.addEventListener('input', (e) => {
  const f = e.target.closest('form.result-row')
  if (!f) return
  dirty(f.dataset.key)
  // Keep typed values in memory so sorting and ranking use what is on screen, even before saving.
  const r = rows.find((x) => String(x.id) === f.dataset.key), d = Object.fromEntries(new FormData(f))
  if (r) Object.assign(r, { score: d.score, rank: d.rank === '' ? null : Number(d.rank), points: d.point === '' ? null : Number(d.point), medal: d.medal || '' })
})
sheet.addEventListener('submit', async (e) => {
  e.preventDefault()
  try { await saveRow(e.target); toast('Result saved.') } catch (err) { toast(err.message, 'error') }
})
sheet.addEventListener('click', async (e) => {
  const st = e.target.closest('[data-status]')
  if (st) { try { await setEventStatus(selected, st.dataset.status); toast(st.dataset.status === 'live' ? 'The event is live.' : 'Results are published.'); await refreshEvents(); load(false) } catch (err) { toast(err.message, 'error') } }
  if (e.target.closest('#auto')) { try { await autoMedals(selected); toast('Medals set from the ranks.'); load(false) } catch (err) { toast(err.message, 'error') } }
  if (e.target.closest('#sort')) { rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)); draw(false) }
  if (e.target.closest('#rank')) {
    // Works out ranks from the typed results: lowest time wins on track and road, longest mark wins in the field.
    const val = (s) => { const p = String(s).split(':').map(Number); return p.reduce((t, x) => t * 60 + x, 0) }
    const high = event.higherWins ?? (event.type === 'field' || event.type === 'combined')
    const scored = rows.filter((r) => r.score).sort((a, b) => (high ? val(b.score) - val(a.score) : val(a.score) - val(b.score)))
    scored.forEach((r, i) => { r.rank = i + 1; r.points = i < 8 ? 8 - i : 0 })
    rows.filter((r) => !r.score).forEach((r) => { r.rank = null })
    rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)); draw(false)
    document.querySelectorAll('form.result-row').forEach((f) => { if (rows.find((r) => String(r.id) === f.dataset.key)?.score) dirty(f.dataset.key) })
    toast('Ranks and points filled in. Save to keep them.')
  }
  if (e.target.closest('#save-all')) {
    const forms = [...document.querySelectorAll('form.result-row.is-dirty')]
    if (!forms.length) { toast('Nothing to save.'); return }
    try { for (const f of forms) await saveRow(f); toast(`${forms.length} ${forms.length === 1 ? 'result' : 'results'} saved.`) } catch (err) { toast(err.message, 'error') }
  }
})

async function refreshEvents() {
  events = await getEvents()
  const order = { live: 0, 'start-list': 1, result: 2 }
  const pick = document.getElementById('pick')
  pick.innerHTML = [...events].sort((a, b) => order[a.status] - order[b.status] || (a.date + a.time).localeCompare(b.date + b.time))
    .map((e) => `<option value="${e.id}"${e.id === selected ? ' selected' : ''}>${e.status === 'live' ? 'LIVE · ' : e.status === 'result' ? 'Done · ' : ''}${esc(e.name)} · ${esc(formatDate(e.date, { day: 'numeric', month: 'short' }))} ${esc(e.time)}</option>`).join('')
}
document.getElementById('pick').addEventListener('change', (e) => { selected = Number(e.target.value); history.replaceState(null, '', `?id=${selected}`); load() })
refreshEvents().then(() => {
  if (!selected) selected = (events.find((e) => e.status === 'live') || events[0])?.id
  document.getElementById('pick').value = selected
  load()
}).catch((err) => { sheet.innerHTML = `<div class="card">${stateMessage({ kind: 'error', title: "Events didn't load", text: err.message })}</div>` })
