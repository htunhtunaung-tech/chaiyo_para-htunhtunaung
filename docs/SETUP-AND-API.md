# Setup, API and rules

## Folder layout

```
manage.py, config/, accounts/, competitions/   <- Django backend (run commands here)
chai-yo-para-frontend/                         <- the website (HTML, CSS, JavaScript)
docs/                                          <- this file and the README screenshots
```

When `DJANGO_DEBUG=1`, Django also serves the website, so `python manage.py runserver` gives you everything at http://127.0.0.1:8000.
The pages also work with VS Code Live Server (port 5500); Django then has to allow that origin (`CORS_ALLOWED_ORIGINS` in `.env`).

## Run it (Windows PowerShell)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env               # then open .env and set DB_PASSWORD to YOUR PostgreSQL password
# in pgAdmin create an empty database named chaiyo_db, then:
python manage.py migrate
python manage.py seed_competitions   # sample data (development only)
python manage.py createsuperuser     # your own admin account (optional)
python manage.py runserver
```

| Address | What it is |
|---|---|
| http://127.0.0.1:8000 | the website |
| http://127.0.0.1:8000/api/docs/ | interactive API documentation |
| http://127.0.0.1:8000/admin/ | Django admin (users, events, points tables…) |

Sample logins after seeding (password `test1234`): `admin1`, `judge1`, `sporter1`.
Tests: `python manage.py test` (with no PostgreSQL available: `set DB_ENGINE=sqlite` first).

**Updating an older copy?** Run `python manage.py migrate`, then `python manage.py recalculate_points` once, so results saved before automatic points existed get their points too.

## If `migrate` fails

| Error text | Cause and fix |
|---|---|
| `database "chaiyo_db" does not exist` | Create an empty database with that exact name in pgAdmin. |
| `password authentication failed` | `DB_PASSWORD` in `.env` is not your PostgreSQL password. The file must be named `.env` and sit next to `manage.py`. |
| `connection refused` | PostgreSQL is not running. Open pgAdmin once, or start the `postgresql-x64-…` Windows service. |
| `ImproperlyConfigured: Set DJANGO_SECRET_KEY` | `.env` is missing `DJANGO_DEBUG=1`. Copy `.env.example` again. |
| `ModuleNotFoundError` | Run `venv\Scripts\activate`, then `pip install -r requirements.txt`. |
| `That port is already in use` | An old server is still running. Close that terminal (or VS Code) and start again. |

If the browser still shows an old page after an update, press **Ctrl + Shift + R**.

## Roles

| Role | How you get it | Can do |
|---|---|---|
| visitor | register, or no account at all | read the medal table, events, results and athletes |
| athlete | register (name and country required) | same as a visitor, plus their own competition profile |
| team official | register | same as a visitor |
| judge | register as judge, then **an admin approves** | enter results for **their own event while it is live** |
| admin | `createsuperuser`, or another admin | everything: events, athletes, users, medals, points tables |

A judge request is stored as a visitor with `judge_status = pending` and cannot sign in until it is approved.
A locked account (admin → Users and roles → Lock) is told *"This account is locked"* when it signs in with the right password.

## Endpoints

Protected calls need the header `Authorization: Token <token>`.

| Method and URL | Who | Notes |
|---|---|---|
| `POST /api/auth/register/` | anyone | `{username, password, email?, role}`. Athletes also send `first_name, last_name, nationality, gender?, classification?` |
| `POST /api/auth/login/` · `POST /api/auth/logout/` · `GET /api/auth/me/` | anyone / signed in | login returns `{user, token}` |
| `GET /api/auth/judges/?status=pending` | admin | judge requests; `POST /api/auth/judges/<id>/approve/` or `/reject/` |
| `GET POST /api/auth/users/` · `GET PATCH DELETE /api/auth/users/<id>/` | admin | Users and roles page (`?role=&status=&search=`) |
| `GET /api/medals/` | public | only events whose status is `result` count |
| `GET /api/events/?gender=&date=YYYY-MM-DD&sport_type=&status=` | public | each event includes `points_auto` |
| `GET /api/events/<id>/` · `GET /api/events/<id>/results/` | public | results are ordered by rank |
| `GET /api/athletes/?search=` · `GET /api/athletes/<id>/` | public | |
| `GET /api/sports/` · `GET /api/points-tables/` | public | |
| `POST PUT PATCH DELETE` on events, athletes, sports, points-tables | admin | deleting something still in use returns 409 |
| `POST /api/events/<id>/participants/` · `DELETE …/participants/<athlete_id>/` | admin | only while the event is in the start list |
| `PATCH /api/events/<id>/status/` `{status}` | admin | `start_list` → `live` → `result` |
| `PATCH /api/results/<id>/` | admin, judge | `{score, point, rank}`; points are recalculated when the event has a formula; `medal` is admin only |
| `POST /api/events/<id>/rank/` | admin, or the event's judge while live | recalculates points and ranks (no medals) |
| `POST /api/events/<id>/auto-medals/` | admin | ranks (by points when every result has them) and gives gold, silver and bronze |

## Rules the API enforces

- **Event flow:** `start_list` → `live` → `result`, one step at a time. An admin may reopen a published event. An event cannot start with no athletes.
- **Automatic status:** events follow the real clock (live from the start time, finished after the duration of their category). A manual change switches the clock off for that event.
- **Points:** `PointsTable` holds `a, b, c` per event, gender and class (blank class = all classes).
  - Formulas: track `a·(b − T)^c`, field `a·(D − b)^c`, with jumps measured in centimetres.
  - A result slower or shorter than `b` gets 0 points.
  - Decathlon and heptathlon results are already points.
- **Ranking:** by points when every scored result has points; otherwise by score (lowest time or highest distance wins).
  - Ties share a rank (1, 1, 3).
  - No score (DNS or DNF) means no rank and no medal.
- **Countries:** they must be one of the 170 Paris 2024 delegations. The API accepts a code (`THA`), the name, or common spellings, and always stores the official name.
- **Entries:**
  - One entry per athlete per event.
  - Women cannot be added to a Men's event, and the other way round (use `Mixed`).
  - Scores and points cannot be negative.
  - Times may be typed as `14.20`, `3:58.10` or `1:25:30`.
- **Passwords:** Django's password-strength rules apply at sign-up.
- **Sign-in limit:** login and register are limited to 10 requests per minute from one address.

## Production notes

With `DJANGO_DEBUG=0` the server refuses to start without `DJANGO_SECRET_KEY`. Behind HTTPS, set `DJANGO_HTTPS=1`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, then check with `python manage.py check --deploy`.
Never run `seed_competitions` in production: it creates users with a known password, and it refuses to run unless `DEBUG` is on.
