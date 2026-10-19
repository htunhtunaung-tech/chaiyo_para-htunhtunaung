// Shared building blocks for every page: navbar, footer, display menu,
// small HTML helpers, polling and the animation helpers.
import { isMock } from './api.js'
import { getUser, signOut } from './auth.js'
import { countryCode, countryColor, countryName, countryFlag } from './countries.js'
import { secondsAgo } from './format.js'

/* ---------- HTML helpers ---------- */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const PATHS = {
  medal: 'M8 3l4 7 4-7M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a7 7 0 0 1 4 7',
  signin: 'M10 4h8v16h-8M4 12h10M10 8l4 4-4 4', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  chevR: 'M9 6l6 6-6 6', chevL: 'M15 6l-6 6 6 6', check: 'M5 12.5l4.5 4.5L19 7.5', alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6', pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5', info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  dash: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z', timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l3 2M9 2h6',
  mega: 'M4 10v4h3l7 4V6l-7 4zM17 9a4 4 0 0 1 0 6', bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', down: 'M12 4v11M7 11l5 5 5-5M5 20h14', send: 'M4 12l16-8-6 16-3-7z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9', save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', swap: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
}
export function icon(name, size = 20, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="${PATHS[name]}"/></svg>`
}

// Flag picture for a delegation. Decorative: the code and name next to it carry the meaning.
export function flagImg(code, size = 'md') {
  return `<img class="flag flag-${size}" src="${countryFlag(code)}" alt="" loading="lazy" width="${size === 'sm' ? 20 : size === 'lg' ? 48 : 26}" height="${size === 'sm' ? 15 : size === 'lg' ? 36 : 20}">`
}
export function countryChip(code, withName = false) {
  const c = countryCode(code)
  // Without the name the chip must never shrink, or the code badge slides under the athlete's name.
  return `<span class="row" style="gap:8px;min-width:0${withName ? '' : ';flex:none'}">${flagImg(c)}<span class="country" style="flex:none;background:${countryColor(c)}" title="${esc(countryName(c))}">${esc(c)}</span>${withName ? `<span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(countryName(c))}</span>` : ''}</span>`
}

const MEDAL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }
export function medalChip(medal, rank, cls = '') {
  if (!medal && (rank === null || rank === undefined || rank === '')) return `<span class="medal medal-none ${cls}" aria-label="No rank yet">–</span>`
  const text = rank ?? MEDAL[medal]?.[0]
  const label = medal ? `${MEDAL[medal]} medal${rank ? `, place ${rank}` : ''}` : `Place ${rank}`
  return `<span class="medal medal-${medal || 'none'} ${cls}" aria-label="${label}">${esc(text)}</span>`
}

const STATUS = { 'start-list': ['badge-neutral', 'Start list', 'clock'], live: ['badge-live pulse', 'LIVE', null], result: ['badge-ok', 'Results', 'check'] }
export function statusBadge(status) {
  const [cls, label, ic] = STATUS[status] || ['badge-neutral', status || 'Scheduled', 'clock']
  return `<span class="badge ${cls}">${ic ? icon(ic, 12) : '<span class="dot" style="background:var(--on-accent)"></span>'}${esc(label)}</span>`
}

export const TYPE_COLOR = { track: 'var(--track)', field: 'var(--field)', road: 'var(--road)' }
export const typeDot = (type) => `<span class="dot" style="background:${TYPE_COLOR[type] || 'var(--border-strong)'}" aria-hidden="true"></span>`

export function pageHeader({ title, th, eyebrow, right = '', photo = '', pos = 'center' }) {
  // photo: a decorative picture behind the header (images/…). Text stays white on a dark overlay.
  return `<header class="page-header anim-rise${photo ? ' photo-banner' : ''}"${photo ? ` style="--pos:${pos}"` : ''}>${photo ? `<div class="photo-layer" aria-hidden="true" style="background-image:url('${photo}')"></div>` : ''}
    <div class="stack" style="gap:6px">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(title)}</h1>${th ? `<p class="muted th" lang="th">${esc(th)}</p>` : ''}</div>
    <div class="row" style="flex-wrap:wrap">${right}</div></header>`
}

export function stateMessage({ kind = 'empty', title, text = '', action = '' }) {
  const ic = kind === 'error' ? 'alert' : kind === 'search' ? 'search' : 'medal'
  return `<div class="state state-${kind} anim-fade" role="${kind === 'error' ? 'alert' : 'status'}">
    <span class="state-icon">${icon(ic, 28)}</span><h2 style="font-size:1.125rem">${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}${action}</div>`
}

export function skeletonRows(n = 6) {
  return `<div aria-busy="true" aria-label="Loading">${Array.from({ length: n }, (_, i) =>
    `<div class="table-row"><span class="skeleton" style="height:18px;width:${60 + ((i * 17) % 35)}%"></span></div>`).join('')}</div>`
}

export function burst(count = 14) {
  const colors = ['var(--gold)', 'var(--silver)', 'var(--bronze)', 'var(--accent)', 'var(--primary)']
  return `<span class="burst" aria-hidden="true">${Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2, d = 36 + (i % 3) * 14
    return `<span style="background:${colors[i % colors.length]};--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;--rot:${i % 2 ? 220 : -220}deg;animation-delay:${(i % 4) * 20}ms"></span>`
  }).join('')}</span>`
}

/* ---------- Motion helpers ---------- */
export function reducedMotion() {
  const m = document.documentElement.dataset.motion
  if (m === 'reduce') return true
  if (m === 'full') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// Numbers: <span data-num="key" data-value="12"></span>. Counts from the last
// value shown for that key, and "bumps" when it goes up.
const shownNumbers = new Map()
export function animateNumbers(root = document) {
  root.querySelectorAll('[data-num]').forEach((el) => {
    const key = el.dataset.num, to = Number(el.dataset.value) || 0
    const from = shownNumbers.has(key) ? shownNumbers.get(key) : 0
    shownNumbers.set(key, to)
    el.innerHTML = `<span aria-hidden="true">${from}</span><span class="visually-hidden">${to}</span>`
    const out = el.firstChild
    if (reducedMotion() || from === to) { out.textContent = to; return }
    if (from < to && from !== 0) { el.classList.add('num-bump'); setTimeout(() => el.classList.remove('num-bump'), 650) }
    const start = performance.now(), dur = 700
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur)
      out.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

// FLIP: call before re-rendering a list, then call the returned function after.
// Rows with the same data-key slide from their old place to the new one.
export function flip(container) {
  const before = new Map()
  container?.querySelectorAll('[data-key]').forEach((el) => before.set(el.dataset.key, el.offsetTop))
  return () => {
    if (!container || reducedMotion()) return
    container.querySelectorAll('[data-key]').forEach((el) => {
      const old = before.get(el.dataset.key)
      if (old === undefined) return
      const dy = old - el.offsetTop
      if (Math.abs(dy) > 1 && el.animate) {
        el.animate([{ transform: `translateY(${dy}px)`, zIndex: 2 }, { transform: 'translateY(0)', zIndex: 2 }], { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)' })
      }
    })
  }
}

/* ---------- Polling ---------- */
// Calls load() now and every `interval` ms; pauses while the tab is hidden.
export function poll(load, interval, { onData, onError, onTick } = {}) {
  let timer = null, stopped = false, run = 0
  const state = { nextAt: null, lastUpdated: null, error: null }
  async function tick() {
    const id = ++run
    try {
      const data = await load()
      if (stopped || id !== run) return
      state.lastUpdated = new Date(); state.error = null
      onData?.(data)
    } catch (err) {
      if (stopped || id !== run) return
      state.error = err
      onError?.(err)
    } finally {
      if (!stopped && id === run && interval) state.nextAt = Date.now() + interval
      onTick?.(state)
    }
  }
  function start() { clearInterval(timer); tick(); if (interval) timer = setInterval(() => { if (!document.hidden) tick() }, interval) }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !stopped && interval) start() })
  start()
  return { refresh: start, stop() { stopped = true; clearInterval(timer) }, state }
}

// The ring that empties until the next refresh, with "Updated 3 s ago".
export function refreshRing(id) {
  return `<div class="refresh" id="${id}">
    <button type="button" class="btn btn-ghost refresh-btn" aria-label="Refresh now">
      <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true" class="refresh-ring">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="4"/>
        <circle class="ring-fg" cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg></button>
    <span class="small muted" aria-live="polite">Loading…</span></div>`
}
export function wireRefreshRing(id, poller, interval) {
  const box = document.getElementById(id)
  if (!box) return () => {}
  box.querySelector('button').addEventListener('click', () => poller.refresh())
  const label = box.querySelector('span')
  const ring = box.querySelector('.ring-fg')
  const text = () => {
    const s = poller.state
    label.textContent = s.error ? 'Connection lost. Retrying…' : s.lastUpdated ? `Updated ${secondsAgo(s.lastUpdated)} · every ${Math.round(interval / 1000)} s` : 'Loading…'
  }
  const timer = setInterval(() => { if (!document.body.contains(box)) clearInterval(timer); else text() }, 1000)
  return () => {
    text()
    ring.setAttribute('stroke', poller.state.error ? 'var(--danger)' : 'var(--primary)')
    ring.style.animation = 'none'; void ring.getBoundingClientRect()
    ring.style.animation = interval ? `ring ${interval}ms linear both` : 'none'
  }
}

export function debounce(fn, ms = 300) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

/* ---------- Page shell: navbar, mobile tab bar, footer, display menu ---------- */
const NAV = [
  { href: 'index.html', key: 'home', label: 'Medal table', short: 'Medals', icon: 'medal' },
  { href: 'competition.html', key: 'competition', label: 'Competition', short: 'Schedule', icon: 'cal' },
  { href: 'athletes.html', key: 'athletes', label: 'Athletes', short: 'Athletes', icon: 'users' },
]
const LOGO = (light = false) => `<a href="index.html" class="logo${light ? ' logo-light' : ''}" aria-label="Chai-Yo Para, home">
  <span class="logo-mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
    <path class="draw" pathLength="1" d="M4 20a16 16 0 0 1 16-16"/><path class="draw" pathLength="1" style="animation-delay:.15s" d="M9 20a11 11 0 0 1 11-11"/><path class="draw" pathLength="1" style="animation-delay:.3s" d="M14 20a6 6 0 0 1 6-6"/></svg></span>
  <span class="logo-text"><span class="logo-name">Chai-Yo Para</span><span class="logo-th th" lang="th">ไชโย พารา</span></span></a>`

export function renderShell(active) {
  const link = (n) => `<a href="${n.href}" class="nav-link${n.key === active ? ' active' : ''}"${n.key === active ? ' aria-current="page"' : ''}>${n.label}</a>`
  const tab = (n) => `<a href="${n.href}" class="tab${n.key === active ? ' active' : ''}"${n.key === active ? ' aria-current="page"' : ''}>${icon(n.icon, 24)}<span>${n.short}</span></a>`
  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="navbar"><div class="container navbar-inner">
      ${LOGO()}
      <nav aria-label="Main" class="nav-links">${NAV.map(link).join('')}</nav>
      <div class="row">
        <div class="display-menu" id="display-menu"></div>
        <a href="login.html" class="btn btn-primary hide-sm" id="account-btn">${icon('signin', 18)}Sign in</a>
      </div>
    </div></header>
    <nav aria-label="Main, mobile" class="tabbar">${NAV.map(tab).join('')}${tab({ href: 'login.html', key: 'login', short: 'Sign in', icon: 'signin' })}</nav>`)
  document.body.insertAdjacentHTML('beforeend', `<footer class="footer"><div class="container between">${LOGO(true)}
    <p class="small" style="color:var(--hero-text)">Para Athletics Open · Lakeside Stadium${isMock ? ' · Demo data' : ''} · <a href="dashboard.html" style="color:#FFFFFF">Staff area</a></p></div></footer>`)
  renderDisplayMenu(document.getElementById('display-menu'))
  // Signed in? login.html saved the user; show the name, role and a Sign out button.
  const me = getUser()
  if (me) {
    const btn = document.getElementById('account-btn')
    const staff = me.role === 'admin' || me.role === 'judge'
    btn.href = staff ? 'dashboard.html' : 'index.html'
    btn.innerHTML = `${icon('gear', 18)}${esc(me.username || 'My account')}${me.role ? ` <span class="badge" style="background:rgba(255,255,255,.2);color:inherit">${esc(me.role)}</span>` : ''}`
    btn.insertAdjacentHTML('afterend', `<button type="button" class="btn hide-sm" id="signout-btn">Sign out</button>`)
    document.getElementById('signout-btn').addEventListener('click', async () => { await signOut(); location.href = 'index.html' })
    // phone tab bar: the last tab becomes "Account"
    const last = document.querySelector('.tabbar a[href="login.html"]')
    if (last) { last.href = staff ? 'dashboard.html' : 'index.html'; last.querySelector('span').textContent = 'Account' }
  }
}

/* ---------- Display menu: text size, contrast, dark mode, motion ---------- */
const DKEY = 'chaiyo-display'
function loadSettings() {
  try { return { text: 'standard', theme: 'system', contrast: false, motion: 'system', ...JSON.parse(localStorage.getItem(DKEY) || '{}') } } catch { return { text: 'standard', theme: 'system', contrast: false, motion: 'system' } }
}
function applySettings(s) {
  const html = document.documentElement
  html.dataset.text = s.text
  if (s.theme === 'system') delete html.dataset.theme; else html.dataset.theme = s.theme
  if (s.contrast) html.dataset.contrast = 'high'; else delete html.dataset.contrast
  if (s.motion === 'system') delete html.dataset.motion; else html.dataset.motion = s.motion
  try { localStorage.setItem(DKEY, JSON.stringify(s)) } catch { /* private mode */ }
}
export function renderDisplayMenu(box) {
  let s = loadSettings()
  const isDark = () => s.theme === 'dark' || (s.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const sw = (key, label, th, on) => `<button type="button" role="switch" aria-checked="${on}" class="switch-row" data-switch="${key}">
      <span class="stack" style="gap:0;text-align:left"><span style="font-weight:700">${label}</span><span class="small muted th" lang="th">${th}</span></span>
      <span class="row"><span class="small muted" style="font-weight:700">${on ? 'On' : 'Off'}</span><span class="switch${on ? ' on' : ''}"><span></span></span></span></button>`
  const panel = () => `<div id="display-panel" role="group" aria-label="Display options" class="display-panel card">
      <div class="stack" style="gap:8px"><div class="between"><span class="label">Text size</span><span class="small muted th" lang="th">ขนาดตัวอักษร</span></div>
        <div class="seg-3">${[['standard', 'Standard text', '1rem'], ['large', 'Large text', '1.25rem'], ['largest', 'Largest text', '1.5rem']].map(([k, l, fs]) =>
          `<button type="button" class="size-btn" data-size="${k}" aria-pressed="${s.text === k}" aria-label="${l}" style="font-size:${fs}">A</button>`).join('')}</div></div>
      ${sw('contrast', 'High contrast', 'ความคมชัดสูง', s.contrast)}${sw('dark', 'Dark mode', 'โหมดมืด', isDark())}${sw('motion', 'Reduce motion', 'ลดการเคลื่อนไหว', s.motion === 'reduce')}</div>`
  box.innerHTML = `<button type="button" class="btn" id="display-btn" aria-expanded="false" aria-controls="display-panel">
      <span class="num" style="font-stretch:100%" aria-hidden="true">A<span style="font-size:1.2em">a</span></span><span class="hide-sm">Display</span><span class="visually-hidden">options</span></button>
    <div id="display-slot"></div>`
  const btn = box.querySelector('#display-btn'), slot = box.querySelector('#display-slot')
  let open = false
  const draw = () => { slot.innerHTML = open ? panel() : ''; btn.setAttribute('aria-expanded', open) }
  btn.addEventListener('click', () => { open = !open; draw() })
  slot.addEventListener('click', (e) => {
    const size = e.target.closest('[data-size]'), toggle = e.target.closest('[data-switch]')
    if (size) s = { ...s, text: size.dataset.size }
    if (toggle) {
      const k = toggle.dataset.switch
      if (k === 'contrast') s = { ...s, contrast: !s.contrast }
      if (k === 'dark') s = { ...s, theme: isDark() ? 'light' : 'dark' }
      if (k === 'motion') s = { ...s, motion: s.motion === 'reduce' ? 'system' : 'reduce' }
    }
    if (size || toggle) {
      applySettings(s); draw()
      slot.querySelector(size ? `[data-size="${s.text}"]` : `[data-switch="${toggle.dataset.switch}"]`)?.focus()
    }
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { open = false; draw(); btn.focus() } })
  document.addEventListener('mousedown', (e) => { if (open && !box.contains(e.target)) { open = false; draw() } })
}
