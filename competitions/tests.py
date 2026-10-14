from datetime import datetime, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Sport, Athlete, Event, CompetesIn

User = get_user_model()
WHEN = datetime(2026, 10, 11, 9, 0, tzinfo=timezone.utc)


class Base(APITestCase):
    def setUp(self):
        cache.clear()                                   # reset rate limits between tests
        self.admin = User.objects.create_user('admin', password='pw-Admin-123', role='admin')
        self.judge = User.objects.create_user('judge', password='pw-Judge-123', role='judge')
        self.judge2 = User.objects.create_user('judge2', password='pw-Judge-123', role='judge')
        self.sporter = User.objects.create_user('sporter', password='pw-Sport-123', role='sporter')
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

    def test_register_sporter_and_judge(self):
        for role in ('sporter', 'judge'):
            r = self.client.post('/api/auth/register/', {'username': f'new-{role}', 'password': 'Str0ng-pass-99', 'role': role})
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
        Event.objects.create(name="Women's HJ", date_time=datetime(2026, 10, 12, 9, tzinfo=timezone.utc),
                             gender='Women', sport=self.field)
        names = lambda q: [e['name'] for e in self.client.get('/api/events/' + q).json()]
        self.assertEqual(names('?sport_type=Field'), ["Women's HJ"])
        self.assertEqual(names('?gender=men'), ["Men's 100m"])
        self.assertEqual(names('?date=2026-10-12'), ["Women's HJ"])
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
    EVENT = {'name': 'New', 'date_time': '2026-10-15T09:00:00Z', 'gender': 'Men'}

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
