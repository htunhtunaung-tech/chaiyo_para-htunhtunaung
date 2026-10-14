// Public API calls for Member 3's pages. URLs match the team's agreed list.
import { API_URL, GENDER_API, TOKEN_KEY, USE_MOCK } from './config.js'
import { clearSession, getUser } from './auth.js'
import { ApiError } from './errors.js'
import { mockGet, mockSend } from './mock.js'
import { normalizeAthlete, normalizeAthletes, normalizeEvent, normalizeEvents, normalizeMedals, normalizeResults } from './normalize.js'

function token() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

// fetch wrapper: adds the DRF token when there is one, turns HTTP errors into readable messages
async function apiGet(path, params = {}) {
  if (params.gender) params = { ...params, gender: GENDER_API[params.gender] || params.gender } // M -> Men
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  const url = `${API_URL}${path}${qs.toString() ? `?${qs}` : ''}`
  const headers = { Accept: 'application/json' }
  const t = token()
  if (t) headers.Authorization = `Token ${t}`
  let res
  try {
    res = await fetch(url, { headers })
    // DRF answers 401 to an expired token even on public pages (e.g. after the database was reset).
    // Forget the stale login and ask again as a visitor.
    if (res.status === 401 && t) {
      clearSession()
      delete headers.Authorization
      res = await fetch(url, { headers })
    }
  } catch {
    throw new ApiError('Cannot reach the server. Check that Django is running and allows this page (CORS).', 0)
  }
  if (!res.ok) {
    const msg = res.status === 404 ? 'Not found.' : res.status === 401 || res.status === 403 ? 'Please sign in to see this.' : `Server error (${res.status}).`
    throw new ApiError(msg, res.status)
  }
  return res.json()
}

// POST / PUT / PATCH / DELETE with a JSON body (admin and judge pages)
// The only place that shapes what is sent to Django. If the backend uses other field names, change them here.
function outgoing(method, path, body) {
  if (!body) return body
  // Create / edit event: the form uses M/F/X; the backend wants Men/Women/Mixed.
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && /^\/api\/events\/(\d+\/)?$/.test(path)) {
    const out = { ...body }
    if (out.gender) out.gender = GENDER_API[out.gender] || out.gender
    // The Event model stores one date_time; also send the pieces so either style is accepted
    // (Django ignores fields it does not know).
    if (out.date && out.start_time) out.date_time = `${out.date}T${out.start_time}:00`
    if (out.venue !== undefined) out.location = out.venue
    // judge is a user id on the backend; the form has a free-text box, so only send a number.
    if (out.judge === '' || out.judge === undefined || Number.isNaN(Number(out.judge))) delete out.judge
    return out
  }
  // Results: empty boxes are sent as null, a time typed as m:ss.xx is sent in seconds (the score
  // column is a number), and only an admin sends the medal (the backend refuses it from a judge).
  if (/^\/api\/results\/\d+\/$/.test(path)) {
    const out = { ...body }
    for (const k of ['score', 'point', 'rank']) if (out[k] === '' || out[k] === undefined) out[k] = null
    if (typeof out.score === 'string' && out.score.includes(':')) {
      const secs = out.score.split(':').map(Number).reduce((t, x) => t * 60 + x, 0)
      if (!Number.isNaN(secs)) out.score = secs.toFixed(2)
    }
    if (getUser()?.role !== 'admin') delete out.medal
    else if (out.medal === '') out.medal = null
    return out
  }
  // Add athlete: the backend reads "athlete"; keep "athlete_id" too for other versions.
  if (/\/participants\/$/.test(path) && body.athlete_id !== undefined) return { athlete: Number(body.athlete_id), ...body }
  // Status values on the backend use an underscore: start_list, live, result.
  if (/\/status\/$/.test(path) && body.status) return { ...body, status: String(body.status).replace(/-/g, '_') }
  return body
}

async function apiSend(method, path, body) {
  body = outgoing(method, path, body)
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers.Authorization = `Token ${t}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError('Cannot reach the server. Check that Django is running and allows this page (CORS).', 0)
  }
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.detail || Object.values(j).flat().join(' ') } catch { /* no JSON body */ }
    const msg = res.status === 401 ? 'Please sign in again.' : res.status === 403 ? detail || 'Your account is not allowed to do this.' : detail || `Server error (${res.status}).`
    throw new ApiError(msg, res.status)
  }
  return res.status === 204 ? {} : res.json().catch(() => ({}))
}

const get = USE_MOCK ? mockGet : apiGet
const send = USE_MOCK ? mockSend : apiSend

export const getMedals = async () => normalizeMedals(await get('/api/medals/'))
export const getEvents = async ({ gender = '', date = '', sport_type = '' } = {}) =>
  normalizeEvents(await get('/api/events/', { gender, date, sport_type }))
export const getEvent = async (id) => normalizeEvent(await get(`/api/events/${id}/`))
export const getEventResults = async (id) => normalizeResults(await get(`/api/events/${id}/results/`))
export const getAthletes = async (search = '') => normalizeAthletes(await get('/api/athletes/', { search }))
export const getAthlete = async (id) => normalizeAthlete(await get(`/api/athletes/${id}/`))
// The backend has no /api/auth/me/, so "who am I" is the user saved at login (see auth.js).
export const getMe = async () => { const u = getUser(); if (!u) throw new ApiError('Please sign in.', 401); return u }
// The backend only moves an event forward (start list -> live -> result); the demo data can also go back.
export const canReopen = USE_MOCK
export const hasToken = () => Boolean(token())
export const isMock = USE_MOCK

// ----- Admin and judge actions (agreed API list) -----
// Sports: the backend sends { name: 'Track', sub_type: 'Sprinting (วิ่งระยะสั้น)' }; the form wants a name and a group.
export const getSports = async () => {
  const d = await get('/api/sports/')
  return (Array.isArray(d) ? d : d.results || []).map((s) => s.sub_type
    ? { ...s, name: String(s.sub_type).replace(/\s*\(.*\)\s*$/, ''), sport_type: String(s.name).toLowerCase() }
    : s)
}
export const createEvent = (data) => send('POST', '/api/events/', data)
export const updateEvent = (id, data) => send('PUT', `/api/events/${id}/`, data)
export const deleteEvent = (id) => send('DELETE', `/api/events/${id}/`)
export const addParticipant = (eventId, athleteId) => send('POST', `/api/events/${eventId}/participants/`, { athlete_id: athleteId })
export const removeParticipant = (eventId, athleteId) => send('DELETE', `/api/events/${eventId}/participants/${athleteId}/`)
export const setEventStatus = (id, status) => send('PATCH', `/api/events/${id}/status/`, { status })
export const autoMedals = (id) => send('POST', `/api/events/${id}/auto-medals/`)
export const updateResult = (id, data) => send('PATCH', `/api/results/${id}/`, data)
