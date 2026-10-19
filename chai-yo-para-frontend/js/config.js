// ===== Settings the team may need to change =====

// true  = use the built-in demo data (works with no backend, good for practice and demos)
// false = call the Django API at API_URL
// Demo data switches on by itself when the site is hosted without Django (the live portfolio demo on
// Vercel or GitHub Pages). Locally you can try it with ?demo=1 and switch back with ?demo=0.
const DEMO_HOSTS = ['.vercel.app', '.github.io', '.netlify.app']
function demoMode() {
  try {
    const flag = new URLSearchParams(location.search).get('demo')
    if (flag === '1') sessionStorage.setItem('chaiyo-demo', '1')
    if (flag === '0') sessionStorage.removeItem('chaiyo-demo')
    if (sessionStorage.getItem('chaiyo-demo') === '1') return true
  } catch { /* storage blocked: fall through */ }
  return DEMO_HOSTS.some((h) => location.hostname.endsWith(h))
}
export const USE_MOCK = demoMode()

// Where Django runs. With Live Server the page is on port 5500 and Django on 8000,
// so Django must allow this origin (django-cors-headers, see README).
// When Django serves the pages itself (python manage.py runserver) the API is on the same address.
export const API_URL = location.port === '8000' ? location.origin : 'http://127.0.0.1:8000'

// How often the medal table and live results refresh, in milliseconds.
export const POLL_MS = 5000

// Must match the key Member 4 uses when saving the login token.
export const TOKEN_KEY = 'token'

// Inside the pages gender is M / F / X. The backend uses the words Men / Women / Mixed,
// so api.js converts on the way out and normalize.js converts on the way in.
export const GENDER_API = { M: 'Men', F: 'Women', X: 'Mixed' }
export const GENDER_FROM_API = { men: 'M', women: 'F', mixed: 'X', male: 'M', female: 'F', m: 'M', f: 'F', x: 'X' }

// Values used by the gender filter and the event form (internal codes, see above).
export const GENDER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'M', label: 'Men' },
  { value: 'F', label: 'Women' },
  { value: 'X', label: 'Mixed' },
]
export const SPORT_TYPE_OPTIONS = [
  { value: '', label: 'All events' },
  { value: 'track', label: 'Track' },
  { value: 'field', label: 'Field' },
  { value: 'road', label: 'Road' },
]
