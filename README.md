# Paralympics Track & Field - Backend API

Django + Django REST Framework + PostgreSQL. JSON only. Token login.

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

## Run it together with the website (frontend)

1. Start this backend as above (`python manage.py runserver`, it must stay open).
2. Open the `chai-yo-para-frontend` folder in VS Code, right-click `index.html` and choose
   **Open with Live Server** (it opens on `http://127.0.0.1:5500`).
3. In the website click **Sign in** and use `admin1` / `test1234`.

CORS already allows `http://127.0.0.1:5500` and `http://localhost:5500` (the Live Server addresses).
If you open the website on another address, add it to `CORS_ALLOWED_ORIGINS` in `.env`.

A superuser made with `createsuperuser` automatically gets the `admin` role, so it can sign in to the website's staff area.

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
| `GET /api/events/<id>/` , `GET /api/events/<id>/results/` | public | results are ordered by rank. Events also include `judge_name` and `participants` (read only) |
| `GET /api/athletes/?search=` , `GET /api/athletes/<id>/` | public | searches name, country, class. The detail also lists the athlete's `events` with score, rank and medal |
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
- Scores and points cannot be negative; rank starts at 1.
- Login and register are limited to 10 requests per minute per address.

## Configuration (.env)

See `.env.example`. With `DJANGO_DEBUG=0` the server refuses to start without `DJANGO_SECRET_KEY`.
When deployed behind HTTPS set `DJANGO_HTTPS=1`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
and `CSRF_TRUSTED_ORIGINS`, then check with `python manage.py check --deploy`.
Do not run `seed_competitions` in production (it creates users with a known password; it refuses unless `DEBUG` is on).
