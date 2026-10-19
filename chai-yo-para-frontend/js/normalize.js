// The backend's exact JSON field names may differ a little from what the
// frontend expects. Every API response passes through these functions, so if
// Django uses another name (say "athlete_name" instead of "name"), fix it here
// once and every page keeps working.
import { countryCode, countryName } from './countries.js'
import { GENDER_FROM_API } from './config.js'

// Backend sends Men / Women / Mixed; the pages use M / F / X.
const genderCode = (g) => GENDER_FROM_API[String(g ?? '').toLowerCase()] || g || ''

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  return undefined
}
const asList = (data) => (Array.isArray(data) ? data : data?.results || data?.data || [])

export function normalizeMedalRow(r) {
  const country = pick(r, 'country_code', 'code', 'country', 'country_name', 'name')
  const gold = Number(pick(r, 'gold', 'golds', 'gold_count') ?? 0)
  const silver = Number(pick(r, 'silver', 'silvers', 'silver_count') ?? 0)
  const bronze = Number(pick(r, 'bronze', 'bronzes', 'bronze_count') ?? 0)
  return {
    code: countryCode(country),
    name: pick(r, 'country_name', 'name') || countryName(country),
    gold, silver, bronze,
    total: Number(pick(r, 'total') ?? gold + silver + bronze),
  }
}
export function normalizeMedals(data) {
  return asList(data).map(normalizeMedalRow).sort((a, b) =>
    b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name))
}

function normalizeSport(s) {
  if (!s) return { name: '', type: '' }
  if (typeof s !== 'object') return { name: String(s), type: '' }
  return { id: s.id, name: pick(s, 'name', 'title') || '', type: String(pick(s, 'sport_type', 'type', 'category') || '').toLowerCase() }
}

export function normalizeEvent(e) {
  const sport = normalizeSport(e.sport)
  const start = pick(e, 'start_time', 'time', 'start', 'date_time', 'datetime', 'start_datetime')
  let date = pick(e, 'date', 'event_date')
  if (!date && start && String(start).length > 10) date = String(start).slice(0, 10)
  return {
    id: e.id,
    name: pick(e, 'name', 'title', 'event_name') || 'Event',
    sport: sport.name || pick(e, 'sport_name') || '',
    sportId: sport.id ?? (typeof e.sport !== 'object' ? e.sport : undefined),
    type: (sport.type || String(pick(e, 'sport_type', 'type') || '')).toLowerCase(),
    gender: genderCode(pick(e, 'gender', 'sex')),
    classification: pick(e, 'classification', 'class_name', 'sport_class') || '',
    date: date || '',
    time: start ? String(start).slice(String(start).length > 10 ? 11 : 0, String(start).length > 10 ? 16 : 5) : '',
    venue: pick(e, 'venue', 'location', 'place') || '',
    status: String(pick(e, 'status') || 'start-list').toLowerCase().replace('_', '-').replace(' ', '-'),
    judgeId: typeof e.judge === 'number' ? e.judge : e.judge?.id ?? null,
    judge: typeof e.judge === 'object' ? pick(e.judge, 'username', 'name') : pick(e, 'judge_name', 'judge') || '',
    participants: e.participants ? asList(e.participants).map(normalizeResult) : [],
    pointsAuto: Boolean(e.points_auto),          // points come from the a·b·c formula on the server
  }
}
export const normalizeEvents = (data) => asList(data).map(normalizeEvent)

export function normalizeResult(r) {
  const a = typeof r.athlete === 'object' && r.athlete ? r.athlete : {}
  const medal = String(pick(r, 'medal') || '').toLowerCase()
  const rank = pick(r, 'rank', 'position', 'place')
  return {
    id: r.id,
    athleteId: pick(a, 'id') ?? (typeof r.athlete !== 'object' ? r.athlete : undefined) ?? pick(r, 'athlete_id'),
    name: pick(a, 'name', 'full_name') || [a.first_name, a.last_name].filter(Boolean).join(' ') || pick(r, 'athlete_name', 'name') || 'Athlete',
    country: countryCode(pick(a, 'country', 'country_code', 'nationality') || pick(r, 'country', 'country_code')),
    // score_display is the backend's ready-to-show text (3:58.10, 14.20 ...)
    score: pick(r, 'score_display', 'score', 'result', 'mark', 'time') ?? '',
    points: (() => { const v = pick(r, 'point', 'points'); return v === null || v === undefined || v === '' ? '' : Number(v) })(),   // "916.00" -> 916
    rank: rank === undefined || rank === '' ? null : Number(rank),
    medal: ['gold', 'silver', 'bronze'].includes(medal) ? medal : medal === '1' ? 'gold' : medal === '2' ? 'silver' : medal === '3' ? 'bronze' : '',
    lane: pick(r, 'lane', 'order', 'bib') ?? '',
  }
}
export function normalizeResults(data) {
  return asList(data).map(normalizeResult).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
}

export function normalizeAthlete(a) {
  const name = pick(a, 'name', 'full_name') || [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Athlete'
  const events = asList(pick(a, 'events', 'competes_in', 'results', 'competitions') || []).map((x) => {
    const ev = typeof x.event === 'object' && x.event ? normalizeEvent(x.event) : null
    const res = normalizeResult(x)
    return {
      eventId: ev?.id ?? (typeof x.event !== 'object' ? x.event : undefined) ?? pick(x, 'event_id'),
      eventName: ev?.name || pick(x, 'event_name', 'name') || 'Event',
      date: ev?.date || pick(x, 'date') || '',
      score: res.score, rank: res.rank, medal: res.medal, points: res.points,
    }
  })
  return {
    id: a.id, name, user: a.user ?? null, user_username: a.user_username || '', user_email: a.user_email || '',
    country: countryCode(pick(a, 'country', 'country_code', 'nationality')),
    gender: genderCode(pick(a, 'gender', 'sex')),
    classification: pick(a, 'classification', 'sport_class', 'class_name') || '',
    sport: typeof a.sport === 'object' ? normalizeSport(a.sport).name : pick(a, 'sport', 'sport_name') || '',
    bib: pick(a, 'bib', 'bib_number') || '',
    birth: pick(a, 'birth_date', 'date_of_birth', 'dob') || '',
    events,
  }
}
export const normalizeAthletes = (data) => asList(data).map(normalizeAthlete)
