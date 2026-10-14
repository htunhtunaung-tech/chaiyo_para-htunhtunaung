// Venue and facility booking (demo data: there is no venue API yet).
// Day grid by facility, clash detection, approve or decline requests, new bookings.
import { ALL_COUNTRIES, countryColor, countryName } from '../countries.js'
import { FACILITIES, getBookings, saveBookings } from '../demo-data.js'
import { formatDate } from '../format.js'
import { openModal, renderAppShell, toast } from '../manage-ui.js'
import { esc, icon } from '../ui.js'

renderAppShell({ active: 'venues', title: 'Venue and facility booking', th: 'การจองสนามและสถานที่ฝึกซ้อม' })
const app = document.getElementById('app')
const DAYS = ['2026-10-14', '2026-10-15', '2026-10-16'], FROM = 6, TO = 12
const TEAMS = ALL_COUNTRIES
let bookings = getBookings(), day = DAYS.includes(new Date().toISOString().slice(0, 10)) ? new Date().toISOString().slice(0, 10) : DAYS[0]
const hm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const facName = (id) => FACILITIES.find((f) => f.id === id)?.name || id

// Two approved bookings on the same facility that overlap in time are a clash.
function clashes(list) {
  const out = []
  const live = list.filter((b) => b.status === 'approved')
  live.forEach((a, i) => live.slice(i + 1).forEach((b) => {
    if (a.date === b.date && a.facility === b.facility && a.start < b.end && b.start < a.end) out.push([a, b])
  }))
  return out
}

app.innerHTML = `<div class="stack">
  <section class="between anim-rise">
    <div class="row" style="flex-wrap:wrap"><button type="button" class="btn btn-icon" id="prev" aria-label="Previous day">${icon('chevL', 20)}</button>
      <div class="stack" style="gap:0;min-width:220px;text-align:center"><strong style="font-family:var(--font-head);font-size:1.25rem" id="day-label"></strong><span class="small muted" id="day-note"></span></div>
      <button type="button" class="btn btn-icon" id="next" aria-label="Next day">${icon('chevR', 20)}</button></div>
    <button type="button" class="btn btn-primary" id="new">${icon('plus', 18)}New booking</button>
  </section>
  <section class="card card-pad anim-rise" style="--i:1;overflow-x:auto" aria-labelledby="grid-h">
    <div class="between" style="margin-bottom:16px"><h2 id="grid-h">Morning bookings, 06:00 to 12:00</h2>
      <div class="legend"><span><i style="background:var(--primary)"></i>Approved</span><span><i style="border:2px dashed var(--text)"></i>Waiting</span><span><i style="outline:2px solid var(--danger);background:var(--danger-soft)"></i>Clash</span><span><i style="border:1px solid var(--border-strong)"></i>Closed or open access</span></div></div>
    <div id="grid" style="min-width:880px"></div>
  </section>
  <div class="cols-even cols"><section class="card" id="clash-box" aria-labelledby="cl-h"></section><section class="card" aria-labelledby="rq-h"><div class="card-head"><h2 id="rq-h">Requests waiting</h2><span class="badge badge-warn" id="rq-count"></span></div><div id="requests"></div></section></div>
</div>`

function draw() {
  const i = DAYS.indexOf(day)
  document.getElementById('day-label').textContent = formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })
  document.getElementById('day-note').textContent = `Day ${i + 1} of ${DAYS.length}`
  document.getElementById('prev').disabled = i === 0
  document.getElementById('next').disabled = i === DAYS.length - 1
  const list = bookings.filter((b) => b.date === day)
  const clashPairs = clashes(bookings).filter(([a]) => a.date === day)
  const clashIds = new Set(clashPairs.flat().map((b) => b.id))
  const pct = (h) => ((h - FROM) / (TO - FROM)) * 100
  const hours = Array.from({ length: TO - FROM }, (_, k) => FROM + k)
  document.getElementById('grid').innerHTML = `
    <div style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:8px;margin-bottom:6px"><span></span><div style="display:grid;grid-template-columns:repeat(${hours.length},1fr)">${hours.map((h) => `<span class="num small" style="border-left:1px solid var(--border);padding-left:4px;color:var(--text-2);font-size:.9375rem">${hm(h)}</span>`).join('')}</div></div>
    <div class="stack" style="gap:8px">${FACILITIES.map((f, fi) => {
      const mine = list.filter((b) => b.facility === f.id)
      const clashOrder = {}
      return `<div style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:8px;align-items:center">
        <div class="stack" style="gap:0"><strong>${esc(f.name)}</strong><span class="small muted">${esc(f.note)}</span></div>
        <div class="vg-track">${mine.map((b, k) => {
          const isClash = clashIds.has(b.id)
          const slot = isClash ? (clashOrder[f.id] = (clashOrder[f.id] ?? -1) + 1) : 0
          const team = TEAMS.includes(b.team)
          const cls = b.status === 'pending' ? 'pending' : b.status === 'closed' ? 'closed' : isClash ? 'clash' : ''
          const label = `${team ? b.team : b.team}${b.end - b.start >= 1 ? ` ${hm(b.start)}–${hm(b.end)}` : ''}${b.status === 'pending' ? ' · waiting' : ''}`
          return `<button type="button" class="vg-block ${cls}" data-booking="${b.id}" title="${esc(`${team ? countryName(b.team) : b.team}, ${hm(b.start)} to ${hm(b.end)}${b.status === 'pending' ? ', waiting for approval' : ''}${isClash ? ', clash' : ''}`)}"
            style="--i:${fi + k};left:calc(${pct(b.start)}% + 2px);width:calc(${pct(b.end) - pct(b.start)}% - 4px);background:${team ? countryColor(b.team) : 'var(--surface)'};${isClash ? `top:${4 + slot * 22}px` : ''}">${esc(label)}</button>`
        }).join('')}</div></div>`
    }).join('')}</div>`

  const box = document.getElementById('clash-box')
  box.style.borderColor = clashPairs.length ? 'var(--danger)' : ''
  box.innerHTML = `<div class="card-head"><h2 id="cl-h">${clashPairs.length ? `${clashPairs.length} ${clashPairs.length === 1 ? 'clash' : 'clashes'} to resolve` : 'No clashes'}</h2></div>` + (clashPairs.length === 0 ? '<p class="card-pad muted">Every approved booking on this day has its own time.</p>' : clashPairs.map(([a, b]) => `
    <div class="card-pad stack" style="gap:12px;border-top:1px solid var(--border)">
      <div class="row"><span class="icon-tile tone-danger">${icon('alert', 22)}</span><span class="stack" style="gap:0"><strong>${esc(facName(a.facility))}</strong><span class="small muted">${hm(Math.max(a.start, b.start))} to ${hm(Math.min(a.end, b.end))}</span></span></div>
      <p class="muted">${esc(countryName(a.team))} and ${esc(countryName(b.team))} are both booked at the same time.</p>
      <div class="row" style="flex-wrap:wrap"><button type="button" class="btn btn-primary" data-move="${b.id}">Move ${esc(countryName(b.team))} to the next free hour</button><button type="button" class="btn" data-cancel="${b.id}">Cancel ${esc(b.team)}'s booking</button></div></div>`).join(''))

  const pending = bookings.filter((b) => b.status === 'pending')
  document.getElementById('rq-count').textContent = `${pending.length} waiting`
  document.getElementById('requests').innerHTML = pending.length === 0 ? '<p class="card-pad muted">No requests waiting.</p>' : pending.map((b) => `
    <div class="card-pad stack" style="gap:12px;border-top:1px solid var(--border)">
      <div class="row" style="justify-content:space-between"><span class="row"><span class="country" style="background:${countryColor(b.team)}">${esc(b.team)}</span><span class="stack" style="gap:0"><strong>${esc(facName(b.facility))}</strong><span class="small muted">${esc(formatDate(b.date))} · ${hm(b.start)} to ${hm(b.end)}${b.by ? ` · ${esc(b.by)}` : ''}</span></span></span>
        ${bookings.some((x) => x.status === 'approved' && x.date === b.date && x.facility === b.facility && b.start < x.end && x.start < b.end) ? '<span class="badge badge-danger">Would clash</span>' : '<span class="badge badge-ok">No clash</span>'}</div>
      <div class="row"><button type="button" class="btn btn-primary" data-approve="${b.id}" style="flex:1">Approve</button><button type="button" class="btn" data-decline="${b.id}" style="flex:1">Decline</button></div></div>`).join('')
}

function update(list, msg) { bookings = list; saveBookings(bookings); draw(); if (msg) toast(msg) }
function nextFree(b) {
  for (let s = b.start; s + (b.end - b.start) <= TO; s += 0.5) {
    const e = s + (b.end - b.start)
    if (!bookings.some((x) => x.id !== b.id && x.status === 'approved' && x.date === b.date && x.facility === b.facility && s < x.end && x.start < e)) return [s, e]
  }
  return null
}
app.addEventListener('click', (e) => {
  const t = e.target.closest('button')
  if (!t) return
  if (t.id === 'prev' || t.id === 'next') { day = DAYS[DAYS.indexOf(day) + (t.id === 'next' ? 1 : -1)]; draw() }
  if (t.dataset.decline) update(bookings.filter((b) => b.id !== Number(t.dataset.decline)), 'Request declined. The team is told by email.')
  if (t.dataset.cancel) update(bookings.filter((b) => b.id !== Number(t.dataset.cancel)), 'Booking cancelled.')
  if (t.dataset.move) {
    const b = bookings.find((x) => x.id === Number(t.dataset.move)), slot = nextFree(b)
    if (!slot) { toast('No free time left this morning. Cancel or move it by hand.', 'error'); return }
    update(bookings.map((x) => (x === b ? { ...x, start: slot[0], end: slot[1] } : x)), `${countryName(b.team)} moved to ${hm(slot[0])}.`)
  }
  if (t.dataset.approve) {
    const b = bookings.find((x) => x.id === Number(t.dataset.approve))
    const m = openModal({ title: 'Approve this booking?', body: `<dl class="facts" style="flex-direction:column;gap:8px">
        <div><dt>Team</dt><dd>${esc(countryName(b.team))}${b.by ? `, requested by ${esc(b.by)}` : ''}</dd></div>
        <div><dt>Facility</dt><dd>${esc(facName(b.facility))}</dd></div><div><dt>When</dt><dd>${esc(formatDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${hm(b.start)} to ${hm(b.end)}</dd></div></dl>
        <label class="field"><span class="label">Note to the team (optional)</span><textarea class="input" id="note">Please return any equipment by ${hm(b.end)}.</textarea></label>`,
      actions: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" id="ok">Approve booking</button>' })
    m.el.querySelector('#ok').addEventListener('click', () => { m.close(); update(bookings.map((x) => (x === b ? { ...x, status: 'approved' } : x)), `${countryName(b.team)}'s booking is approved.`) })
  }
  if (t.dataset.booking) {
    const b = bookings.find((x) => x.id === Number(t.dataset.booking))
    if (!TEAMS.includes(b.team)) return
    const m = openModal({ title: `${countryName(b.team)} · ${facName(b.facility)}`, body: `<p>${esc(formatDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))}, ${hm(b.start)} to ${hm(b.end)}. Status: ${b.status === 'pending' ? 'waiting for approval' : 'approved'}.</p>`,
      actions: `<button type="button" class="btn" id="del" style="color:var(--danger);border-color:var(--danger)">Cancel booking</button><button type="button" class="btn btn-primary" data-close>Close</button>` })
    m.el.querySelector('#del').addEventListener('click', () => { m.close(); update(bookings.filter((x) => x !== b), 'Booking cancelled.') })
  }
  if (t.id === 'new') {
    const times = []; for (let h = FROM; h < TO; h += 0.5) times.push(h)
    const m = openModal({ title: 'New booking', body: `<form id="bk" class="form-grid">
        <label class="field" style="grid-column:1/-1"><span class="label">Facility</span><select class="select input" name="facility">${FACILITIES.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="label">Team</span><select class="select input" name="team">${TEAMS.map((c) => `<option value="${c}"${c === 'THA' ? ' selected' : ''}>${esc(countryName(c))} (${c})</option>`).join('')}</select></label>
        <label class="field"><span class="label">Day</span><select class="select input" name="date">${DAYS.map((d) => `<option value="${d}"${d === day ? ' selected' : ''}>${esc(formatDate(d))}</option>`).join('')}</select></label>
        <label class="field"><span class="label">From</span><select class="select input" name="start">${times.map((h) => `<option value="${h}">${hm(h)}</option>`).join('')}</select></label>
        <label class="field"><span class="label">For</span><select class="select input" name="len"><option value="0.5">30 minutes</option><option value="1" selected>1 hour</option><option value="1.5">1.5 hours</option><option value="2">2 hours</option></select></label>
        <p class="small" id="bk-err" role="alert" style="grid-column:1/-1;color:var(--danger);font-weight:600"></p></form>`,
      actions: '<button type="button" class="btn" data-close>Cancel</button><button type="submit" form="bk" class="btn btn-primary">Book</button>' })
    m.el.querySelector('#bk').addEventListener('submit', (ev) => {
      ev.preventDefault()
      const d = Object.fromEntries(new FormData(ev.target))
      const nb = { id: Math.max(0, ...bookings.map((b) => b.id)) + 1, date: d.date, facility: d.facility, team: d.team, start: Number(d.start), end: Number(d.start) + Number(d.len), status: 'approved', by: 'Competition office' }
      if (nb.end > TO) { m.el.querySelector('#bk-err').textContent = `Bookings must end by ${hm(TO)}.`; return }
      const hit = bookings.find((x) => x.status !== 'pending' && x.date === nb.date && x.facility === nb.facility && nb.start < x.end && x.start < nb.end)
      if (hit) { m.el.querySelector('#bk-err').textContent = `That time overlaps ${hit.team} (${hm(hit.start)} to ${hm(hit.end)}). Choose another time.`; return }
      m.close(); day = nb.date; update([...bookings, nb], `Booked: ${countryName(nb.team)}, ${hm(nb.start)} to ${hm(nb.end)}.`)
    })
  }
})
draw()
