// Athlete profile (athlete.html?id=3): details, medals and events at this meet.
import { getAthlete } from '../api.js'
import { countryColor, countryThai } from '../countries.js'
import { formatDate, genderLabel, initials } from '../format.js'
import { animateNumbers, countryChip, esc, icon, medalChip, poll, renderShell, skeletonRows, stateMessage } from '../ui.js'

renderShell('athletes')
const app = document.getElementById('app')
const id = new URLSearchParams(location.search).get('id')
app.innerHTML = `<div class="card">${skeletonRows(6)}</div>`

function draw(a) {
  document.title = `${a.name} · Chai-Yo Para`
  const count = (m) => a.events.filter((e) => e.medal === m).length
  const events = [...a.events].sort((x, y) => String(x.date).localeCompare(String(y.date)))
  const fact = (label, value, cls = '') => value ? `<div><dt>${label}</dt><dd class="${cls}">${esc(value)}</dd></div>` : ''
  app.innerHTML = `<div class="stack">
    <a href="athletes.html" class="btn btn-ghost back-link">${icon('chevL', 18)}Athletes</a>
    <section class="profile card anim-rise">
      <span class="avatar avatar-xl" style="--ring:${countryColor(a.country)}">${esc(initials(a.name))}</span>
      <div class="stack" style="gap:8px;min-width:0">
        <h1>${esc(a.name)}</h1>
        <div class="row" style="flex-wrap:wrap">${countryChip(a.country, true)}<span class="muted th" lang="th">${esc(countryThai(a.country))}</span></div>
        <dl class="facts">${fact('Sport class', a.classification)}${fact('Sport', a.sport)}${fact('Category', genderLabel(a.gender))}${fact('Bib', a.bib, 'num')}</dl>
      </div>
      <div class="profile-medals" aria-label="Medals at this meet">${['gold', 'silver', 'bronze'].map((m, i) => `
        <div class="profile-medal anim-rise" style="--i:${i + 2}"><span class="medal medal-${m} medal-lg">${m[0].toUpperCase()}</span>
          <span class="num" data-num="pm-${m}" data-value="${count(m)}"></span><span class="small muted">${m[0].toUpperCase() + m.slice(1)}</span></div>`).join('')}</div>
    </section>
    <section class="card" aria-labelledby="ev-title">
      <div class="card-head"><h2 id="ev-title">Events at this meet</h2><span class="small muted">${events.length} entered</span></div>
      ${events.length === 0 ? stateMessage({ title: 'No events yet', text: 'This athlete is not entered in any event so far.' }) : `<ol class="athlete-events">${events.map((e, i) => `
        <li class="anim-rise" style="--i:${i}">${medalChip(e.medal, e.rank)}
          <span class="stack" style="gap:2px;min-width:0">${e.eventId ? `<a href="event.html?id=${encodeURIComponent(e.eventId)}" class="athlete-link">${esc(e.eventName)}</a>` : `<span>${esc(e.eventName)}</span>`}
            <span class="small muted">${esc(formatDate(e.date))}${e.points !== '' && e.points !== null ? ` · ${esc(e.points)} points` : ''}</span></span>
          <span class="num result-mark">${e.score ? esc(e.score) : '<span class="small muted" style="font-family:var(--font-body);font-weight:600">Not yet</span>'}</span>
        </li>`).join('')}</ol>`}
    </section></div>`
  animateNumbers(app)
}

poll(async () => {
  if (!id) throw Object.assign(new Error('No athlete was chosen.'), { status: 404 })
  return getAthlete(id)
}, 0, {
  onData: draw,
  onError: (err) => {
    app.innerHTML = stateMessage({ kind: 'error', title: err.status === 404 ? 'We could not find this athlete' : "This athlete didn't load", text: err.message,
      action: '<a href="athletes.html" class="btn btn-primary">Back to athletes</a>' })
  },
})
