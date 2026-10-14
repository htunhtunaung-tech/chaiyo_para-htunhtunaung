// Admin: user accounts (demo data), reports built from the live API as CSV files, and settings.
import { getAthletes, getEvents } from '../api.js'
import { ALL_COUNTRIES, countryColor, countryName } from '../countries.js'
import { loadEventsWithResults, medalTable } from '../data.js'
import { getSettings, getUsers, saveSettings, saveUsers } from '../demo-data.js'
import { formatDate, genderLabel } from '../format.js'
import { downloadCSV, openModal, renderAppShell, toast } from '../manage-ui.js'
import { esc, icon } from '../ui.js'

let users = getUsers(), role = '', search = '', settings = getSettings()
renderAppShell({ active: 'admin', title: 'Admin', th: 'ผู้ใช้ รายงาน และการตั้งค่า', badges: { admin: users.filter((u) => u.status === 'waiting').length || '' } })
const app = document.getElementById('app')
const ROLES = { admin: 'Admin', judge: 'Judge', sporter: 'Athlete', team: 'Team official' }

app.innerHTML = `<div class="stack">
  <nav class="row anim-rise" aria-label="Admin sections"><a href="#users" class="btn">${icon('users', 18)}Users</a><a href="#reports" class="btn">${icon('down', 18)}Reports</a><a href="#settings" class="btn">${icon('gear', 18)}Settings</a></nav>
  <section class="card anim-rise" id="users" aria-labelledby="u-h" style="--i:1;scroll-margin-top:96px">
    <div class="card-head"><div class="stack" style="gap:2px"><h2 id="u-h">Users and roles</h2><span class="small muted" id="u-note"></span></div>
      <div class="row" style="flex-wrap:wrap"><label class="search" style="width:260px"><span class="visually-hidden">Search users</span>${icon('search', 20, 'search-icon')}<input id="uq" class="input" type="search" placeholder="Search users" style="min-height:44px"></label>
        <button type="button" class="btn btn-primary" id="invite">${icon('plus', 18)}Invite user</button></div></div>
    <div class="chips" id="roles" style="padding:12px 24px;border-bottom:1px solid var(--border)"></div>
    <div id="user-list"></div>
  </section>
  <section id="reports" class="stack anim-rise" style="--i:2;gap:16px;scroll-margin-top:96px" aria-labelledby="r-h">
    <div class="between"><div class="stack" style="gap:2px"><h2 id="r-h">Reports</h2><span class="small muted">Built from the live data when you click. Opens in Excel or Google Sheets.</span></div></div>
    <div class="grid-cards" id="report-list"></div>
  </section>
  <section id="settings" class="card card-pad stack anim-rise" style="--i:3;gap:20px;scroll-margin-top:96px" aria-labelledby="s-h">
    <h2 id="s-h">Settings</h2>
    <form id="set" class="form-grid">
      <label class="field"><span class="label">Protest window after results are posted</span><select class="select input" name="protest">${['15', '30', '45'].map((v) => `<option value="${v}"${settings.protest === v ? ' selected' : ''}>${v} minutes</option>`).join('')}</select></label>
      <label class="field"><span class="label">Unofficial results on the public site</span><select class="select input" name="unofficial"><option value="label"${settings.unofficial === 'label' ? ' selected' : ''}>Show with an "Unofficial" label</option><option value="hide"${settings.unofficial === 'hide' ? ' selected' : ''}>Hide until official</option></select></label>
      <label class="row" style="min-height:44px"><input type="checkbox" name="thai" ${settings.thai ? 'checked' : ''} style="width:20px;height:20px;flex:none;accent-color:var(--primary)">Show Thai names next to English</label>
      <label class="row" style="min-height:44px"><input type="checkbox" name="autoMedals" ${settings.autoMedals ? 'checked' : ''} style="width:20px;height:20px;flex:none;accent-color:var(--primary)">Set medals from ranks when results are published</label>
      <div class="row" style="grid-column:1/-1;justify-content:flex-end"><button type="submit" class="btn btn-primary">${icon('save', 18)}Save settings</button></div>
    </form>
  </section>
</div>`

const $ = (id) => document.getElementById(id)
function drawUsers() {
  const waiting = users.filter((u) => u.status === 'waiting').length
  $('u-note').textContent = `${users.length} accounts · ${waiting} waiting for approval`
  $('roles').innerHTML = [['', 'All'], ...Object.entries(ROLES)].map(([k, l]) => `<button type="button" class="chip" data-role="${k}" aria-pressed="${k === role}">${l} <span class="muted small">${users.filter((u) => !k || u.role === k).length}</span></button>`).join('')
  const q = search.toLowerCase()
  const shown = users.filter((u) => (!role || u.role === role) && (!q || `${u.name} ${u.job} ${u.country}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1))
  const COLS = 'minmax(0,1.4fr) 160px 90px 110px 110px 190px'
  $('user-list').innerHTML = `<div style="overflow-x:auto"><div style="min-width:860px">
    <div class="table-head" style="grid-template-columns:${COLS}"><span>Name</span><span>Role</span><span>Team</span><span>Status</span><span>Last seen</span><span></span></div>
    ${shown.map((u, i) => `<div class="table-row anim-rise" style="grid-template-columns:${COLS};--i:${Math.min(i, 10)};${u.status === 'waiting' ? 'box-shadow:inset 4px 0 0 var(--warn)' : ''}">
      <span class="row" style="min-width:0"><span class="avatar" style="width:40px;height:40px;font-size:.875rem;--ring:${u.country ? countryColor(u.country) : 'var(--border-strong)'}">${esc(u.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span><span class="stack" style="gap:0;min-width:0"><strong>${esc(u.name)}</strong><span class="small muted">${esc(u.job)}</span></span></span>
      <label><span class="visually-hidden">Role for ${esc(u.name)}</span><select class="input-sm" data-setrole="${u.id}">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <span>${u.country ? `<span class="country" style="background:${countryColor(u.country)}" title="${esc(countryName(u.country))}">${esc(u.country)}</span>` : '<span class="muted">–</span>'}</span>
      <span><span class="badge ${u.status === 'active' ? 'badge-ok' : u.status === 'waiting' ? 'badge-warn' : 'badge-danger'}">${u.status === 'active' ? 'Active' : u.status === 'waiting' ? 'Waiting' : 'Locked'}</span></span>
      <span class="small muted">${esc(u.seen)}</span>
      <span class="row" style="justify-content:flex-end">${u.status === 'waiting' ? `<button type="button" class="btn btn-primary" data-approve="${u.id}" style="min-height:40px">Approve</button><button type="button" class="btn" data-remove="${u.id}" style="min-height:40px">Decline</button>`
        : u.status === 'locked' ? `<button type="button" class="btn" data-unlock="${u.id}" style="min-height:40px">Unlock</button>` : `<button type="button" class="btn" data-lock="${u.id}" style="min-height:40px">Lock</button>`}</span>
    </div>`).join('') || '<p class="card-pad muted">No users match.</p>'}</div></div>`
}
function setUsers(next, msg) { users = next; saveUsers(users); drawUsers(); if (msg) toast(msg) }

const REPORTS = [
  ['Results book', 'Every result in every event', 'flag', async () => {
    const evs = await loadEventsWithResults()
    return ['results-book.csv', [['Date', 'Time', 'Event', 'Rank', 'Athlete', 'Country', 'Result', 'Points', 'Medal'], ...evs.flatMap((e) => e.results.map((r) => [e.date, e.time, e.name, r.rank ?? '', r.name, r.country, r.score, r.points ?? '', r.medal]))]]
  }],
  ['Medal table', 'Gold, silver and bronze by country', 'medal', async () => {
    const t = medalTable(await loadEventsWithResults())
    return ['medal-table.csv', [['Rank', 'Country', 'Gold', 'Silver', 'Bronze', 'Total'], ...t.map((r, i) => [i + 1, r.name, r.gold, r.silver, r.bronze, r.total])]]
  }],
  ['Start lists', 'Athletes in events that have not started', 'list', async () => {
    const evs = (await getEvents()).filter((e) => e.status === 'start-list')
    return ['start-lists.csv', [['Date', 'Time', 'Event', 'Order', 'Athlete', 'Country'], ...evs.flatMap((e) => e.participants.map((p, i) => [e.date, e.time, e.name, i + 1, p.name, p.country]))]]
  }],
  ['Schedule', 'All events with time, venue and status', 'cal', async () => {
    const evs = await getEvents()
    return ['schedule.csv', [['Date', 'Time', 'Event', 'Sport', 'Gender', 'Venue', 'Status', 'Judge'], ...evs.map((e) => [e.date, e.time, e.name, e.sport, genderLabel(e.gender), e.venue, e.status, e.judge])]]
  }],
  ['Athletes', 'Everyone entered, by country', 'users', async () => {
    const a = await getAthletes()
    return ['athletes.csv', [['Bib', 'Name', 'Country', 'Class', 'Sport', 'Gender'], ...a.map((x) => [x.bib, x.name, countryName(x.country), x.classification, x.sport, genderLabel(x.gender)])]]
  }],
  ['Accounts', 'Users, roles and status (demo data)', 'gear', async () => ['accounts.csv', [['Name', 'Role', 'Team', 'Status'], ...users.map((u) => [u.name, ROLES[u.role], u.country, u.status])]]],
]
$('report-list').innerHTML = REPORTS.map(([name, note, ic], i) => `<article class="card card-pad lift anim-rise" style="--i:${i};display:grid;grid-template-columns:44px minmax(0,1fr);gap:16px;align-items:start">
  <span class="icon-tile tone-info">${icon(ic, 22)}</span><span class="stack" style="gap:6px"><h3>${name}</h3><span class="small muted">${note}</span>
  <button type="button" class="btn" data-report="${i}" aria-label="Download ${name} as CSV" style="align-self:flex-start;white-space:nowrap">${icon('down', 18)}Download</button></span></article>`).join('')

app.addEventListener('click', async (e) => {
  const b = e.target.closest('button')
  if (!b) return
  const id = (k) => Number(b.dataset[k])
  if (b.dataset.role !== undefined) { role = b.dataset.role; drawUsers() }
  if (b.dataset.approve) setUsers(users.map((u) => (u.id === id('approve') ? { ...u, status: 'active', seen: 'Just approved' } : u)), 'Account approved. They can sign in now.')
  if (b.dataset.remove) setUsers(users.filter((u) => u.id !== id('remove')), 'Request declined.')
  if (b.dataset.lock) setUsers(users.map((u) => (u.id === id('lock') ? { ...u, status: 'locked' } : u)), 'Account locked.')
  if (b.dataset.unlock) setUsers(users.map((u) => (u.id === id('unlock') ? { ...u, status: 'active' } : u)), 'Account unlocked.')
  if (b.dataset.report) {
    b.disabled = true
    try { const [file, rows] = await REPORTS[id('report')][3](); downloadCSV(file, rows); toast(`${file} downloaded (${rows.length - 1} rows).`) } catch (err) { toast(err.message, 'error') }
    b.disabled = false
  }
  if (b.id === 'invite') {
    const m = openModal({ title: 'Invite a user', body: `<form id="inv" class="form-grid">
        <label class="field" style="grid-column:1/-1"><span class="label">Full name</span><input class="input" name="name" required></label>
        <label class="field"><span class="label">Role</span><select class="select input" name="role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="field"><span class="label">Team (optional)</span><select class="select input" name="country"><option value="">None</option>${ALL_COUNTRIES.map((c) => `<option value="${c}">${esc(countryName(c))} (${c})</option>`).join('')}</select></label>
        <p class="small" id="inv-err" role="alert" style="grid-column:1/-1;color:var(--danger);font-weight:600"></p></form>`,
      actions: '<button type="button" class="btn" data-close>Cancel</button><button type="submit" form="inv" class="btn btn-primary">Send invitation</button>' })
    m.el.querySelector('#inv').addEventListener('submit', (ev) => {
      ev.preventDefault()
      const d = Object.fromEntries(new FormData(ev.target))
      if (!d.name.trim()) { m.el.querySelector('#inv-err').textContent = 'Enter the person\'s name.'; return }
      m.close()
      setUsers([...users, { id: Math.max(0, ...users.map((u) => u.id)) + 1, name: d.name.trim(), role: d.role, country: d.country, status: 'active', job: ROLES[d.role], seen: 'Invited' }], `Invitation sent to ${d.name.trim()}.`)
    })
  }
})
app.addEventListener('change', (e) => {
  const s = e.target.closest('[data-setrole]')
  if (s) { const u = users.find((x) => x.id === Number(s.dataset.setrole)); setUsers(users.map((x) => (x === u ? { ...x, role: s.value } : x)), `${u.name} is now ${ROLES[s.value].toLowerCase()}.`) }
})
$('uq').addEventListener('input', (e) => { search = e.target.value.trim(); drawUsers() })
$('set').addEventListener('submit', (e) => {
  e.preventDefault()
  const f = e.target
  settings = { protest: f.protest.value, unofficial: f.unofficial.value, thai: f.thai.checked, autoMedals: f.autoMedals.checked }
  saveSettings(settings); toast('Settings saved.')
})
drawUsers()
