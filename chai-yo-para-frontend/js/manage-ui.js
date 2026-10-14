// Shared pieces for the staff pages (laptop layout with a sidebar).
import { isMock } from './api.js'
import { getUser, signOut } from './auth.js'
import { esc, icon, renderDisplayMenu } from './ui.js'

export const NAV = [
  { href: 'dashboard.html', key: 'dashboard', label: 'Dashboard', icon: 'dash' },
  { href: 'team.html', key: 'team', label: 'Team manager view', icon: 'users' },
  { href: 'delegation.html', key: 'delegation', label: 'Delegations', icon: 'user' },
  { href: 'events-admin.html', key: 'events', label: 'Event setup', icon: 'flag' },
  { href: 'timetable.html', key: 'timetable', label: 'Timetable', icon: 'cal' },
  { href: 'results-entry.html', key: 'results', label: 'Results entry', icon: 'timer' },
  { href: 'medals.html', key: 'medals', label: 'Medals and statistics', icon: 'medal' },
  { href: 'venues.html', key: 'venues', label: 'Venues', icon: 'pin' },
  { href: 'announcements.html', key: 'announcements', label: 'Announcements', icon: 'mega' },
  { href: 'admin.html', key: 'admin', label: 'Admin', icon: 'gear' },
]

// Who may open which staff page. Admin can open everything.
// Judges can open the dashboard, timetable, results entry and medals (they enter results).
// Assumption: the TOR gives sporters and visitors no staff rights.
const ADMIN_ONLY = ['events', 'admin', 'venues', 'announcements']
function canOpen(user, active) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'judge') return !ADMIN_ONLY.includes(active)
  return false
}

// Stops the page (throws) when the visitor is not allowed, so nothing else on the page runs.
function guard(active) {
  const user = getUser()
  if (canOpen(user, active)) return user
  if (!user) {
    location.replace(`login.html?reason=staff&next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`)
  } else {
    document.body.innerHTML = `<main class="container" style="padding:64px 0"><div class="card card-pad stack" style="gap:12px;max-width:520px;margin:auto">
      <h1 style="font-size:1.5rem">You do not have access to this page</h1>
      <p class="muted">You are signed in as <strong>${esc(user.username)}</strong> (${esc(user.role)}). ${user.role === 'judge' ? 'This page is for admins.' : 'The staff area is for admins and judges.'}</p>
      <div class="row"><a class="btn btn-primary" href="${user.role === 'judge' ? 'dashboard.html' : 'index.html'}">Go back</a><button type="button" class="btn" id="so">Sign out</button></div></div></main>`
    document.getElementById('so').addEventListener('click', async () => { await signOut(); location.href = 'login.html' })
  }
  throw new Error('Staff page blocked: not signed in or not allowed')
}

// Admin-only links are hidden from judges, and event links open Results entry for them.
export const isAdmin = () => getUser()?.role === 'admin'
export const eventLink = (id) => (isAdmin() ? `events-admin.html?id=${id}` : `results-entry.html?id=${id}`)

// Draws the sidebar and top bar around <main id="app">.
export function renderAppShell({ active, title, th = '', badges = {} }) {
  const me = guard(active)
  document.body.classList.add('staff')
  const items = NAV.filter((n) => canOpen(me, n.key)).map((n) => `<a href="${n.href}" class="side-link${n.key === active ? ' active' : ''}"${n.key === active ? ' aria-current="page"' : ''}>
      ${icon(n.icon, 20)}<span>${n.label}</span>${badges[n.key] ? `<span class="side-badge">${esc(badges[n.key])}</span>` : ''}</a>`).join('')
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main">Skip to main content</a>
    <aside class="sidebar" aria-label="Staff menu">
      <a href="dashboard.html" class="logo logo-light" aria-label="Chai-Yo Para staff dashboard">
        <span class="logo-mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path class="draw" pathLength="1" d="M4 20a16 16 0 0 1 16-16"/><path class="draw" pathLength="1" style="animation-delay:.15s" d="M9 20a11 11 0 0 1 11-11"/><path class="draw" pathLength="1" style="animation-delay:.3s" d="M14 20a6 6 0 0 1 6-6"/></svg></span>
        <span class="logo-text"><span class="logo-name">Chai-Yo Para</span><span class="logo-th th" lang="th">ไชโย พารา</span></span></a>
      <div class="meet-chip"><span class="eyebrow eyebrow-light">Para Athletics Open</span><strong>Staff area${isMock ? ' · demo data' : ''}</strong></div>
      <nav aria-label="Staff pages" class="side-nav">${items}</nav>
      <a href="index.html" class="side-link side-public">${icon('globe', 20)}<span>Public site</span></a>
      <div class="meet-chip" style="margin-top:auto"><span class="eyebrow eyebrow-light">Signed in</span><strong>${esc(me.username)} · ${esc(me.role)}</strong></div>
      <a href="login.html" class="side-link" id="signout">${icon('signin', 20)}<span>Sign out</span></a>
    </aside>`)
  document.getElementById('signout').addEventListener('click', async (e) => { e.preventDefault(); await signOut(); location.href = 'login.html' })
  const main = document.getElementById('main')
  main.insertAdjacentHTML('beforebegin', `
    <header class="topbar">
      <div class="stack" style="gap:0"><h1 class="topbar-title">${esc(title)}</h1>${th ? `<span class="small muted th" lang="th">${esc(th)}</span>` : ''}</div>
      <div class="row"><div class="display-menu" id="display-menu"></div>
        <a href="announcements.html" class="btn btn-icon" aria-label="Announcements">${icon('bell', 20)}</a></div>
    </header>`)
  renderDisplayMenu(document.getElementById('display-menu'))
}

// Modal dialog. Returns the dialog element and a close() function.
// Focus moves into the dialog, Escape and the close button close it, and focus returns afterwards.
export function openModal({ title, body, actions = '' }) {
  const opener = document.activeElement
  const wrap = document.createElement('div')
  wrap.className = 'modal-backdrop'
  wrap.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="between" style="align-items:flex-start"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="btn btn-icon" data-close aria-label="Close">${icon('x', 20)}</button></div>
    <div class="modal-body">${body}</div>
    ${actions ? `<div class="modal-actions">${actions}</div>` : ''}</div>`
  document.body.appendChild(wrap)
  const dialog = wrap.querySelector('.modal')
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); opener?.focus?.() }
  const onKey = (e) => {
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...dialog.querySelectorAll('button, a, input, select, textarea')].filter((x) => !x.disabled)
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus() }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() }
    }
  }
  document.addEventListener('keydown', onKey)
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close() })
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close))
  ;(dialog.querySelector('input, select, textarea') || dialog.querySelector('[data-close]')).focus()
  return { el: dialog, close }
}

// Short message in the corner that also reaches screen readers.
export function toast(message, kind = 'ok') {
  let box = document.getElementById('toasts')
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box) }
  const t = document.createElement('div')
  t.className = `toast toast-${kind}`
  t.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check', 20)}<span>${esc(message)}</span>`
  box.appendChild(t)
  setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 400) }, 3200)
}

export function statCard({ label, key, value, note = '', icon: ic = '', tone = 'info', href = '', i = 0 }) {
  const tag = href ? 'a' : 'div'
  return `<${tag} ${href ? `href="${href}"` : ''} class="stat card lift anim-rise" style="--i:${i}">
    <span class="between"><span class="eyebrow">${esc(label)}</span>${ic ? `<span class="stat-icon stat-${tone}">${icon(ic, 20)}</span>` : ''}</span>
    <span class="num stat-num" data-num="${esc(key)}" data-value="${Number(value) || 0}"></span>
    ${note ? `<span class="small muted">${esc(note)}</span>` : ''}</${tag}>`
}

// Builds a CSV file in the browser and downloads it.
export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Small persistence for demo-only data (venues, announcements, users, settings).
export function store(key, fallback) {
  try { const v = localStorage.getItem(`chaiyo-${key}`); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
export function save(key, value) {
  try { localStorage.setItem(`chaiyo-${key}`, JSON.stringify(value)) } catch { /* private mode */ }
}
