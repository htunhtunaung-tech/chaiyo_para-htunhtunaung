// Announcements (demo data: there is no announcements API yet).
// Write in English and Thai, choose who gets it and how urgent it is, send.
import { getAnnouncements, saveAnnouncements } from '../demo-data.js'
import { renderAppShell, toast } from '../manage-ui.js'
import { esc, icon } from '../ui.js'

renderAppShell({ active: 'announcements', title: 'Announcements', th: 'ประกาศและการแจ้งเตือน' })
const app = document.getElementById('app')
const AUD = [['Everyone', 288], ['Team managers', 52], ['Athletes', 186], ['Judges', 46]]
const PRI = { normal: ['Normal', 'info', 'tone-info'], important: ['Important', 'alert', 'tone-warn'], urgent: ['Urgent', 'bell', 'tone-danger'] }
let list = getAnnouncements(), lang = 'en', aud = 'Everyone', pri = 'normal', topic = '', draft = { en: { title: '', body: '' }, th: { title: '', body: '' } }

app.innerHTML = `<div class="cols">
  <div class="stack">
    <form class="card card-pad stack anim-rise" id="compose" style="gap:16px" aria-labelledby="c-h" novalidate>
      <div class="between"><h2 id="c-h">New announcement</h2>
        <div class="seg" role="tablist" aria-label="Language of this text"><button type="button" role="tab" data-lang="en" aria-selected="true" aria-pressed="true">English</button><button type="button" role="tab" data-lang="th" aria-selected="false" aria-pressed="false" lang="th">ไทย</button></div></div>
      <label class="field"><span class="label" id="t-label">Title</span><input class="input" id="title" maxlength="90" placeholder="Gate B lift is back in service"></label>
      <label class="field"><span class="label" id="b-label">Message</span><textarea class="input" id="body" maxlength="280" placeholder="Short and plain. It is read aloud by screen readers and shown on stadium screens."></textarea>
        <span class="between small muted"><span>Plain language reads best on stadium screens and screen readers.</span><span id="chars">0 of 280</span></span></label>
      <fieldset style="border:0;margin:0;padding:0" class="stack"><legend class="label" style="margin-bottom:8px">Send to</legend>
        <div class="chips">${AUD.map(([a, n]) => `<button type="button" class="chip" data-aud="${a}" aria-pressed="${a === aud}">${a} <span class="muted small">${n}</span></button>`).join('')}</div></fieldset>
      <fieldset style="border:0;margin:0;padding:0" class="stack"><legend class="label" style="margin-bottom:8px">Priority</legend>
        <div class="row" role="radiogroup" aria-label="Priority" style="flex-wrap:wrap">${Object.entries(PRI).map(([k, [l, ic]]) => `<button type="button" role="radio" class="chip" data-pri="${k}" aria-checked="${k === pri}" aria-pressed="${k === pri}">${icon(ic, 16)}${l}</button>`).join('')}</div></fieldset>
      <fieldset style="border:0;margin:0;padding:0"><legend class="label" style="margin-bottom:8px">Deliver by</legend>
        <div class="row" style="flex-wrap:wrap;gap:8px 24px">${['In the app', 'Push notification', 'Stadium screens', 'Email'].map((c, i) => `<label class="row" style="min-height:44px"><input type="checkbox" name="ch" value="${c}" ${i < 2 ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">${c}</label>`).join('')}</div></fieldset>
      <p class="small" id="err" role="alert" style="color:var(--danger);font-weight:600"></p>
      <div class="between" style="border-top:1px solid var(--border);padding-top:16px"><span class="small muted" id="send-note"></span><button type="submit" class="btn btn-primary">${icon('send', 18)}<span id="send-label"></span></button></div>
    </form>
    <section class="card anim-rise" style="--i:1" aria-labelledby="f-h">
      <div class="card-head"><h2 id="f-h">Sent</h2><div class="chips" id="topics"></div></div>
      <div id="feed"></div>
    </section>
  </div>
  <aside class="stack" style="position:sticky;top:96px">
    <section class="card card-pad stack anim-rise" style="gap:12px;--i:2" aria-labelledby="p-h"><h2 id="p-h">Preview</h2><div id="preview"></div></section>
    <section class="card card-pad stack anim-rise" style="gap:12px;--i:3" aria-labelledby="s-h"><h2 id="s-h">Delivery</h2><div id="delivery"></div></section>
  </aside>
</div>`

const $ = (id) => document.getElementById(id)
function syncForm() {
  $('title').value = draft[lang].title; $('body').value = draft[lang].body
  $('title').lang = lang; $('body').lang = lang
  $('t-label').textContent = lang === 'en' ? 'Title' : 'Title in Thai (optional)'
  $('b-label').textContent = lang === 'en' ? 'Message' : 'Message in Thai (optional)'
  app.querySelectorAll('[data-lang]').forEach((b) => { b.setAttribute('aria-selected', b.dataset.lang === lang); b.setAttribute('aria-pressed', b.dataset.lang === lang) })
  drawSide()
}
function drawSide() {
  $('chars').textContent = `${$('body').value.length} of 280`
  const people = AUD.find(([a]) => a === aud)[1]
  $('send-label').textContent = `Send to ${people} people`
  $('send-note').textContent = draft.th.title ? 'English and Thai versions are ready.' : 'Only English so far. Add Thai with the ไทย tab.'
  const [l, ic, cls] = PRI[pri]
  $('preview').innerHTML = `<div class="row" style="align-items:flex-start"><span class="icon-tile ${cls}">${icon(ic, 22)}</span><span class="stack" style="gap:4px;min-width:0">
    <span class="row"><span class="badge ${pri === 'urgent' ? 'badge-danger' : pri === 'important' ? 'badge-warn' : 'badge-info'}">${l}</span><span class="small muted">Now · to ${esc(aud.toLowerCase())}</span></span>
    <strong>${esc(draft.en.title || 'Your title appears here')}</strong>${draft.th.title ? `<span class="th small" lang="th">${esc(draft.th.title)}</span>` : ''}<span class="small muted">${esc(draft.en.body || 'Your message appears here.')}</span></span></div>`
  const sent = list.length, avg = Math.round(list.reduce((s, a) => s + a.read, 0) / Math.max(1, list.length))
  $('delivery').innerHTML = `<div class="row" style="gap:12px"><div class="stat" style="flex:1;padding:12px;border-radius:12px;background:var(--surface-2)"><span class="small muted">Sent</span><span class="num stat-num" style="font-size:2rem">${sent}</span></div>
    <div class="stat" style="flex:1;padding:12px;border-radius:12px;background:var(--surface-2)"><span class="small muted">Read on average</span><span class="num stat-num" style="font-size:2rem">${avg}%</span></div></div>
    <p class="small muted">Urgent messages also go to the stadium screens and are read by the announcer in English and Thai.</p>`
}
function drawFeed(fresh = 0) {
  const topics = [...new Set(list.map((a) => a.topic))]
  $('topics').innerHTML = ['', ...topics].map((t) => `<button type="button" class="chip" data-topic="${t}" aria-pressed="${t === topic}" style="min-height:36px;padding:0 12px;font-size:.875rem">${t || 'All'} <span class="muted">${list.filter((a) => !t || a.topic === t).length}</span></button>`).join('')
  const shown = list.filter((a) => !topic || a.topic === topic)
  $('feed').innerHTML = shown.map((a, i) => {
    const [l, ic, cls] = PRI[a.priority]
    const when = new Date(a.time)
    return `<article class="list-row${i < fresh ? ' anim-rise row-flash' : ''}" style="grid-template-columns:44px minmax(0,1fr) 110px;align-items:start">
      <span class="icon-tile ${cls}">${icon(ic, 22)}</span>
      <span class="stack" style="gap:4px;min-width:0"><span class="row" style="flex-wrap:wrap"><span class="badge ${a.priority === 'urgent' ? 'badge-danger' : a.priority === 'important' ? 'badge-warn' : 'badge-info'}">${l}</span><span class="small muted">${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${when.toTimeString().slice(0, 5)} · to ${esc(a.to.toLowerCase())}</span></span>
        <strong>${esc(a.title)}</strong>${a.th ? `<span class="th small" lang="th">${esc(a.th)}</span>` : ''}<span class="small muted">${esc(a.body)}</span></span>
      <span class="stack" style="gap:4px"><span class="between small"><span class="muted">Read</span><strong>${a.read}%</strong></span><span class="progress"><span style="width:${a.read}%"></span></span></span></article>`
  }).join('') || '<p class="card-pad muted">Nothing sent yet.</p>'
}

app.addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.lang) { lang = b.dataset.lang; syncForm() }
  if (b.dataset.aud) { aud = b.dataset.aud; app.querySelectorAll('[data-aud]').forEach((x) => x.setAttribute('aria-pressed', x === b)); drawSide() }
  if (b.dataset.pri) {
    pri = b.dataset.pri; app.querySelectorAll('[data-pri]').forEach((x) => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b) })
    if (pri === 'urgent') app.querySelector('input[value="Stadium screens"]').checked = true
    drawSide()
  }
  if (b.dataset.topic !== undefined) { topic = b.dataset.topic; drawFeed() }
})
$('title').addEventListener('input', (e) => { draft[lang].title = e.target.value; drawSide() })
$('body').addEventListener('input', (e) => { draft[lang].body = e.target.value; drawSide() })
$('compose').addEventListener('submit', (e) => {
  e.preventDefault()
  if (!draft.en.title.trim() || !draft.en.body.trim()) { $('err').textContent = 'Add an English title and message before sending.'; lang = 'en'; syncForm(); $(draft.en.title.trim() ? 'body' : 'title').focus(); return }
  $('err').textContent = ''
  const item = { id: Date.now(), priority: pri, topic: pri === 'urgent' ? 'Access' : 'Information', time: new Date().toISOString().slice(0, 16), to: aud, title: draft.en.title.trim(), th: draft.th.title.trim(), body: draft.en.body.trim(), read: 0 }
  list = [item, ...list]; saveAnnouncements(list)
  draft = { en: { title: '', body: '' }, th: { title: '', body: '' } }; lang = 'en'
  syncForm(); topic = ''; drawFeed(1)
  toast(`Sent to ${AUD.find(([a]) => a === aud)[1]} people.`)
})
syncForm(); drawFeed()
