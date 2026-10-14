// Sign in, register, sign out and "who is signed in" (Member 4).
// Backend contract (accounts/views.py):
//   POST /api/auth/login/     { username, password }  ->  { user: {...}, token }   (400 { error } on a wrong password)
//   POST /api/auth/register/  { username, password, ... } ->  201 { user: {...}, token }   (400 { field: [msgs] })
//   POST /api/auth/logout/    (needs the token header)  ->  { message }
// There is no /api/auth/me/, so the user object from login is saved in localStorage.
import { API_URL, TOKEN_KEY, USE_MOCK } from './config.js'
import { ApiError } from './errors.js'

export const USER_KEY = 'user'

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const drop = (k) => { try { localStorage.removeItem(k) } catch { /* private mode */ } }

export function getToken() { return read(TOKEN_KEY) }
export function getUser() {
  if (!getToken()) return null
  try { return JSON.parse(read(USER_KEY)) } catch { return null }
}
export const isSignedIn = () => Boolean(getUser())
export const roleOf = () => String(getUser()?.role || '').toLowerCase()

export function saveSession({ token, user }) {
  write(TOKEN_KEY, token)
  write(USER_KEY, JSON.stringify(user))
}
export function clearSession() { drop(TOKEN_KEY); drop(USER_KEY) }

// Turn a DRF error body into one readable sentence.
function messageFrom(body, status) {
  if (body && typeof body === 'object') {
    if (body.error) return String(body.error)
    if (body.detail) return String(body.detail)
    const parts = Object.entries(body).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`)
    if (parts.length) return parts.join(' · ')
  }
  return `Server error (${status}).`
}

// Plain POST without the token header, so a stale token can never block sign in.
async function post(path, body) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new ApiError('Cannot reach the server. Check that Django is running and allows this page (CORS).', 0)
  }
  let json = null
  try { json = await res.json() } catch { /* no body */ }
  if (!res.ok) throw new ApiError(res.status === 400 && json?.error === 'Wrong Credentials' ? 'Wrong username or password.' : messageFrom(json, res.status), res.status)
  return json
}

// Demo accounts used only when USE_MOCK is true (same names as the backend seed).
const MOCK_USERS = { admin1: 'admin', judge1: 'judge', sporter1: 'sporter' }
function mockLogin(username, password) {
  if (!MOCK_USERS[username] || password !== 'test1234') throw new ApiError('Wrong username or password. Demo accounts: admin1, judge1, sporter1 (password test1234).', 400)
  return { token: `mock-${username}`, user: { id: 0, username, role: MOCK_USERS[username] } }
}

export async function login(username, password) {
  const data = USE_MOCK ? mockLogin(username, password) : await post('/api/auth/login/', { username, password })
  if (!data?.token) throw new ApiError('The server did not return a token.', 500)
  saveSession({ token: data.token, user: data.user || { username } })
  return data.user
}

export async function register(fields) {
  if (USE_MOCK) throw new ApiError('Register is not available in demo mode. Use admin1, judge1 or sporter1 (password test1234).', 400)
  const data = await post('/api/auth/register/', fields)
  if (!data?.token) throw new ApiError('The server did not return a token.', 500)
  saveSession({ token: data.token, user: data.user || { username: fields.username } })
  return data.user
}

export async function signOut() {
  const token = getToken()
  if (token && !USE_MOCK) {
    try { await fetch(`${API_URL}/api/auth/logout/`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Token ${token}` } }) } catch { /* sign out locally anyway */ }
  }
  clearSession()
}

// Only follow "next" links that stay inside this site (e.g. results-entry.html?id=3).
export function safeNext(value) {
  return /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(value || '') ? value : ''
}
export function homeFor(role) {
  return role === 'admin' || role === 'judge' ? 'dashboard.html' : 'index.html'
}
