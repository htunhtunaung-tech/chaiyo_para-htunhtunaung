// Delegations: pick a country, see its athletes, open one athlete's profile on the right.
import { getAthlete, getAthletes } from '../api.js'
import { countryColor, countryName, countryThai } from '../countries.js'
import { formatDate, genderLabel, initials } from '../format.js'
import { downloadCSV, renderAppShell } from '../manage-ui.js'
import { animateNumbers, countryChip, esc, icon, medalChip, skeletonRows, stateMessage, flagImg } from '../ui.js'

renderAppShell({ active: 'delegation', title: 'Delegations', th: 'คณะนักกีฬา' })
const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
let athletes = [], country = params.get('country') || '', search = '', selected = Number(params.get('athlete')) || null

app.innerHTML = `<div class="stack">
  <section class="card card-pad stack anim-rise" style="gap:16px">
    <div class="between">
      <label class="search" style="flex:1;max-width:420px"><span class="visually-hidden">Search athletes</span>${icon('search', 20, 'search-icon')}<input id="q" class="input" type="search" placeholder="Search by name, class or bib" autocomplete="off"></label>
      <button type="button" class="btn" id="export">${icon('down', 18)}Export list (CSV)</button>
    </div>
    <div class="chips chips-scroll" id="countries" role="group" aria-label="Delegation"></div>
  </section>
  <div class="cols">
    <section class="card" aria-labelledby="list-h"><div class="card-head"><h2 id="list-h">Athletes</h2><span class="small muted" id="count"></span></div><div id="list">${skeletonRows(8)}</div></section>
    <aside class="card" id="profile" aria-label="Athlete profile" style="position:sticky;top:96px"></aside>
  </div>
</div>`

const COLS = '56px minmax(0,1.6fr) 72px minmax(0,1fr) 72px'
function drawList() {
  const codes = [...new Set(athletes.map((a) => a.country))].sort()
  document.getElementById('countries').innerHTML = `<button type="button" class="chip" data-c="" aria-pressed="${!country}">All · ${athletes.length}</button>` + codes.map((c) =>
    `<button type="button" class="chip" data-c="${c}" aria-pressed="${country === c}">${flagImg(c, 'sm')}${esc(countryName(c))} · ${athletes.filter((a) => a.country === c).length}</button>`).join('')
  const q = search.toLowerCase()
  const shown = athletes.filter((a) => (!country || a.country === country) && (!q || [a.name, a.classification, a.bib, a.sport].join(' ').toLowerCase().includes(q)))
  document.getElementById('list-h').textContent = country ? `${countryName(country)} athletes` : 'All athletes'
  document.getElementById('count').textContent = `${shown.length} shown`
  document.getElementById('list').innerHTML = shown.length === 0 ? stateMessage({ kind: 'search', title: 'No athletes match', text: 'Try another name or delegation.' }) : `<div>
    <div class="table-head" aria-hidden="true" style="grid-template-columns:${COLS}"><span>Bib</span><span>Athlete</span><span>Class</span><span>Sport</span><span>Category</span></div>
    ${shown.map((a, i) => `<button type="button" data-id="${a.id}" class="table-row anim-rise" aria-pressed="${a.id === selected}"
        style="grid-template-columns:${COLS};--i:${Math.min(i, 12)};width:100%;border:0;border-top:1px solid var(--border);text-align:left;font:inherit;color:var(--text);background:${a.id === selected ? 'var(--primary-soft)' : 'var(--surface)'};box-shadow:${a.id === selected ? 'inset 4px 0 0 var(--primary)' : 'none'}">
      <span class="num" style="font-size:1.125rem">${esc(a.bib || '–')}</span>
      <span class="row" style="min-width:0">${countryChip(a.country)}<strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</strong></span>
      <span>${a.classification ? `<span class="badge badge-info">${esc(a.classification)}</span>` : '–'}</span>
      <span>${esc(a.sport || '–')}</span><span>${esc(genderLabel(a.gender))}</span></button>`).join('')}</div>`
}

async function drawProfile() {
  const box = document.getElementById('profile')
  if (!selected) { box.innerHTML = stateMessage({ title: 'Choose an athlete', text: 'Their profile, medals and events appear here.' }); return }
  box.innerHTML = skeletonRows(6)
  try {
    const a = await getAthlete(selected)
    const count = (m) => a.events.filter((e) => e.medal === m).length
    box.innerHTML = `<div class="anim-fade">
      <div style="background:var(--hero);color:#fff;padding:24px;display:flex;gap:16px;align-items:center">
        <span class="avatar" style="width:72px;height:72px;font-size:1.5rem;--ring:${countryColor(a.country)};box-shadow:0 0 0 3px var(--hero),0 0 0 6px var(--ring)">${esc(initials(a.name))}</span>
        <div class="stack" style="gap:6px;min-width:0"><h2 style="font-size:1.5rem">${esc(a.name)}</h2>
          <span class="row" style="flex-wrap:wrap">${countryChip(a.country)}<span>${esc(countryName(a.country))}</span><span class="th" lang="th" style="color:var(--hero-text)">${esc(countryThai(a.country))}</span></span></div></div>
      <div class="card-pad stack" style="gap:20px">
        <dl class="facts">${[['Sport class', a.classification], ['Sport', a.sport], ['Category', genderLabel(a.gender)], ['Bib', a.bib]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="profile-medals">${['gold', 'silver', 'bronze'].map((m) => `<div class="profile-medal" style="flex:1"><span class="medal medal-${m} medal-lg">${m[0].toUpperCase()}</span><span class="num" data-num="dp-${m}-${a.id}" data-value="${count(m)}"></span></div>`).join('')}</div>
        <div class="stack" style="gap:8px"><h3>Events</h3>${a.events.length === 0 ? '<p class="muted small">Not entered in any event yet.</p>' : a.events.map((e) => `
          <div class="row" style="justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)">
            <span class="row" style="min-width:0">${medalChip(e.medal, e.rank)}<span class="stack" style="gap:0;min-width:0"><a href="event.html?id=${e.eventId}" class="athlete-link">${esc(e.eventName)}</a><span class="small muted">${esc(formatDate(e.date))}</span></span></span>
            <span class="num" style="font-size:1.25rem">${esc(e.score || '–')}</span></div>`).join('')}</div>
        <a href="athlete.html?id=${a.id}" class="btn">${icon('globe', 18)}Public profile</a>
      </div></div>`
    animateNumbers(box)
  } catch (err) {
    box.innerHTML = stateMessage({ kind: 'error', title: "This athlete didn't load", text: err.message })
  }
}

function sync() { history.replaceState(null, '', `?${new URLSearchParams(Object.entries({ country, athlete: selected || '' }).filter(([, v]) => v))}`) }
app.addEventListener('click', (e) => {
  const c = e.target.closest('[data-c]'), row = e.target.closest('[data-id]')
  if (c) { country = c.dataset.c; drawList(); sync() }
  if (row) { selected = Number(row.dataset.id); drawList(); drawProfile(); sync(); document.querySelector(`[data-id="${selected}"]`)?.focus() }
})
document.getElementById('q').addEventListener('input', (e) => { search = e.target.value.trim(); drawList() })
document.getElementById('export').addEventListener('click', () => {
  const rows = athletes.filter((a) => !country || a.country === country)
  downloadCSV(`athletes-${country || 'all'}.csv`, [['Bib', 'Name', 'Country', 'Class', 'Sport', 'Gender'], ...rows.map((a) => [a.bib, a.name, a.country, a.classification, a.sport, genderLabel(a.gender)])])
})

getAthletes().then((list) => {
  athletes = list
  if (!selected) selected = (athletes.find((a) => !country || a.country === country) || {}).id || null
  drawList(); drawProfile()
}).catch((err) => { document.getElementById('list').innerHTML = stateMessage({ kind: 'error', title: "Athletes didn't load", text: err.message }) })
