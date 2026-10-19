# Chai-Yo Para · frontend (public pages and staff area)

Plain HTML, CSS and JavaScript. No React, no npm, no build step.

| Page | File | API used |
|---|---|---|
| Live medal table (opening page, refreshes every 5 s) | `index.html` | `GET /api/medals/`, `GET /api/events/` |
| Competition: schedule and results with filters | `competition.html` | `GET /api/events/?gender=&date=&sport_type=` |
| One event: podium, live or final results, start list | `event.html?id=5` | `GET /api/events/<id>/`, `GET /api/events/<id>/results/` |
| Athlete list with search and country filter | `athletes.html` | `GET /api/athletes/?search=` |
| Athlete profile, medals and events | `athlete.html?id=3` | `GET /api/athletes/<id>/` |

The navbar, footer, shared styling and Display menu (text size, high contrast,
dark mode, reduce motion) appear on every page. `login.html` is a placeholder for Member 4.

## Staff area (laptop pages)

Open `dashboard.html`, or click **Staff area** in the footer of any public page. Every staff page
has the same sidebar, top bar and Display menu. They are designed for laptops (1280 px and wider).

| Page | File | Data |
|---|---|---|
| Dashboard: today, things that need attention, coming up, medal leaders (refreshes every 5 s) | `dashboard.html` | API |
| Team manager view for one country | `team.html?country=THA` | API |
| Delegations: every athlete by country, profile panel, CSV export | `delegation.html` | API |
| Event setup: create, edit, delete, add or remove athletes, start, finish, set medals | `events-admin.html` (`?new=1` opens "New event") | API |
| Timetable by day and venue, with a "now" line | `timetable.html?day=2026-10-14` | API |
| Results entry: score, rank, points, medal per athlete; rank from results; publish | `results-entry.html?id=5` | API |
| Medals and statistics: table, medals by day, top athletes, CSV | `medals.html` | API |
| Venue and facility booking: clashes, requests, new bookings | `venues.html` | demo data |
| Announcements: compose in English and Thai, preview, sent list | `announcements.html` | demo data |
| Admin: users and roles, CSV reports, settings | `admin.html` | users and settings are demo data; reports use the API |

"Demo data" pages have no endpoint in our API list, so they keep their changes in the
browser (`localStorage`, keys starting with `chaiyo-`). Clear site data to reset them.

### Write endpoints the staff pages call

All writes send `Authorization: Token <key>` (from `localStorage.token`) and JSON bodies.

| Action | Request | Body |
|---|---|---|
| Create / edit event | `POST /api/events/`, `PUT /api/events/<id>/` | `{ name, sport, gender, classification, date, start_time, venue, judge }` (`sport` is the sport id, `start_time` is `HH:MM`) |
| Delete event | `DELETE /api/events/<id>/` | none |
| Add / remove athlete | `POST /api/events/<id>/participants/`, `DELETE /api/events/<id>/participants/<athlete_id>/` | `{ athlete_id }` |
| Change status | `PATCH /api/events/<id>/status/` | `{ status: "start-list" \| "live" \| "result" }` |
| Set medals from ranks | `POST /api/events/<id>/auto-medals/` | none |
| Save one result | `PATCH /api/results/<id>/` | `{ score, rank, point, medal }` |
| Sport list for the event form | `GET /api/sports/` | none |

The body field names above are our best guess. If the backend uses others, change them in
`js/api.js` (writes) and `js/normalize.js` (reads). Error messages from DRF are shown to the user.

## How to open it

Use **Live Server** in VS Code: right-click `index.html` and choose **Open with Live Server**.
Double-clicking the file does not work, because the JavaScript files are modules
(`<script type="module">`) and browsers only load modules from a server.

The pages talk to Django by default. **Demo data** (no backend needed) switches on by itself on
`*.vercel.app`, `*.github.io` and `*.netlify.app` addresses, or locally with `?demo=1` in the address
(`?demo=0` switches it off). In the demo, live events finish while you watch, so the medal table moves.

## Connecting to Django

1. Check `API_URL` in `js/config.js` (pages served by Django on port 8000 use the same address automatically).
2. Live Server runs on port 5500 and Django on 8000, so Django must allow the page.
   Member 1 or 2 adds this to the backend:
   ```
   pip install django-cors-headers
   # settings.py
   INSTALLED_APPS += ['corsheaders']
   MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware'] + MIDDLEWARE
   CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5500', 'http://localhost:5500']
   ```

## For the team

**Members 1 and 2 (backend).** If your JSON field names differ, change only
`js/normalize.js`; nothing else needs to change. The pages expect:

- `/api/medals/`: a list of `{ country, country_name, gold, silver, bronze }`. `country` can be
  a code (`THA`) or a name (`Thailand`).
- `/api/events/`: `{ id, name, sport: { name, sport_type }, gender, date, start_time, venue, status, judge }`.
  `status` is `start-list`, `live` or `result`. `gender` values are set in `js/config.js` (`M`, `F`, `X`).
- `/api/events/<id>/results/`: `{ id, athlete: { id, name, country }, score, point, rank, medal }`.
  `medal` is `gold`, `silver`, `bronze` or null.
- `/api/athletes/<id>/`: `{ id, name, country, gender, classification, sport, events: [{ event: { id, name, date }, score, rank, medal, point }] }`.
- Plain lists and DRF paginated responses (`{ results: [...] }`) both work.

**Member 4 (login and management pages).**

- After login, save the DRF token: `localStorage.setItem('token', key)`. The navbar then
  calls `GET /api/auth/me/` and shows the user's name and role instead of "Sign in".
- Replace `login.html` with the real page. The navbar links signed-in users to `dashboard.html` (the staff area).
- To get the same navbar and footer on your pages, add this to each page:
  `<script type="module">import { renderShell } from './js/ui.js'; renderShell('login')</script>`
- Reuse the shared classes: `card`, `btn btn-primary`, `chip`, `badge badge-ok`, `input`,
  `table-head` and `table-row`. Colours are the variables in `css/tokens.css`.

## Sign in, roles and staff access (Member 4)

- `login.html` has Sign in and Register. `js/auth.js` does the work: `POST /api/auth/login/` returns
  `{ user, token }`; both are saved in `localStorage` (`token`, `user`). The backend has no `/api/auth/me/`,
  so the saved user is what the navbar shows.
- Roles come from the backend: `admin`, `judge`, `sporter`. Visitors are people who are not signed in.
- Staff pages need a sign-in. Admin opens everything. Judge opens Dashboard, Team, Delegations,
  Timetable, Results entry and Medals. Event setup, Venues, Announcements and Admin are admin only.
  Sporters and visitors are sent away. (`canOpen()` in `js/manage-ui.js` is the one place to change this.)
- The backend is the real gatekeeper: even if someone opens a page, Django still refuses writes without
  the right token and role.
- Backend words are converted in two places only: `js/api.js` (what we send: Men/Women/Mixed, `start_list`,
  `date_time`) and `js/normalize.js` (what we read). Pages keep using M / F / X and `start-list`.
- An old token (for example after the database was reset) is dropped automatically so public pages keep working.
- Demo mode (see above) signs in with `admin1`, `judge1` or `sporter1` (password `test1234`).
- Django must allow Live Server: `CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5500', 'http://localhost:5500']`.

## Countries and flags

`js/countries.js` lists all 170 delegations from the Paris 2024 Paralympic Games:
the 168 National Paralympic Committees, plus Neutral Paralympic Athletes (NPA) and the
Refugee Paralympic Team (RPT). Each one has its IPC code (`THA`, `CHN`, `GBR`…), English name,
Thai name and a flag in `flags/` (SVG files from the MIT-licensed flag-icons set, so they work offline).

- The backend can send either the IPC code or the English name; both are recognised.
- NPA, RPT and Chinese Taipei compete under their own Paralympic flags, so they show a neutral flag.
- The demo data has athletes from 20 of these countries; the admin and venue forms list all 170.

## Pictures

All pictures are in `images/` (WebP, about 330 KB in total):

| File | Where |
|---|---|
| `hero-stadium.webp` | Home page hero, behind "Live medal table" |
| `bg-light.webp`, `bg-dark.webp` | Page background on every page (light and dark mode) |
| `banner-blocks.webp` | Banner on the Competition page and the staff Dashboard |
| `athlete-wheelchair.webp` | Banner on the Athletes page |

They are decorative, so screen readers skip them. Each sits under a dark overlay so white text keeps
its contrast. High contrast mode removes every picture, and Reduce motion stops their slow zoom.

## Animation

All motion is in `css/animations.css`, plus helpers in `js/ui.js`:

- `flip()` slides medal-table and result rows to their new places when the order changes.
- `animateNumbers()` counts up to new values and gives them a "bump".
- `burst()` throws medal-coloured confetti when a country wins a new gold.

Other motion: page entrance, staggered cards, the running-track hero with lapping dots,
the podium rising, the refresh ring counting down to the next update, LIVE pulses and
shimmer loading rows. Everything stops when the visitor turns on **Reduce motion**, or
when their device asks for reduced motion.

## Files

```
index.html, competition.html, event.html, athletes.html, athlete.html, login.html
dashboard.html, team.html, delegation.html, events-admin.html, timetable.html, results-entry.html,
medals.html, venues.html, announcements.html, admin.html
css/   tokens.css (colours, light/dark/high contrast), global.css, animations.css, pages.css,
       manage.css (staff area)
js/    config.js (settings), api.js (fetch calls), normalize.js (field names), mock.js (demo data),
       ui.js (navbar, footer, display menu, polling, animation), countries.js, format.js,
       display-init.js (applies saved display settings before the page draws)
       manage-ui.js (sidebar, modal, toast), data.js (shared staff helpers), demo-data.js
js/pages/  one file per page
```
