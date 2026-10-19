// Demo data for VITE_USE_MOCK=true. It answers the same URLs as Django and
// returns the same kind of JSON, so pages can be built and shown before the
// backend is ready. Live events finish one by one while the page polls, so
// the medal table really moves during a demo.
import { ApiError } from './errors.js'
import { NPC } from './countries.js'

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pickOne = (list) => list[Math.floor(rand() * list.length)]

const NAMES = {
  THA: [['Niran Suksawat', 'M'], ['Pimchanok Rattanakul', 'F'], ['Arthit Kaewmanee', 'M'], ['Supaporn Jantra', 'F'], ['Anucha Phromma', 'M'], ['Wanida Srisuk', 'F']],
  MAS: [['Hafiz Rahim', 'M'], ['Nur Aisyah Zainal', 'F'], ['Faizal Osman', 'M'], ['Siti Hajar Idris', 'F'], ['Amirul Hakim', 'M'], ['Farah Liyana', 'F']],
  INA: [['Dimas Pratama', 'M'], ['Putri Lestari', 'F'], ['Bayu Santoso', 'M'], ['Dewi Anggraini', 'F'], ['Rizky Hidayat', 'M'], ['Ayu Kusuma', 'F']],
  VIE: [['Tran Minh Quan', 'M'], ['Pham Thu Trang', 'F'], ['Nguyen Duc Long', 'M'], ['Le Thi Mai', 'F'], ['Le Van Hung', 'M'], ['Vo Thanh Ha', 'F']],
  PHI: [['Jerome Dela Cruz', 'M'], ['Angelica Reyes', 'F'], ['Ramon Villanueva', 'M'], ['Maria Santos', 'F'], ['Rico Santos', 'M'], ['Joy Bautista', 'F']],
  MYA: [['Zaw Min Htet', 'M'], ['Thandar Aye', 'F'], ['Kyaw Thura', 'M'], ['Aye Chan Moe', 'F'], ['Aung Ko Latt', 'M'], ['Su Myat Noe', 'F']],
  SGP: [['Marcus Tan', 'M'], ['Rachel Lim', 'F'], ['Daniel Ong', 'M'], ['Chloe Ng', 'F'], ['Ethan Koh', 'M'], ['Grace Teo', 'F']],
  CAM: [['Sok Dara', 'M'], ['Chan Sreymom', 'F'], ['Vann Pisey', 'M'], ['Keo Sophea', 'F'], ['Heng Visal', 'M'], ['Lim Bopha', 'F']],
  // Other Paralympic nations (names are made up for the demo).
  CHN: [['Li Haoran', 'M'], ['Zhou Mei', 'F'], ['Chen Jun', 'M'], ['Wang Xiaoyu', 'F']],
  BRA: [['Rafael Souza', 'M'], ['Camila Ferreira', 'F'], ['Thiago Almeida', 'M'], ['Larissa Costa', 'F']],
  USA: [['Jordan Miller', 'M'], ['Ashley Brooks', 'F'], ['Tyler Hayes', 'M'], ['Megan Carter', 'F']],
  GBR: [['Oliver Hughes', 'M'], ['Sophie Clarke', 'F'], ['Harry Walsh', 'M'], ['Emily Turner', 'F']],
  NED: [['Daan de Vries', 'M'], ['Lotte Bakker', 'F'], ['Sem Jansen', 'M'], ['Fleur Visser', 'F']],
  ITA: [['Luca Bianchi', 'M'], ['Giulia Romano', 'F'], ['Marco Ferrara', 'M'], ['Chiara Ricci', 'F']],
  UKR: [['Andriy Kovalenko', 'M'], ['Olena Shevchuk', 'F'], ['Dmytro Bondar', 'M'], ['Iryna Melnyk', 'F']],
  AUS: [['Jack Thornton', 'M'], ['Matilda Reid', 'F'], ['Lachlan Price', 'M'], ['Isla Kennedy', 'F']],
  JPN: [['Haruto Sato', 'M'], ['Yui Tanaka', 'F'], ['Ren Watanabe', 'M'], ['Aoi Nakamura', 'F']],
  IND: [['Arjun Sharma', 'M'], ['Priya Nair', 'F'], ['Rohit Yadav', 'M'], ['Kavya Reddy', 'F']],
  ALG: [['Yacine Benali', 'M'], ['Amina Haddad', 'F'], ['Karim Mansouri', 'M'], ['Lina Boudiaf', 'F']],
  KEN: [['Brian Otieno', 'M'], ['Faith Wanjiru', 'F'], ['Kevin Kiprono', 'M'], ['Mercy Achieng', 'F']],
}
const COUNTRY_NAMES = Object.fromEntries(Object.keys(NAMES).map((c) => [c, NPC[c][0]]))

const SPORTS = [
  { id: 1, name: '100 m', sport_type: 'track', classes: ['T54', 'T47', 'T11'], lo: 11.4, hi: 15.2, better: 'low', unit: 's' },
  { id: 2, name: '400 m', sport_type: 'track', classes: ['T54', 'T20'], lo: 47.2, hi: 61.5, better: 'low', unit: 's' },
  { id: 3, name: '1500 m', sport_type: 'track', classes: ['T11', 'T54'], lo: 238, hi: 275, better: 'low', unit: 'mmss' },
  { id: 4, name: 'Long Jump', sport_type: 'field', classes: ['T20', 'T64'], lo: 4.9, hi: 7.1, better: 'high', unit: 'm' },
  { id: 5, name: 'Shot Put', sport_type: 'field', classes: ['F46', 'F41'], lo: 8.9, hi: 15.1, better: 'high', unit: 'm' },
  { id: 6, name: 'Javelin', sport_type: 'field', classes: ['F34', 'F13'], lo: 15.5, hi: 48.0, better: 'high', unit: 'm' },
  { id: 7, name: 'Marathon', sport_type: 'road', classes: ['T54'], lo: 5100, hi: 5900, better: 'low', unit: 'hms' },
]
const VENUES = { track: 'Main track', field: 'Throws and jumps area', road: 'Lakeside loop' }

const athletes = []
let aid = 1
for (const [code, list] of Object.entries(NAMES)) {
  list.forEach(([name, gender], i) => {
    const sport = SPORTS[(aid + i) % 6]
    athletes.push({ id: aid, name, country: code, country_name: COUNTRY_NAMES[code], gender, classification: sport.classes[i % sport.classes.length], sport: sport.sport_type === 'field' ? 'Field' : 'Track', bib: 100 + aid })
    aid += 1
  })
}

const DAYS = ['2026-10-14', '2026-10-15', '2026-10-16']
const PLAN = [
  // day, time, sport id, gender, class, initial status
  [0, '09:00', 1, 'M', 'T54', 'result'], [0, '09:30', 1, 'F', 'T47', 'result'], [0, '10:15', 5, 'M', 'F46', 'result'],
  [0, '17:00', 4, 'F', 'T20', 'result'], [0, '17:40', 2, 'M', 'T54', 'result'], [0, '18:20', 6, 'F', 'F34', 'result'],
  [1, '09:00', 3, 'M', 'T11', 'result'], [1, '09:45', 5, 'F', 'F41', 'result'], [1, '10:30', 2, 'F', 'T20', 'result'],
  [1, '17:00', 4, 'M', 'T64', 'live'], [1, '17:30', 1, 'F', 'T54', 'live'], [1, '18:10', 6, 'M', 'F13', 'start-list'],
  [1, '18:50', 3, 'F', 'T54', 'start-list'], [2, '06:00', 7, 'M', 'T54', 'start-list'], [2, '09:00', 2, 'M', 'T20', 'start-list'],
  [2, '09:40', 5, 'M', 'F46', 'start-list'], [2, '10:20', 4, 'F', 'T64', 'start-list'], [2, '11:00', 1, 'X', 'Mixed', 'start-list'],
]
const fmt = (sport, v) => {
  if (sport.unit === 'm') return v.toFixed(2)
  if (sport.unit === 's') return v.toFixed(2)
  if (sport.unit === 'mmss') return `${Math.floor(v / 60)}:${(v % 60).toFixed(2).padStart(5, '0')}`
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = Math.floor(v % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
const POINTS = [8, 7, 6, 5, 4, 3, 2, 1]

// Same a, b, c coefficients as the Django PointsTable (World Athletics combined-events tables),
// so the demo shows the real points formula: track a·(b − T)^c, field a·(D − b)^c.
const COEFF = {
  '100 m': { M: [25.4347, 18, 1.81, 's'], F: [17.857, 21, 1.81, 's'] },
  '400 m': { M: [1.53775, 82, 1.81, 's'], F: [1.34285, 91.7, 1.81, 's'] },
  '1500 m': { M: [0.03768, 480, 1.85, 's'], F: [0.02883, 535, 1.88, 's'] },
  'Long Jump': { M: [0.14354, 220, 1.4, 'cm'], F: [0.188807, 210, 1.41, 'cm'] },
  'Shot Put': { M: [51.39, 1.5, 1.05, 'm'], F: [56.0211, 1.5, 1.05, 'm'] },
  'Javelin': { M: [10.14, 7, 1.08, 'm'], F: [15.9803, 3.8, 1.04, 'm'] },
}
const coeffOf = (ev) => COEFF[ev._sport.name]?.[ev.gender] || null
const parseMark = (v) => { const p = String(v).trim().split(':').map(Number); return p.some(Number.isNaN) ? null : p.reduce((t, x) => t * 60 + x, 0) }
function pointsFor(ev, mark) {
  const k = coeffOf(ev)
  if (!k || mark == null) return null
  const [a, b, c, unit] = k
  const v = unit === 'cm' ? mark * 100 : mark
  const gap = unit === 's' ? b - v : v - b
  return gap > 0 ? Math.floor(a * gap ** c) : 0
}

function buildEvents() {
  seed = 7
  let rid = 1
  return PLAN.map(([day, time, sportId, gender, cls, status], i) => {
    const sport = SPORTS.find((s) => s.id === sportId)
    const pool = athletes.filter((a) => gender === 'X' || a.gender === gender)
    const chosen = []
    while (chosen.length < 8) { const a = pickOne(pool); if (!chosen.includes(a)) chosen.push(a) }
    const marks = chosen.map(() => sport.lo + rand() * (sport.hi - sport.lo))
    const order = marks.map((m, k) => k).sort((x, y) => (sport.better === 'low' ? marks[x] - marks[y] : marks[y] - marks[x]))
    const label = gender === 'X' ? 'Universal Relay 4×100 m' : `${gender === 'M' ? "Men's" : "Women's"} ${sport.name} ${cls}`
    return {
      id: i + 1,
      name: label,
      sport: { id: sport.id, name: sport.name, sport_type: sport.sport_type },
      gender, classification: cls, date: DAYS[day], start_time: `${time}:00`,
      venue: VENUES[sport.sport_type], status, judge: sport.sport_type === 'field' ? 'Arif Rahman' : 'Hannah Lindqvist',
      _sport: sport,
      _entries: chosen.map((a, k) => ({ id: rid++, athlete: a, lane: k + 1, mark: marks[k], place: order.indexOf(k) + 1 })),
      _shown: status === 'live' ? 3 : 0,
    }
  })
}

let events = buildEvents()
let tick = 0
const QUEUE = [10, 11, 12, 13] // ids that go live and then finish, in order

function advance() {
  tick += 1
  // Every 3 polls something happens: a live event shows more results or finishes.
  if (tick % 3 !== 0) return
  for (const id of QUEUE) {
    const ev = events.find((e) => e.id === id)
    if (ev.status === 'live') {
      ev._shown += 3
      if (ev._shown >= 8) ev.status = 'result'
      return
    }
    if (ev.status === 'start-list') { ev.status = 'live'; ev._shown = 2; return }
  }
  if (tick > 45) { events = buildEvents(); tick = 0 }
}

function resultsOf(ev) {
  const visible = ev.status === 'result' ? ev._entries : ev.status === 'live' ? ev._entries.slice(0, ev._shown) : []
  const ranked = [...visible].filter((e) => e.mark != null).sort((a, b) => a.place - b.place)
  return ev._entries.map((en) => {
    const shown = visible.includes(en) && en.mark != null
    const rank = shown ? ranked.indexOf(en) + 1 : null
    const final = ev.status === 'result'
    const auto = {
      score: shown ? fmt(ev._sport, en.mark) : '',
      point: coeffOf(ev) ? (shown ? pointsFor(ev, en.mark) : null) : final && rank && rank <= 8 ? POINTS[rank - 1] : null,
      rank,
      medal: final && rank === 1 ? 'gold' : final && rank === 2 ? 'silver' : final && rank === 3 ? 'bronze' : null,
    }
    // Values typed by a judge or admin (PATCH /api/results/<id>/) win over the simulation.
    return { id: en.id, athlete: { id: en.athlete.id, name: en.athlete.name, country: en.athlete.country }, lane: en.lane, ...auto, ...(en.manual || {}) }
  })
}

const publicEvent = (ev) => {
  const { _sport, _entries, _shown, ...rest } = ev
  return { ...rest, points_auto: Boolean(coeffOf(ev)), participants: _entries.map((en) => ({ id: en.id, athlete: { id: en.athlete.id, name: en.athlete.name, country: en.athlete.country }, lane: en.lane })) }
}

function medals() {
  const table = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([c, n]) => [c, { country: c, country_name: n, gold: 0, silver: 0, bronze: 0 }]))
  for (const ev of events) for (const r of resultsOf(ev)) if (r.medal) table[r.athlete.country][r.medal] += 1
  return Object.values(table)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const findEvent = (id) => { const ev = events.find((e) => e.id === Number(id)); if (!ev) throw new ApiError('Not found.', 404); return ev }
const stopSimulation = (ev) => { const i = QUEUE.indexOf(ev.id); if (i >= 0) QUEUE.splice(i, 1) }
let nextEventId = 100, nextEntryId = 1000

// POST, PUT, PATCH and DELETE for the admin and judge pages (demo mode only).
export async function mockSend(method, path, body = {}) {
  await wait(250)
  let m
  if (path === '/api/events/' && method === 'POST') {
    const sport = SPORTS.find((s) => s.id === Number(body.sport)) || SPORTS[0]
    const ev = { id: nextEventId++, name: body.name, sport: { id: sport.id, name: sport.name, sport_type: sport.sport_type }, gender: body.gender, classification: body.classification || '',
      date: body.date, start_time: body.start_time, venue: body.venue || VENUES[sport.sport_type], status: 'start-list', judge: body.judge || '', _sport: sport, _entries: [], _shown: 0 }
    events.push(ev)
    return publicEvent(ev)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/$/))) {
    const ev = findEvent(m[1])
    if (method === 'DELETE') { events = events.filter((e) => e !== ev); return {} }
    const sport = SPORTS.find((s) => s.id === Number(body.sport)) || ev._sport
    Object.assign(ev, { name: body.name ?? ev.name, gender: body.gender ?? ev.gender, classification: body.classification ?? ev.classification, date: body.date ?? ev.date,
      start_time: body.start_time ?? ev.start_time, venue: body.venue ?? ev.venue, judge: body.judge ?? ev.judge, _sport: sport, sport: { id: sport.id, name: sport.name, sport_type: sport.sport_type } })
    return publicEvent(ev)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/participants\/$/)) && method === 'POST') {
    const ev = findEvent(m[1]); stopSimulation(ev)
    const a = athletes.find((x) => x.id === Number(body.athlete_id))
    if (!a) throw new ApiError('Athlete not found.', 400)
    if (ev._entries.some((en) => en.athlete.id === a.id)) throw new ApiError('This athlete is already in the event.', 400)
    ev._entries.push({ id: nextEntryId++, athlete: a, lane: ev._entries.length + 1, mark: null, place: 99 })
    return resultsOf(ev).at(-1)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/participants\/(\d+)\/$/)) && method === 'DELETE') {
    const ev = findEvent(m[1]); stopSimulation(ev)
    ev._entries = ev._entries.filter((en) => en.athlete.id !== Number(m[2]))
    return {}
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/status\/$/))) {
    const ev = findEvent(m[1]); stopSimulation(ev)
    ev.status = body.status
    if (body.status === 'live') ev._shown = 0
    return publicEvent(ev)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/rank\/$/))) {
    // Points from the formula, then ranks by points (highest first). Ties share a rank.
    const ev = findEvent(m[1]); stopSimulation(ev)
    const rows = resultsOf(ev).filter((r) => r.score !== '' && r.score != null)
    for (const r of rows) r.point = coeffOf(ev) ? pointsFor(ev, parseMark(r.score)) : r.point
    const better = (x, y) => (coeffOf(ev) ? y.point - x.point : (ev._sport.better === 'low' ? parseMark(x.score) - parseMark(y.score) : parseMark(y.score) - parseMark(x.score)))
    rows.sort(better)
    rows.forEach((r, i) => { r.rank = i > 0 && better(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1 })
    for (const r of rows) { const en = ev._entries.find((x) => x.id === r.id); en.manual = { ...(en.manual || {}), score: r.score, rank: r.rank, point: r.point } }
    return resultsOf(ev)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/auto-medals\/$/))) {
    const ev = findEvent(m[1]); stopSimulation(ev)
    const rows = resultsOf(ev)
    for (const en of ev._entries) {
      const r = rows.find((x) => x.id === en.id)
      const medal = r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : null
      en.manual = { ...(en.manual || {}), medal, point: coeffOf(ev) ? r.point : r.rank && r.rank <= 8 ? POINTS[r.rank - 1] : null }
    }
    return resultsOf(ev)
  }
  if ((m = path.match(/^\/api\/results\/(\d+)\/$/))) {
    for (const ev of events) {
      const en = ev._entries.find((x) => x.id === Number(m[1]))
      if (!en) continue
      stopSimulation(ev)
      // Freeze the simulated values first so later status changes don't override what was typed.
      const now = resultsOf(ev).find((x) => x.id === en.id)
      en.manual = { score: now.score, rank: now.rank, point: now.point, medal: now.medal, ...(en.manual || {}), ...body }
      if (coeffOf(ev) && 'score' in body) en.manual.point = body.score === '' || body.score == null ? null : pointsFor(ev, parseMark(body.score))
      return resultsOf(ev).find((x) => x.id === en.id)
    }
    throw new ApiError('Not found.', 404)
  }
  throw new ApiError('Not found.', 404)
}

export async function mockGet(path, params = {}) {
  await wait(220 + rand() * 200)
  let m
  if (path === '/api/medals/') { advance(); return medals() }
  if (path === '/api/events/') {
    return events
      .filter((e) => !params.gender || e.gender === params.gender)
      .filter((e) => !params.date || e.date === params.date)
      .filter((e) => !params.sport_type || e._sport.sport_type === params.sport_type)
      .map(publicEvent)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/results\/$/))) {
    const ev = events.find((e) => e.id === Number(m[1]))
    if (!ev) throw new ApiError('Not found.', 404)
    return resultsOf(ev)
  }
  if ((m = path.match(/^\/api\/events\/(\d+)\/$/))) {
    const ev = events.find((e) => e.id === Number(m[1]))
    if (!ev) throw new ApiError('Not found.', 404)
    return publicEvent(ev)
  }
  if (path === '/api/athletes/') {
    const q = (params.search || '').toLowerCase()
    return athletes.filter((a) => !q || a.name.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.country_name.toLowerCase().includes(q))
  }
  if ((m = path.match(/^\/api\/athletes\/(\d+)\/$/))) {
    const a = athletes.find((x) => x.id === Number(m[1]))
    if (!a) throw new ApiError('Not found.', 404)
    const evs = events.filter((e) => e._entries.some((en) => en.athlete.id === a.id)).map((ev) => {
      const r = resultsOf(ev).find((x) => x.athlete.id === a.id)
      return { event: { id: ev.id, name: ev.name, date: ev.date, status: ev.status }, score: r.score, rank: r.rank, medal: r.medal, point: r.point }
    })
    return { ...a, events: evs }
  }
  if (path === '/api/sports/') return SPORTS.map(({ id, name, sport_type }) => ({ id, name, sport_type }))
  if (path === '/api/auth/me/') throw new ApiError('Please sign in to see this.', 401)
  throw new ApiError('Not found.', 404)
}
