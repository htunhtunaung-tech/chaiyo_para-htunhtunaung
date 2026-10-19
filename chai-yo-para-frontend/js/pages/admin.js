// Admin: website accounts (real, same as Django /admin/), reports built from the live API as CSV files, and settings.
import { createUser, decideJudge, deleteUser, getAthletes, getEvents, getJudges, getUsers, isMock, updateAthlete, updateUser } from '../api.js'
import { countryName } from '../countries.js'
import { loadEventsWithResults, medalTable } from '../data.js'
import { getSettings, saveSettings } from '../demo-data.js'
import { formatDate, genderLabel } from '../format.js'
import { downloadCSV, openModal, renderAppShell, toast } from '../manage-ui.js'
import { esc, icon } from '../ui.js'

let users = [], role = '', search = '', athletes = [], athleteSearch = '', settings = getSettings()
renderAppShell({ active: 'admin', title: 'Admin', th: 'ผู้ใช้ รายงาน และการตั้งค่า' })
const app = document.getElementById('app')
const ROLES = { admin: 'Admin', judge: 'Judge', athlete: 'Athlete', team_official: 'Team official', visitor: 'Visitor' }

app.innerHTML = `<div class="stack">
  <nav class="row anim-rise" aria-label="Admin sections"><a href="#users" class="btn">${icon('users', 18)}Users</a><a href="#athletes" class="btn">${icon('users', 18)}Athletes</a><a href="#reports" class="btn">${icon('down', 18)}Reports</a><a href="#settings" class="btn">${icon('gear', 18)}Settings</a></nav>
  <section class="card anim-rise" id="judge-requests" aria-labelledby="jr-h" style="--i:1;scroll-margin-top:96px">
    <div class="card-head"><div class="stack" style="gap:2px"><h2 id="jr-h">Judge requests</h2><span class="small muted" id="jr-note">Loading…</span></div></div>
    <div id="jr-list"></div>
  </section>
  <section class="card anim-rise" id="users" aria-labelledby="u-h" style="--i:1;scroll-margin-top:96px">
    <div class="card-head"><div class="stack" style="gap:2px"><h2 id="u-h">Users and roles</h2><span class="small muted" id="u-note">Loading…</span></div>
      <div class="row" style="flex-wrap:wrap"><label class="search" style="width:260px"><span class="visually-hidden">Search users</span>${icon('search', 20, 'search-icon')}<input id="uq" class="input" type="search" placeholder="Search users" style="min-height:44px"></label>
        <button type="button" class="btn btn-primary" id="invite">${icon('plus', 18)}Add user</button></div></div>
    <div class="chips" id="roles" style="padding:12px 24px;border-bottom:1px solid var(--border)"></div>
    <div id="user-list"></div>
  </section>
  <section class="card anim-rise" id="athletes" aria-labelledby="a-h" style="--i:2;scroll-margin-top:96px">
    <div class="card-head"><div class="stack" style="gap:2px"><h2 id="a-h">Athletes</h2><span class="small muted" id="a-note">Loading athletes from Django…</span></div>
      <label class="search" style="width:260px"><span class="visually-hidden">Search athletes</span>${icon('search', 20, 'search-icon')}<input id="aq" class="input" type="search" placeholder="Search athletes" style="min-height:44px"></label></div>
    <div id="athlete-list"></div>
  </section>
  <section id="reports" class="stack anim-rise" style="--i:3;gap:16px;scroll-margin-top:96px" aria-labelledby="r-h">
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
// Users are the real website accounts (the same ones as in Django /admin/).
const fullName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username
const initials = (u) => fullName(u).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const stateOf = (u) => (!u.is_active ? 'locked' : u.judge_status === 'pending' ? 'waiting' : 'active')
const seenOf = (u) => (u.last_login ? new Date(u.last_login).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never')
function drawUsers() {
  const waiting = users.filter((u) => stateOf(u) === 'waiting').length
  $('u-note').textContent = `${users.length} accounts · ${waiting} waiting for approval`
  $('roles').innerHTML = [['', 'All'], ...Object.entries(ROLES)].map(([k, l]) => `<button type="button" class="chip" data-role="${k}" aria-pressed="${k === role}">${l} <span class="muted small">${users.filter((u) => !k || u.role === k).length}</span></button>`).join('')
  const q = search.toLowerCase()
  const shown = users.filter((u) => (!role || u.role === role) && (!q || `${fullName(u)} ${u.username} ${u.email}`.toLowerCase().includes(q)))
    .sort((a, b) => (stateOf(a) === 'waiting' ? 0 : 1) - (stateOf(b) === 'waiting' ? 0 : 1))
  const COLS = 'minmax(0,1.4fr) 160px 110px 120px 230px'
  $('user-list').innerHTML = `<div style="overflow-x:auto"><div style="min-width:820px">
    <div class="table-head" style="grid-template-columns:${COLS}"><span>Name</span><span>Role</span><span>Status</span><span>Last sign-in</span><span></span></div>
    ${shown.map((u, i) => { const st = stateOf(u); return `<div class="table-row anim-rise" style="grid-template-columns:${COLS};--i:${Math.min(i, 10)};${st === 'waiting' ? 'box-shadow:inset 4px 0 0 var(--warn)' : ''}">
      <span class="row" style="min-width:0"><span class="avatar" style="width:40px;height:40px;font-size:.875rem;--ring:var(--border-strong)">${esc(initials(u))}</span><span class="stack" style="gap:0;min-width:0"><strong>${esc(fullName(u))}</strong><span class="small muted">${esc(u.username)}${u.email ? ` · ${esc(u.email)}` : ''}</span></span></span>
      <label><span class="visually-hidden">Role for ${esc(u.username)}</span><select class="input-sm" data-setrole="${u.id}"${u.is_superuser ? ' disabled title="Django superusers are always admins"' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <span><span class="badge ${st === 'active' ? 'badge-ok' : st === 'waiting' ? 'badge-warn' : 'badge-danger'}">${st === 'active' ? 'Active' : st === 'waiting' ? 'Waiting' : 'Locked'}</span></span>
      <span class="small muted">${esc(seenOf(u))}</span>
      <span class="row" style="justify-content:flex-end;flex-wrap:wrap">${st === 'waiting' ? `<button type="button" class="btn btn-primary" data-judge="approve" data-uid="${u.id}" style="min-height:40px">Approve</button>` : ''}<button type="button" class="btn" data-edit="${u.id}" style="min-height:40px">Edit</button>${u.is_active ? `<button type="button" class="btn" data-lock="${u.id}" style="min-height:40px">Lock</button>` : `<button type="button" class="btn" data-unlock="${u.id}" style="min-height:40px">Unlock</button>`}<button type="button" class="btn btn-icon" data-delete="${u.id}" aria-label="Delete ${esc(u.username)}" style="min-height:40px">${icon('x', 18)}</button></span>
    </div>` }).join('') || '<p class="card-pad muted">No users match.</p>'}</div></div>`
}
async function loadUsers() {
  if (isMock) { $('u-note').textContent = 'Not available in demo mode. Set USE_MOCK = false in js/config.js.'; return }
  try { users = await getUsers(); drawUsers() } catch (err) { $('u-note').textContent = err.message }
}

function drawAthletes() {
  const q = athleteSearch.toLowerCase()
  const shown = athletes.filter((a) => `${a.name || ''} ${a.country || ''} ${a.classification || ''} ${a.gender || ''}`.toLowerCase().includes(q))
  $('a-note').textContent = `${shown.length} of ${athletes.length} athletes`
  const cols = 'minmax(0,1.4fr) minmax(120px,1fr) 100px 110px minmax(180px,1fr) 110px'
  $('athlete-list').innerHTML = `<div style="overflow-x:auto"><div style="min-width:620px">
    <div class="table-head" style="grid-template-columns:${cols}"><span>Name</span><span>Country</span><span>Gender</span><span>Classification</span><span>Linked athlete account</span><span></span></div>
    ${shown.map((a, i) => `<div class="table-row anim-rise" style="grid-template-columns:${cols};--i:${Math.min(i, 10)}">
      <strong>${esc(a.name || '—')}</strong><span>${esc(countryName(a.country) || a.country || '—')}</span><span>${esc(genderLabel(a.gender) || '—')}</span><span>${esc(a.classification || '—')}</span><span class="small">${a.user_username ? `<strong>${esc(a.user_username)}</strong>${a.user_email ? `<br>${esc(a.user_email)}` : ''}` : '<span class="muted">No matching account linked</span>'}</span><span><button type="button" class="btn" data-link-athlete="${a.id}" style="min-height:40px">${a.user_username ? 'Change link' : 'Link account'}</button></span>
    </div>`).join('') || '<p class="card-pad muted">No athletes found.</p>'}</div></div>`
}
async function loadAthletes() {
  if (isMock) { $('a-note').textContent = 'Set USE_MOCK = false in js/config.js to load athletes from Django.'; return }
  try { athletes = await getAthletes(); drawAthletes() }
  catch (err) { $('a-note').textContent = `Could not load athletes: ${err.message}`; $('athlete-list').innerHTML = '<p class="card-pad muted">Check that Django is running and /api/athletes/ returns athlete records.</p>' }
}
// Create or edit an account. `u` is null for a new user.
function userForm(u) {
  const m = openModal({ title: u ? `Edit ${u.username}` : 'Add a user', body: `<form id="uf" class="form-grid">
      <label class="field"><span class="label">Username</span><input class="input" name="username" value="${esc(u?.username || '')}" required autocomplete="off"></label>
      <label class="field"><span class="label">Email</span><input class="input" type="email" name="email" value="${esc(u?.email || '')}"></label>
      <label class="field"><span class="label">First name</span><input class="input" name="first_name" value="${esc(u?.first_name || '')}"></label>
      <label class="field"><span class="label">Last name</span><input class="input" name="last_name" value="${esc(u?.last_name || '')}"></label>
      <label class="field"><span class="label">Role</span><select class="select input" name="role"${u?.is_superuser ? ' disabled' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}"${(u?.role || 'visitor') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span class="label">${u ? 'New password (leave empty to keep)' : 'Password'}</span><input class="input" type="password" name="password" autocomplete="new-password"${u ? '' : ' required'}></label>
      <label class="row" style="min-height:44px;grid-column:1/-1"><input type="checkbox" name="is_active" ${!u || u.is_active ? 'checked' : ''} style="width:20px;height:20px;flex:none;accent-color:var(--primary)">Account is active (untick to lock it)</label>
      <p class="small" id="uf-err" role="alert" style="grid-column:1/-1;color:var(--danger);font-weight:600"></p></form>`,
    actions: `<button type="button" class="btn" data-close>Cancel</button><button type="submit" form="uf" class="btn btn-primary">${u ? 'Save changes' : 'Create user'}</button>` })
  m.el.querySelector('#uf').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const f = ev.target, body = { username: f.username.value.trim(), email: f.email.value.trim(), first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(), is_active: f.is_active.checked }
    if (!f.role.disabled) body.role = f.role.value
    if (f.password.value) body.password = f.password.value
    const btn = m.el.querySelector('button[type=submit]'); btn.disabled = true
    try {
      if (u) await updateUser(u.id, body); else await createUser(body)
      m.close(); toast(u ? 'Account saved.' : 'Account created.'); await loadUsers(); await loadRequests()
    } catch (err) { m.el.querySelector('#uf-err').textContent = err.message; btn.disabled = false }
  })
}
async function patchUser(id, data, msg) {
  try { await updateUser(id, data); toast(msg); await loadUsers(); await loadRequests() } catch (err) { toast(err.message, 'error'); drawUsers() }
}
// Judge requests are real: they come from the backend and only an admin can approve them.
let requests = []
function drawRequests() {
  $('jr-note').textContent = requests.length ? `${requests.length} waiting for approval` : 'No requests waiting.'
  $('jr-list').innerHTML = requests.map((u) => `<div class="list-row" style="grid-template-columns:minmax(0,1fr) auto;padding:12px 24px;box-shadow:inset 4px 0 0 var(--warn)">
    <span class="stack" style="gap:0"><strong>${esc(u.username)}</strong><span class="small muted">${esc(u.email || 'no email')} · wants to be a judge</span></span>
    <span class="row"><button type="button" class="btn btn-primary" data-judge="approve" data-uid="${u.id}" style="min-height:40px">Approve</button><button type="button" class="btn" data-judge="reject" data-uid="${u.id}" style="min-height:40px">Decline</button></span></div>`).join('')
}
async function loadRequests() {
  if (isMock) { $('jr-note').textContent = 'Not available in demo mode.'; return }
  try { requests = await getJudges('pending'); drawRequests() } catch (err) { $('jr-note').textContent = err.message }
}

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
  ['Accounts', 'Users, roles and status', 'gear', async () => { const all = await getUsers(); return ['accounts.csv', [['Username', 'Name', 'Email', 'Role', 'Status', 'Last sign-in'], ...all.map((u) => [u.username, fullName(u), u.email, ROLES[u.role] || u.role, stateOf(u), seenOf(u)])]] }],
]
$('report-list').innerHTML = REPORTS.map(([name, note, ic], i) => `<article class="card card-pad lift anim-rise" style="--i:${i};display:grid;grid-template-columns:44px minmax(0,1fr);gap:16px;align-items:start">
  <span class="icon-tile tone-info">${icon(ic, 22)}</span><span class="stack" style="gap:6px"><h3>${name}</h3><span class="small muted">${note}</span>
  <button type="button" class="btn" data-report="${i}" aria-label="Download ${name} as CSV" style="align-self:flex-start;white-space:nowrap">${icon('down', 18)}Download</button></span></article>`).join('')

app.addEventListener('click', async (e) => {
  const b = e.target.closest('button')
  if (!b) return
  const id = (k) => Number(b.dataset[k])
  if (b.dataset.judge) {
    b.disabled = true
    try { await decideJudge(id('uid'), b.dataset.judge); toast(b.dataset.judge === 'approve' ? 'Judge approved. They can sign in as a judge now.' : 'Request declined.'); await loadRequests(); await loadUsers() } catch (err) { toast(err.message, 'error'); b.disabled = false }
    return
  }
  if (b.dataset.linkAthlete) {
    const a = athletes.find((x) => x.id === id('linkAthlete'))
    const athleteUsers = users.filter((u) => u.role === 'athlete')
    const options = [`<option value="">No linked account</option>`, ...athleteUsers.map((u) => `<option value="${u.id}"${String(a.user ?? '') === String(u.id) ? ' selected' : ''}>${esc(fullName(u))} (@${esc(u.username)})${u.email ? ` · ${esc(u.email)}` : ''}</option>`)]
    const m = openModal({ title: `Link account · ${a.name}`, body: `<form id="alf" class="form-grid"><label class="field" style="grid-column:1/-1"><span class="label">Existing athlete account</span><select class="select input" name="user">${options.join('')}</select></label><p class="small muted" style="grid-column:1/-1">Only existing accounts with role=athlete are listed. This does not create or change any user account or role.</p><p class="small" id="alf-err" role="alert" style="grid-column:1/-1;color:var(--danger)"></p></form>`, actions: '<button type="button" class="btn" data-close>Cancel</button><button type="submit" form="alf" class="btn btn-primary">Save link</button>' })
    m.el.querySelector('#alf').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = m.el.querySelector('button[type=submit]'); btn.disabled = true
      try { await updateAthlete(a.id, { user: ev.target.user.value || null }); m.close(); toast('Athlete account link saved.'); await loadAthletes() }
      catch (err) { m.el.querySelector('#alf-err').textContent = err.message; btn.disabled = false }
    })
    return
  }
  if (b.dataset.role !== undefined) { role = b.dataset.role; drawUsers() }
  if (b.dataset.edit) userForm(users.find((u) => u.id === id('edit')))
  if (b.dataset.lock) patchUser(id('lock'), { is_active: false }, 'Account locked. They are signed out.')
  if (b.dataset.unlock) patchUser(id('unlock'), { is_active: true }, 'Account unlocked.')
  if (b.dataset.delete) {
    const u = users.find((x) => x.id === id('delete'))
    const m = openModal({ title: `Delete ${u.username}?`, body: `<p>This removes the account for good. To keep it but stop them signing in, use <strong>Lock</strong> instead.</p><p class="small" id="del-err" role="alert" style="color:var(--danger);font-weight:600"></p>`,
      actions: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" id="del-ok">Delete account</button>' })
    m.el.querySelector('#del-ok').addEventListener('click', async () => {
      try { await deleteUser(u.id); m.close(); toast('Account deleted.'); await loadUsers() } catch (err) { m.el.querySelector('#del-err').textContent = err.message }
    })
  }
  if (b.dataset.report) {
    b.disabled = true
    try { const [file, rows] = await REPORTS[id('report')][3](); downloadCSV(file, rows); toast(`${file} downloaded (${rows.length - 1} rows).`) } catch (err) { toast(err.message, 'error') }
    b.disabled = false
  }
  if (b.id === 'invite') userForm(null)
})
app.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-setrole]')
  if (sel) { const u = users.find((x) => x.id === Number(sel.dataset.setrole)); patchUser(u.id, { role: sel.value }, `${u.username} is now ${ROLES[sel.value].toLowerCase()}.`) }
})
$('uq').addEventListener('input', (e) => { search = e.target.value.trim(); drawUsers() })
$('aq').addEventListener('input', (e) => { athleteSearch = e.target.value.trim(); drawAthletes() })
$('set').addEventListener('submit', (e) => {
  e.preventDefault()
  const f = e.target
  settings = { protest: f.protest.value, unofficial: f.unofficial.value, thai: f.thai.checked, autoMedals: f.autoMedals.checked }
  saveSettings(settings); toast('Settings saved.')
})
loadUsers()
loadRequests()
loadAthletes()
