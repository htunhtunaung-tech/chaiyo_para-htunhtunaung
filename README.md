# Paralympics Track & Field (Chai-Yo Para)

Backend: Django + Django REST Framework + PostgreSQL (JSON API, token login).
Frontend: plain HTML/CSS/JavaScript in `chai-yo-para-frontend/` (no npm, no build).

## Folder layout

```
Chai-Yo/                    <- this folder (run backend commands here)
  manage.py, config/, accounts/, competitions/
  chai-yo-para-frontend/    <- the website (open index.html with Live Server)
```

## Run everything (Windows PowerShell)

**1. Backend**
```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # then open .env and set DB_PASSWORD to YOUR PostgreSQL password
# in pgAdmin create an empty database named chaiyo_db, then:
python manage.py migrate
python manage.py seed_competitions
python manage.py runserver      # keep this window open
```

**2. Frontend**: in VS Code open `chai-yo-para-frontend/index.html`, right-click, **Open with Live Server**
(address `http://127.0.0.1:5500`). `js/config.js` must say `USE_MOCK = false` and `API_URL = 'http://127.0.0.1:8000'`.

**3. Try it**: sign in with `admin1`, `judge1` or `sporter1` (password `test1234`).

## If `migrate` fails

| Error text | Cause and fix |
|---|---|
| `database "chaiyo_db" does not exist` | Create an empty database with that exact name in pgAdmin. |
| `password authentication failed` / `no password supplied` | `.env` is missing or `DB_PASSWORD` is wrong. The file must be called `.env` (not `.env.example`) and sit next to `manage.py`. |
| `connection refused` / `could not connect to server` | PostgreSQL is not running. Open Windows Services and start `postgresql-x64-...`. Check `DB_PORT` (default 5432). |
| `ImproperlyConfigured: Set DJANGO_SECRET_KEY` | `.env` does not contain `DJANGO_DEBUG=1`. Copy `.env.example` again. |
| `ModuleNotFoundError` | Run `venv\Scripts\activate` then `pip install -r requirements.txt`. |
| `No module named dotenv` | The old `requirements.txt` was used. Run `pip install -r requirements.txt` again. |
| `relation ... already exists` | The database holds tables from an older copy of the code. Drop it in pgAdmin, create it again empty, then `migrate`. |

Check the settings Django really sees with: `python manage.py check`.

## Backend (API) details

## Run it (Windows PowerShell)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # then open .env and put YOUR PostgreSQL password
# create an empty database called chaiyo_db in pgAdmin, then:
python manage.py migrate
python manage.py seed_competitions      # demo data (development only)
python manage.py createsuperuser        # your own admin account
python manage.py runserver
```

- API docs (try every endpoint): http://127.0.0.1:8000/api/docs/
- Admin site: http://127.0.0.1:8000/admin/
- Tests: `python manage.py test`

Demo logins after seeding (password `test1234`): `admin1`, `judge1`, `sporter1`.

## Roles

| Role | Can do |
|---|---|
| visitor (no login) | read medal table, events, results, athletes |
| sporter | same as visitor (logged in) |
| judge | enter score / point / rank on results of **their own event while it is live** |
| admin | everything, including medals, events, athletes, sports |

Self-registration only creates `sporter` or `judge`. Admins are created with `createsuperuser` or in `/admin/`.

## Endpoints

Login header for protected calls: `Authorization: Token <token>`

| Method + URL | Who | Notes |
|---|---|---|
| `POST /api/auth/register/` | anyone | `{username, password, email?, role: sporter\|judge}` -> `{user, token}` |
| `POST /api/auth/login/` | anyone | `{username, password}` -> `{user, token}` |
| `POST /api/auth/logout/` | logged in | deletes the token |
| `GET /api/auth/me/` | logged in | `{id, username, email, role}` |
| `GET /api/medals/` | public | `[{position, country, gold, silver, bronze, total}]`, finished events only |
| `GET /api/events/?gender=&date=YYYY-MM-DD&sport_type=Track\|Field\|Road\|Combined&status=` | public | schedule |
| `GET /api/events/<id>/` , `GET /api/events/<id>/results/` | public | results are ordered by rank |
| `GET /api/athletes/?search=` , `GET /api/athletes/<id>/` | public | searches name, country, class |
| `GET /api/sports/` | public | |
| `POST/PUT/PATCH/DELETE /api/events/`, `/api/athletes/`, `/api/sports/` | admin | deleting something still in use returns 409 |
| `POST /api/events/<id>/participants/` `{athlete: id}` | admin | only while status is `start_list` |
| `DELETE /api/events/<id>/participants/<athlete_id>/` | admin | only while status is `start_list` |
| `PATCH /api/events/<id>/status/` `{status}` | admin | `start_list` -> `live` -> `result`, one step at a time |
| `POST /api/events/<id>/auto-medals/` | admin | ranks by score, gives gold/silver/bronze (event must be live or result) |
| `PATCH /api/results/<id>/` | admin, judge | `{score, point, rank}`; `medal` is admin only |

`/api/accounts/...` still works as an alias of `/api/auth/...`.

## Rules the API enforces

- Event flow is `start_list` -> `live` -> `result`. You cannot skip or go back, and cannot start an event with no athletes.
- Track and Road events: lowest `score` (time) wins. Field and Combined: highest `score` (distance, height, points) wins. This is `Sport.rank_order`.
- Ties share a rank (1, 1, 3). An athlete with no score (DNS/DNF) gets no rank and no medal.
- Medals are `gold`, `silver`, `bronze`. The public medal table counts only events whose status is `result`.
- One entry per athlete per event (database rule). Women cannot be added to a Men's event and vice versa (use `Mixed`).
- Scores and points cannot be negative; rank starts at 1. Times may be typed as `14.20`, `3:58.10` or `1:25:30`
  (stored as seconds; the API also returns `score_display`, ready to show).
- An admin can reopen a published event (`result` -> `live`); the medal table drops its medals until it is published again.
- Login and register are limited to 10 requests per minute per address.

## Configuration (.env)

See `.env.example`. With `DJANGO_DEBUG=0` the server refuses to start without `DJANGO_SECRET_KEY`.
When deployed behind HTTPS set `DJANGO_HTTPS=1`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
and `CSRF_TRUSTED_ORIGINS`, then check with `python manage.py check --deploy`.
Do not run `seed_competitions` in production (it creates users with a known password; it refuses unless `DEBUG` is on).

## Judge approval (new)
Register roles: **sporter**, **visitor** (account + token straight away) and **judge**.
A judge request is saved as a visitor with `judge_status = pending`: no token, cannot sign in ("pending").
An admin approves it on the website (Admin page -> *Judge requests*), in `/admin/` (action "Approve selected judge requests"),
or with `POST /api/auth/judges/<id>/approve/` (`/reject/` to decline). `GET /api/auth/judges/?status=pending` lists requests (admin only).
Run `python manage.py migrate` after updating (accounts 0002, competitions 0005).

## Event status follows the real clock (new)
- before the start time -> `start_list`; from the start time -> `live`; after start + duration -> `result` (medals are set from the scores if none exist).
- Duration: Track 2 h, Field 3 h, Road 5 h, Combined 10 h (`competitions/schedule.py`).
- An admin pressing Start / Finish / Reopen switches the clock off for that event (`auto_status = false`).
- A judge can save results only while the event is live and only for events assigned to them (pick the judge in the event form).

## Look at the data
- `/admin/` (log in as superuser) -> Users, Events, Competes ins ...
- pgAdmin 4 -> Servers -> chaiyo_db -> Schemas -> public -> Tables -> right click -> View/Edit Data -> All Rows
- `python manage.py dbshell` then `SELECT id, name, status, date_time FROM competitions_event;`
- Browser: `/api/events/`, `/api/medals/`, `/api/events/<id>/results/`, `/api/docs/`
