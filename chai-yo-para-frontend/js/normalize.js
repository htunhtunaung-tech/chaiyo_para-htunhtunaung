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
  if (typeof s === 'number') return { id: s, name: '', type: '' } // just the id (Chai-Yo backend)
  if (typeof s !== 'object') return { name: String(s), type: '' }
  return { id: s.id, name: pick(s, 'name', 'title') || '', type: String(pick(s, 'sport_type', 'type', 'category') || '').toLowerCase() }
}

// Chai-Yo backend: sport_name is the group (Track / Field / Road / Combined) and
// sport_sub_type the discipline, e.g. "Sprinting (วิ่งระยะสั้น)". Show the English part.
const englishPart = (s) => String(s || '').replace(/\s*\(.*\)\s*$/, '').trim()
// No venue or class field on the backend: take the class from the name ("Men's 100m T54")
// and give each group its usual venue.
const VENUE_BY_TYPE = { track: 'Main track', field: 'Throws and jumps area', road: 'Road course', combined: 'Main track' }
const classFromName = (n) => (String(n || '').match(/\b([TF]\d{2})\b/) || [])[1] || ''

export function normalizeEvent(e) {
  const sport = normalizeSport(e.sport)
  const start = pick(e, 'start_time', 'time', 'start', 'date_time', 'datetime', 'start_datetime')
  let date = pick(e, 'date', 'event_date')
  if (!date && start && String(start).length > 10) date = String(start).slice(0, 10)
  return {
    id: e.id,
    name: pick(e, 'name', 'title', 'event_name') || 'Event',
    sport: sport.name || englishPart(pick(e, 'sport_sub_type')) || pick(e, 'sport_name') || '',
    sportId: sport.id ?? (typeof e.sport !== 'object' ? e.sport : undefined),
    type: (sport.type || String(pick(e, 'sport_type', 'type', 'sport_name') || '')).toLowerCase(),
    // true when the highest mark wins (field, combined); false when the lowest time wins
    higherWins: e.rank_order ? e.rank_order === 'desc' : undefined,
    gender: genderCode(pick(e, 'gender', 'sex')),
    classification: pick(e, 'classification', 'class_name', 'sport_class') || classFromName(pick(e, 'name', 'title')),
    date: date || '',
    time: start ? String(start).slice(String(start).length > 10 ? 11 : 0, String(start).length > 10 ? 16 : 5) : '',
    venue: pick(e, 'venue', 'location', 'place') || VENUE_BY_TYPE[String(pick(e, 'sport_type', 'sport_name') || sport.type || '').toLowerCase()] || '',
    status: String(pick(e, 'status') || 'start-list').toLowerCase().replace('_', '-').replace(' ', '-'),
    judge: e.judge && typeof e.judge === 'object' ? pick(e.judge, 'username', 'name') : pick(e, 'judge_name') || (typeof e.judge === 'string' ? e.judge : ''),
    judgeId: typeof e.judge === 'number' ? e.judge : undefined,
    participants: e.participants ? asList(e.participants).map(normalizeResult) : [],
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
    score: pick(r, 'score', 'result', 'mark', 'time') ?? '',
    points: pick(r, 'point', 'points') ?? '',
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
      status: ev?.status || '',
      score: res.score, rank: res.rank, medal: res.medal, points: res.points,
    }
  })
  return {
    id: a.id, name,
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
