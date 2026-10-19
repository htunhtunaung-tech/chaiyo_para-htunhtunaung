from datetime import datetime, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Sport, Athlete, Event, CompetesIn, PointsTable

User = get_user_model()
WHEN = datetime(2036, 10, 11, 9, 0, tzinfo=timezone.utc)


class Base(APITestCase):
    def setUp(self):
        cache.clear()                                   # reset rate limits between tests
        self.admin = User.objects.create_user('admin', password='pw-Admin-123', role='admin')
        self.judge = User.objects.create_user('judge', password='pw-Judge-123', role='judge')
        self.judge2 = User.objects.create_user('judge2', password='pw-Judge-123', role='judge')
        self.sporter = User.objects.create_user('sporter', password='pw-Sport-123', role='athlete')
        self.track = Sport.objects.create(name='Track', sub_type='Sprinting', rank_order='asc')
        self.field = Sport.objects.create(name='Field', sub_type='High jump', rank_order='desc')
        mk = lambda f, c, g='Men': Athlete.objects.create(first_name=f, last_name=f, country=c, gender=g,
                                                            classification='T54')
        self.a1, self.a2, self.a3, self.a4 = mk('A', 'Thailand'), mk('B', 'Japan'), mk('C', 'USA'), mk('D', 'Brazil')
        self.w1 = mk('W', 'China', 'Women')
        self.event = Event.objects.create(name="Men's 100m", date_time=WHEN, gender='Men',
                                          sport=self.track, judge=self.judge)

    def as_user(self, user):
        if user is None:
            self.client.credentials()
        else:
            token, _ = Token.objects.get_or_create(user=user)
            self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def enter(self, event, athletes, scores=None):
        out = []
        for i, a in enumerate(athletes):
            out.append(CompetesIn.objects.create(event=event, athlete=a,
                                                 score=Decimal(scores[i]) if scores and scores[i] else None))
        return out


class AuthTests(Base):
    def test_register_cannot_create_admin(self):
        r = self.client.post('/api/auth/register/', {'username': 'x', 'password': 'Str0ng-pass-99', 'role': 'admin'})
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username='x').exists())

    def test_register_sporter_and_visitor(self):
        for role in ('athlete', 'visitor'):
            data = {'username': f'new-{role}', 'password': 'Str0ng-pass-99', 'role': role}
            if role == 'athlete':
                data.update(first_name='New', last_name='Athlete', nationality='Thailand')
            r = self.client.post('/api/auth/register/', data)
            self.assertEqual(r.status_code, 201)
            self.assertEqual(r.json()['user']['role'], role)
            self.assertIn('token', r.json())

    def test_register_rejects_weak_password(self):
        r = self.client.post('/api/auth/register/', {'username': 'weak', 'password': '12345678'})
        self.assertEqual(r.status_code, 400)

    def test_login_me_logout(self):
        r = self.client.post('/api/auth/login/', {'username': 'judge', 'password': 'pw-Judge-123'})
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + r.json()['token'])
        me = self.client.get('/api/auth/me/')
        self.assertEqual((me.json()['username'], me.json()['role']), ('judge', 'judge'))
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)   # token is gone

    def test_wrong_password(self):
        r = self.client.post('/api/auth/login/', {'username': 'judge', 'password': 'nope'})
        self.assertEqual(r.status_code, 400)

    def test_me_requires_login(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_login_is_rate_limited(self):
        codes = [self.client.post('/api/auth/login/', {'username': 'judge', 'password': 'bad'}).status_code
                 for _ in range(12)]
        self.assertIn(429, codes)

    def test_old_accounts_prefix_still_works(self):
        r = self.client.post('/api/accounts/login/', {'username': 'judge', 'password': 'pw-Judge-123'})
        self.assertEqual(r.status_code, 200)


class PublicReadTests(Base):
    def test_public_endpoints_need_no_login(self):
        self.enter(self.event, [self.a1])
        for url in ['/api/medals/', '/api/events/', f'/api/events/{self.event.id}/',
                    f'/api/events/{self.event.id}/results/', '/api/athletes/', f'/api/athletes/{self.a1.id}/',
                    '/api/sports/']:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_event_filters(self):
        Event.objects.create(name="Women's HJ", date_time=datetime(2036, 10, 12, 9, tzinfo=timezone.utc),
                             gender='Women', sport=self.field)
        names = lambda q: [e['name'] for e in self.client.get('/api/events/' + q).json()]
        self.assertEqual(names('?sport_type=Field'), ["Women's HJ"])
        self.assertEqual(names('?gender=men'), ["Men's 100m"])
        self.assertEqual(names('?date=2036-10-12'), ["Women's HJ"])
        self.assertEqual(self.client.get('/api/events/?date=12-10-2026').status_code, 400)

    def test_athlete_search(self):
        found = self.client.get('/api/athletes/?search=japan').json()
        self.assertEqual([a['country'] for a in found], ['Japan'])

    def test_results_nested_athlete(self):
        self.enter(self.event, [self.a1], ['10.5'])
        row = self.client.get(f'/api/events/{self.event.id}/results/').json()[0]
        self.assertEqual(row['athlete']['country'], 'Thailand')


class MedalTableTests(Base):
    def test_only_finished_events_count_and_sorting(self):
        done = Event.objects.create(name='done', date_time=WHEN, sport=self.track, status='result')
        live = Event.objects.create(name='live', date_time=WHEN, sport=self.track, status='live')
        for ev, ath, medal in [(done, self.a1, 'gold'), (done, self.a2, 'silver'), (done, self.a3, 'silver'),
                               (live, self.a4, 'gold')]:
            CompetesIn.objects.create(event=ev, athlete=ath, medal=medal)
        table = self.client.get('/api/medals/').json()
        self.assertEqual([r['country'] for r in table], ['Thailand', 'Japan', 'USA'])   # Brazil: event not finished
        self.assertEqual(table[0], {'country': 'Thailand', 'gold': 1, 'silver': 0, 'bronze': 0, 'total': 1, 'position': 1})

    def test_empty(self):
        self.assertEqual(self.client.get('/api/medals/').json(), [])


class PermissionTests(Base):
    EVENT = {'name': 'New', 'date_time': '2036-10-15T09:00:00Z', 'gender': 'Men'}

    def test_create_event_matrix(self):
        body = {**self.EVENT, 'sport': self.track.id}
        for user, code in [(None, 401), (self.sporter, 403), (self.judge, 403), (self.admin, 201)]:
            self.as_user(user)
            self.assertEqual(self.client.post('/api/events/', body, format='json').status_code, code, user)

    def test_athlete_and_sport_writes_are_admin_only(self):
        self.as_user(self.judge)
        self.assertEqual(self.client.post('/api/sports/', {'name': 'x'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/athletes/{self.a1.id}/').status_code, 403)
        self.as_user(self.admin)
        r = self.client.post('/api/athletes/', {'first_name': 'N', 'last_name': 'M', 'country': 'Laos',
                                                'gender': 'Men', 'classification': 'T11'})
        self.assertEqual(r.status_code, 201)
        bad = self.client.post('/api/athletes/', {'first_name': 'N', 'last_name': 'X', 'country': 'Atlantis',
                                                  'gender': 'Men', 'classification': 'T11'})
        self.assertEqual(bad.status_code, 400)          # only real Paralympic delegations

    def test_judge_must_have_judge_role(self):
        self.as_user(self.admin)
        r = self.client.post('/api/events/', {**self.EVENT, 'sport': self.track.id, 'judge': self.sporter.id},
                             format='json')
        self.assertEqual(r.status_code, 400)

    def test_status_cannot_be_set_on_create_or_put(self):
        self.as_user(self.admin)
        r = self.client.post('/api/events/', {**self.EVENT, 'sport': self.track.id, 'status': 'result'}, format='json')
        self.assertEqual(r.json()['status'], 'start_list')


class ParticipantTests(Base):
    def url(self, suffix=''):
        return f'/api/events/{self.event.id}/participants/{suffix}'

    def test_add_remove(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.post(self.url(), {'athlete': self.a1.id}).status_code, 201)
        self.assertEqual(self.client.post(self.url(), {'athlete': self.a1.id}).status_code, 200)   # no duplicate
        self.assertEqual(CompetesIn.objects.filter(event=self.event).count(), 1)
        self.assertEqual(self.client.delete(self.url(f'{self.a1.id}/')).status_code, 204)
        self.assertEqual(self.client.delete(self.url(f'{self.a1.id}/')).status_code, 404)

    def test_validation(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.post(self.url(), {}).status_code, 400)
        self.assertEqual(self.client.post(self.url(), {'athlete': 9999}).status_code, 400)
        self.assertEqual(self.client.post(self.url(), {'athlete': self.w1.id}).status_code, 400)   # woman in men's event

    def test_only_admin(self):
        self.as_user(self.judge)
        self.assertEqual(self.client.post(self.url(), {'athlete': self.a1.id}).status_code, 403)

    def test_locked_after_start(self):
        self.enter(self.event, [self.a1])
        self.event.status = 'live'; self.event.save()
        self.as_user(self.admin)
        self.assertEqual(self.client.post(self.url(), {'athlete': self.a2.id}).status_code, 409)
        self.assertEqual(self.client.delete(self.url(f'{self.a1.id}/')).status_code, 409)

    def test_duplicate_entry_blocked_by_database(self):
        self.enter(self.event, [self.a1])
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompetesIn.objects.create(event=self.event, athlete=self.a1)


class StatusTests(Base):
    def patch(self, status):
        return self.client.patch(f'/api/events/{self.event.id}/status/', {'status': status}, format='json')

    def test_flow(self):
        self.enter(self.event, [self.a1])
        self.as_user(self.admin)
        self.assertEqual(self.patch('result').status_code, 400)    # cannot skip
        self.assertEqual(self.patch('bogus').status_code, 400)
        self.assertEqual(self.patch('live').status_code, 200)
        self.assertEqual(self.patch('start_list').status_code, 400)  # cannot go back
        self.assertEqual(self.patch('result').status_code, 200)

    def test_cannot_start_empty_event(self):
        self.as_user(self.admin)
        self.assertEqual(self.patch('live').status_code, 400)

    def test_judge_forbidden(self):
        self.as_user(self.judge)
        self.assertEqual(self.patch('live').status_code, 403)


class ResultTests(Base):
    def setUp(self):
        super().setUp()
        self.e1, self.e2 = self.enter(self.event, [self.a1, self.a2])
        self.event.status = 'live'; self.event.save()

    def patch(self, entry, data):
        return self.client.patch(f'/api/results/{entry.id}/', data, format='json')

    def test_roles(self):
        for user, code in [(None, 401), (self.sporter, 403), (self.judge, 200), (self.admin, 200)]:
            self.as_user(user)
            self.assertEqual(self.patch(self.e1, {'score': '10.50', 'point': '5'}).status_code, code, user)

    def test_only_assigned_judge(self):
        self.as_user(self.judge2)
        self.assertEqual(self.patch(self.e1, {'score': '10'}).status_code, 403)

    def test_judge_only_while_live(self):
        self.event.status = 'result'; self.event.save()
        self.as_user(self.judge)
        self.assertEqual(self.patch(self.e1, {'score': '10'}).status_code, 403)
        self.as_user(self.admin)                                  # admin may still correct a result
        self.assertEqual(self.patch(self.e1, {'score': '10'}).status_code, 200)

    def test_medal_is_admin_only(self):
        self.as_user(self.judge)
        self.assertEqual(self.patch(self.e1, {'medal': 'gold'}).status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(self.patch(self.e1, {'medal': 'gold'}).status_code, 200)
        self.assertEqual(self.patch(self.e1, {'medal': 'platinum'}).status_code, 400)
        self.assertEqual(self.patch(self.e1, {'medal': None}).status_code, 200)

    def test_rejects_bad_numbers(self):
        self.as_user(self.admin)
        self.assertEqual(self.patch(self.e1, {'score': '-1'}).status_code, 400)
        self.assertEqual(self.patch(self.e1, {'rank': 0}).status_code, 400)
        self.assertEqual(self.patch(self.e1, {'score': 'fast'}).status_code, 400)

    def test_only_patch_allowed(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.put(f'/api/results/{self.e1.id}/', {}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/results/{self.e1.id}/').status_code, 405)


class AutoMedalTests(Base):
    def run_medals(self, event):
        self.as_user(self.admin)
        r = self.client.post(f'/api/events/{event.id}/auto-medals/')
        self.assertEqual(r.status_code, 200, r.content)
        return {x['athlete']['country']: (x['rank'], x['medal']) for x in r.json()}

    def test_track_lowest_time_wins(self):
        self.enter(self.event, [self.a1, self.a2, self.a3, self.a4], ['10.9', '10.2', '11.5', '12.0'])
        self.event.status = 'live'; self.event.save()
        got = self.run_medals(self.event)
        self.assertEqual(got, {'Japan': (1, 'gold'), 'Thailand': (2, 'silver'), 'USA': (3, 'bronze'), 'Brazil': (4, None)})

    def test_field_highest_wins(self):
        ev = Event.objects.create(name='HJ', date_time=WHEN, sport=self.field, status='live')
        self.enter(ev, [self.a1, self.a2, self.a3], ['1.80', '2.05', '1.95'])
        got = self.run_medals(ev)
        self.assertEqual(got['Japan'], (1, 'gold'))
        self.assertEqual(got['USA'], (2, 'silver'))
        self.assertEqual(got['Thailand'], (3, 'bronze'))

    def test_ties_share_rank(self):
        self.enter(self.event, [self.a1, self.a2, self.a3, self.a4], ['10.0', '10.0', '11.0', '12.0'])
        self.event.status = 'live'; self.event.save()
        got = self.run_medals(self.event)
        self.assertEqual((got['Thailand'], got['Japan']), ((1, 'gold'), (1, 'gold')))
        self.assertEqual(got['USA'], (3, 'bronze'))

    def test_no_score_gets_nothing_and_fewer_than_three_ok(self):
        self.enter(self.event, [self.a1, self.a2], ['10.0', None])
        self.event.status = 'live'; self.event.save()
        got = self.run_medals(self.event)
        self.assertEqual(got, {'Thailand': (1, 'gold'), 'Japan': (None, None)})

    def test_rerun_clears_old_medals(self):
        e1, e2 = self.enter(self.event, [self.a1, self.a2], ['10.0', '11.0'])
        self.event.status = 'live'; self.event.save()
        self.run_medals(self.event)
        e1.score = Decimal('12.0'); e1.save()
        got = self.run_medals(self.event)
        self.assertEqual(got['Japan'], (1, 'gold'))
        self.assertEqual(got['Thailand'], (2, 'silver'))

    def test_needs_started_event_and_admin(self):
        self.enter(self.event, [self.a1], ['10.0'])
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/events/{self.event.id}/auto-medals/').status_code, 409)
        self.as_user(self.judge)
        self.assertEqual(self.client.post(f'/api/events/{self.event.id}/auto-medals/').status_code, 403)


class SafeDeleteTests(Base):
    def test_cannot_delete_athlete_or_sport_in_use(self):
        self.enter(self.event, [self.a1])
        self.as_user(self.admin)
        self.assertEqual(self.client.delete(f'/api/athletes/{self.a1.id}/').status_code, 409)
        self.assertEqual(self.client.delete(f'/api/sports/{self.track.id}/').status_code, 409)
        self.assertTrue(Athlete.objects.filter(id=self.a1.id).exists())

    def test_can_delete_unused_athlete_and_event(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.delete(f'/api/athletes/{self.a4.id}/').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/events/{self.event.id}/').status_code, 204)


class DocsTests(Base):
    def test_schema_and_docs(self):
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)
        self.assertEqual(self.client.get('/api/docs/').status_code, 200)


# ---------------- Behaviour the website (frontend) relies on ----------------

class FrontendContractTests(Base):
    def setUp(self):
        super().setUp()
        self.e1, self.e2 = self.enter(self.event, [self.a1, self.a2])
        self.event.status = 'live'
        self.event.save()

    def patch(self, entry, data):
        return self.client.patch(f'/api/results/{entry.id}/', data, format='json')

    def test_add_participant_accepts_athlete_id(self):
        ev = Event.objects.create(name='Another', date_time=WHEN, gender='Men', sport=self.track)
        self.as_user(self.admin)
        r = self.client.post(f'/api/events/{ev.id}/participants/', {'athlete_id': self.a3.id}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_judge_can_save_a_row_the_way_the_website_sends_it(self):
        """The website always sends medal=null and empty strings for blank boxes."""
        self.as_user(self.judge)
        r = self.patch(self.e1, {'score': '10.52', 'rank': None, 'point': None, 'medal': None})
        self.assertEqual(r.status_code, 200, r.content)
        r = self.patch(self.e2, {'score': '', 'rank': None, 'point': None, 'medal': None})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(CompetesIn.objects.get(pk=self.e2.pk).score)

    def test_judge_still_cannot_change_a_medal(self):
        self.as_user(self.admin)
        self.patch(self.e1, {'medal': 'gold'})
        self.as_user(self.judge)
        self.assertEqual(self.patch(self.e1, {'medal': 'gold'}).status_code, 200)     # unchanged = fine
        self.assertEqual(self.patch(self.e1, {'medal': 'silver'}).status_code, 403)   # changed = admin only
        self.assertEqual(self.patch(self.e1, {'medal': None}).status_code, 403)

    def test_times_can_be_typed_as_minutes_and_seconds(self):
        self.as_user(self.judge)
        r = self.patch(self.e1, {'score': '3:58.10'})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Decimal(r.json()['score']), Decimal('238.10'))
        self.assertEqual(r.json()['score_display'], '3:58.10')
        r = self.patch(self.e2, {'score': '1:25:30'})
        self.assertEqual(r.json()['score_display'], '1:25:30')
        self.assertEqual(self.patch(self.e2, {'score': '9:xx'}).status_code, 400)

    def test_score_display_for_each_category(self):
        from .serializers import display_score
        self.assertEqual(display_score(Decimal('14.2'), 'Track'), '14.20')
        self.assertEqual(display_score(Decimal('59.99'), 'Road'), '59.99')
        self.assertEqual(display_score(Decimal('1.6'), 'Field'), '1.60')
        self.assertEqual(display_score(Decimal('7421'), 'Combined'), '7421')
        self.assertEqual(display_score(None, 'Track'), '')

    def test_event_json_has_what_the_pages_need(self):
        self.event.venue, self.event.classification = 'Main Stadium', 'T54'
        self.event.save()
        data = self.client.get(f'/api/events/{self.event.id}/').json()
        self.assertEqual(data['sport']['name'], 'Sprinting')
        self.assertEqual(data['sport']['sport_type'], 'track')
        self.assertEqual(data['sport']['id'], self.track.id)
        self.assertEqual((data['venue'], data['classification'], data['judge_name']), ('Main Stadium', 'T54', 'judge'))

    def test_event_can_be_created_and_edited_with_the_website_form(self):
        self.as_user(self.admin)
        body = {'name': 'New 200m', 'sport': self.track.id, 'gender': 'Men', 'classification': 'T54',
                'date': '2036-10-15', 'start_time': '09:30', 'date_time': '2036-10-15T09:30:00',
                'venue': 'Main Stadium', 'location': 'Main Stadium'}
        r = self.client.post('/api/events/', body, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        r = self.client.put(f"/api/events/{r.json()['id']}/", {**body, 'name': 'New 200m final'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['name'], 'New 200m final')

    def test_status_accepts_dash_and_reopen(self):
        self.as_user(self.admin)
        url = f'/api/events/{self.event.id}/status/'
        self.assertEqual(self.client.patch(url, {'status': 'result'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(url, {'status': 'live'}, format='json').status_code, 200)      # reopen
        self.assertEqual(self.client.patch(url, {'status': 'start-list'}, format='json').status_code, 400)

    def test_athlete_detail_lists_events_and_hides_unpublished_medals(self):
        self.as_user(self.admin)
        self.patch(self.e1, {'score': '10.5', 'medal': 'gold'})
        data = self.client.get(f'/api/athletes/{self.a1.id}/').json()
        self.assertEqual(data['sport'], 'Track')
        self.assertEqual(len(data['events']), 1)
        self.assertEqual(data['events'][0]['event']['name'], "Men's 100m")
        self.assertIsNone(data['events'][0]['medal'])              # event is still live
        self.event.status = 'result'
        self.event.save()
        data = self.client.get(f'/api/athletes/{self.a1.id}/').json()
        self.assertEqual(data['events'][0]['medal'], 'gold')

    def test_athlete_list_stays_light(self):
        row = self.client.get('/api/athletes/').json()[0]
        self.assertNotIn('events', row)

    def test_cors_allows_live_server(self):
        for origin in ('http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:5173'):
            r = self.client.get('/api/medals/', HTTP_ORIGIN=origin)
            self.assertEqual(r.headers.get('Access-Control-Allow-Origin'), origin)
        r = self.client.get('/api/medals/', HTTP_ORIGIN='http://evil.example')
        self.assertIsNone(r.headers.get('Access-Control-Allow-Origin'))

    def test_seed_command_is_repeatable_and_covers_all_categories(self):
        from django.core.management import call_command
        call_command('seed_competitions', verbosity=0, force=True)
        call_command('seed_competitions', verbosity=0, force=True)
        cats = set(Event.objects.values_list('sport__name', flat=True))
        self.assertTrue({'Track', 'Field', 'Road', 'Combined'} <= cats)
        self.assertEqual(Event.objects.filter(name="Men's 100m T54").count(), 1)
        self.assertTrue(Event.objects.get(name="Men's Marathon T54").venue)


class SuperuserRoleTests(Base):
    def test_createsuperuser_accounts_are_admins(self):
        boss = User.objects.create_superuser('boss', 'b@example.com', 'pw-Boss-12345')
        self.assertEqual(boss.role, 'admin')
        self.as_user(boss)
        r = self.client.post('/api/events/', {'name': 'X', 'date_time': '2036-10-15T09:00:00Z',
                                              'gender': 'Men', 'sport': self.track.id}, format='json')
        self.assertEqual(r.status_code, 201)


class ClockStatusTests(Base):
    """Event status follows the real clock."""
    def setUp(self):
        super().setUp()
        from datetime import timedelta
        from django.utils import timezone as dj_tz
        self.now = dj_tz.now()
        self.td = timedelta

    def make(self, name, start, **kw):
        ev = Event.objects.create(name=name, date_time=start, gender='Men', sport=self.track, judge=self.judge, **kw)
        self.enter(ev, [self.a1, self.a2, self.a3], ['10.50', '10.20', '10.90'])
        return ev

    def test_future_stays_start_list_started_goes_live_old_is_finished_with_medals(self):
        future = self.make('f', self.now + self.td(hours=5))
        live = self.make('l', self.now - self.td(minutes=30))
        done = self.make('d', self.now - self.td(hours=5))
        got = {e['name']: e['status'] for e in self.client.get('/api/events/').data}
        self.assertEqual((got['f'], got['l'], got['d']), ('start_list', 'live', 'result'))
        medals = {m.athlete.first_name: m.medal for m in done.competesin_set.all()}
        self.assertEqual(medals, {'B': 'gold', 'A': 'silver', 'C': 'bronze'})   # lowest time wins on track

    def test_manual_status_change_overrides_clock(self):
        ev = self.make('m', self.now - self.td(hours=5), status='live', auto_status=False)
        self.client.get('/api/events/')
        ev.refresh_from_db()
        self.assertEqual(ev.status, 'live')

    def test_judge_can_save_once_event_started(self):
        ev = self.make('j', self.now - self.td(minutes=10))
        entry = ev.competesin_set.first()
        self.as_user(self.judge)
        r = self.client.patch(f'/api/results/{entry.id}/', {'score': '9.99'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_judge_cannot_save_before_start(self):
        ev = self.make('j', self.now + self.td(hours=2))
        self.as_user(self.judge)
        r = self.client.patch(f'/api/results/{ev.competesin_set.first().id}/', {'score': '9.99'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_medal_table_counts_clock_finished_events(self):
        self.make('d', self.now - self.td(hours=5))
        self.assertEqual(self.client.get('/api/medals/').data[0]['gold'], 1)


class PointsTests(Base):
    """Automatic points: score -> points with a * (b - T) ** c (track) or a * (D - b) ** c (field)."""

    def live(self, event):
        event.status = 'live'
        event.save(update_fields=['status'])

    def test_default_coefficients_match_world_athletics_reference_values(self):
        men_100 = PointsTable.objects.get(event='100m', gender='Men', classification='')
        self.assertEqual(men_100.points_for(Decimal('10.395')), 1000)
        long_jump = PointsTable.objects.get(event='Long jump', gender='Men', classification='')
        self.assertEqual(long_jump.points_for(Decimal('7.76')), 1000)        # metres, table in centimetres
        self.assertEqual(men_100.points_for(Decimal('19.00')), 0)            # slower than b: no points

    def test_judge_saving_a_score_fills_in_points(self):
        r1, = self.enter(self.event, [self.a1])
        self.live(self.event)
        self.as_user(self.judge)
        r = self.client.patch(f'/api/results/{r1.id}/', {'score': '14.20'}, format='json')
        self.assertEqual(r.status_code, 200)
        r1.refresh_from_db()
        self.assertEqual(r1.point, Decimal('284'))
        self.assertTrue(self.client.get(f'/api/events/{self.event.id}/').data['points_auto'])

    def test_ranking_uses_points_so_classes_can_compete_together(self):
        # A T53 athlete gets a class-specific table, so the slower time can still score more points.
        PointsTable.objects.create(event='100m', gender='Men', classification='T53', measure='s', a=25.4347, b=22.0, c=1.81)
        self.a2.classification = 'T53'
        self.a2.save()
        fast, slow = self.enter(self.event, [self.a1, self.a2], ['14.20', '15.00'])
        self.live(self.event)
        self.as_user(self.admin)
        r = self.client.post(f'/api/events/{self.event.id}/rank/')
        self.assertEqual(r.status_code, 200)
        fast.refresh_from_db(); slow.refresh_from_db()
        self.assertGreater(slow.point, fast.point)
        self.assertEqual((slow.rank, fast.rank), (1, 2))
        self.assertIsNone(slow.medal)                                       # ranking alone gives no medal

    def test_auto_medals_rank_by_points(self):
        rows = self.enter(self.event, [self.a1, self.a2, self.a3], ['14.20', '14.35', '14.90'])
        self.live(self.event)
        self.as_user(self.admin)
        self.client.post(f'/api/events/{self.event.id}/auto-medals/')
        for r in rows: r.refresh_from_db()
        self.assertEqual([(r.rank, r.medal) for r in rows], [(1, 'gold'), (2, 'silver'), (3, 'bronze')])
        self.assertTrue(all(r.point and r.point > 0 for r in rows))

    def test_event_without_a_table_keeps_typed_points(self):
        marathon = Event.objects.create(name="Men's Marathon", date_time=WHEN, gender='Men', sport=self.track, judge=self.judge)
        r1, = self.enter(marathon, [self.a1])
        self.live(marathon)
        self.as_user(self.judge)
        self.client.patch(f'/api/results/{r1.id}/', {'score': '5400', 'point': 7}, format='json')
        r1.refresh_from_db()
        self.assertEqual(r1.point, Decimal('7'))
        self.assertFalse(self.client.get(f'/api/events/{marathon.id}/').data['points_auto'])

    def test_judge_can_only_rank_own_live_event(self):
        self.enter(self.event, [self.a1], ['14.20'])
        self.live(self.event)
        self.as_user(self.judge2)
        self.assertEqual(self.client.post(f'/api/events/{self.event.id}/rank/').status_code, 403)
        self.as_user(self.judge)
        self.assertEqual(self.client.post(f'/api/events/{self.event.id}/rank/').status_code, 200)

    def test_only_admin_can_change_coefficients(self):
        row = PointsTable.objects.first()
        self.as_user(self.judge)
        self.assertEqual(self.client.patch(f'/api/points-tables/{row.id}/', {'a': 1}, format='json').status_code, 403)
        self.as_user(None)
        self.assertEqual(self.client.get('/api/points-tables/').status_code, 200)
        self.as_user(self.admin)
        self.assertEqual(self.client.patch(f'/api/points-tables/{row.id}/', {'a': 1}, format='json').status_code, 200)
