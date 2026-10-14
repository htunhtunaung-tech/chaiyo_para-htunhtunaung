// Athletes page: search (sent to the API) and a country filter.
import { getAthletes } from '../api.js'
import { countryColor, countryName } from '../countries.js'
import { genderLabel, initials } from '../format.js'
import { countryChip, debounce, esc, icon, pageHeader, poll, renderShell, stateMessage, flagImg } from '../ui.js'

renderShell('athletes')
const app = document.getElementById('app')
let athletes = null, country = '', search = '', firstDraw = true

app.innerHTML = `<div class="stack">
  ${pageHeader({ title: 'Athletes', th: 'นักกีฬา', eyebrow: 'Who is competing', photo: 'images/athlete-wheelchair.webp', pos: 'center 20%' })}
  <section class="card card-pad stack anim-rise" style="gap:16px;--i:1" aria-label="Search athletes">
    <label class="search"><span class="visually-hidden">Search by name or country</span>${icon('search', 20, 'search-icon')}
      <input class="input" id="q" type="search" placeholder="Search by name or country" autocomplete="off"><span class="search-spin" id="spin" hidden aria-hidden="true"></span></label>
    <div class="chips chips-scroll" role="group" aria-label="Country" id="countries"></div>
    <p class="small muted" aria-live="polite" id="count">Loading athletes…</p>
  </section>
  <div id="grid" class="grid-cards">${Array.from({ length: 8 }, () => '<div class="card card-pad"><div class="skeleton" style="height:96px"></div></div>').join('')}</div>
</div>`

function draw() {
  if (!athletes) return
  const countries = [...new Set(athletes.map((a) => a.country))].sort()
  if (country && !countries.includes(country)) country = ''
  document.getElementById('countries').innerHTML = countries.length < 2 ? '' :
    `<button type="button" class="chip" data-c="" aria-pressed="${!country}">All countries</button>` +
    countries.map((c) => `<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="${country === c}">${flagImg(c, 'sm')}${esc(countryName(c))}</button>`).join('')
  const shown = athletes.filter((a) => !country || a.country === country)
  document.getElementById('count').textContent = `${shown.length} ${shown.length === 1 ? 'athlete' : 'athletes'}`
  const grid = document.getElementById('grid')
  if (shown.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1">${stateMessage({ kind: 'search', title: `No athletes match "${search}"`, text: 'Check the spelling, or search by country.', action: '<button type="button" class="btn" id="clear">Clear search</button>' })}</div>`
    document.getElementById('clear').addEventListener('click', () => { document.getElementById('q').value = ''; search = ''; country = ''; athletePoll.refresh() })
    return
  }
  grid.innerHTML = shown.map((a, i) => `
    <a href="athlete.html?id=${encodeURIComponent(a.id)}" class="athlete-card card lift anim-rise" style="--i:${firstDraw ? Math.min(i, 12) : Math.min(i, 6)}">
      <span class="avatar" style="--ring:${countryColor(a.country)}">${esc(initials(a.name))}</span>
      <span class="stack" style="gap:4px;min-width:0"><span class="athlete-name">${esc(a.name)}</span>${countryChip(a.country, true)}
        <span class="row small muted" style="flex-wrap:wrap">${a.classification ? `<span class="badge badge-info">${esc(a.classification)}</span>` : ''}${esc([a.sport, genderLabel(a.gender)].filter(Boolean).join(' · '))}</span></span>
    </a>`).join('')
  firstDraw = false
}

document.getElementById('countries').addEventListener('click', (e) => {
  const b = e.target.closest('[data-c]')
  if (b) { country = b.dataset.c; draw() }
})
const athletePoll = poll(() => getAthletes(search), 0, {
  onData: (data) => { athletes = data; document.getElementById('spin').hidden = true; draw() },
  onError: (err) => {
    document.getElementById('spin').hidden = true
    document.getElementById('grid').innerHTML = `<div style="grid-column:1/-1">${stateMessage({ kind: 'error', title: "Athletes didn't load", text: err.message, action: `<button type="button" class="btn btn-primary" id="retry">${icon('refresh', 18)}Try again</button>` })}</div>`
    document.getElementById('retry').addEventListener('click', () => athletePoll.refresh())
  },
})
const runSearch = debounce(() => athletePoll.refresh(), 300)
document.getElementById('q').addEventListener('input', (e) => {
  search = e.target.value.trim()
  document.getElementById('spin').hidden = false
  runSearch()
})
