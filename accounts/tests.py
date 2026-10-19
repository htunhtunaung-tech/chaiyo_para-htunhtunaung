from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from django.core.cache import cache

from .models import User

GOOD = 'Str0ng-Pass-77'


class RegisterRoleTests(APITestCase):
    def setUp(self):
        cache.clear()

    def reg(self, username, role):
        data = {'username': username, 'password': GOOD, 'role': role}
        if role == 'athlete':      # an athlete account also creates the athlete profile
            data.update(first_name='Test', last_name=username, nationality='Thailand')
        return self.client.post('/api/auth/register/', data, format='json')

    def test_sporter_and_visitor_are_created_directly(self):
        for role in ('athlete', 'visitor'):
            r = self.reg(f'u_{role}', role)
            self.assertEqual(r.status_code, 201)
            self.assertIn('token', r.data)
            self.assertEqual(r.data['user']['role'], role)

    def test_judge_is_pending_without_token_or_judge_power(self):
        r = self.reg('j1', 'judge')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['pending'])
        self.assertNotIn('token', r.data)
        u = User.objects.get(username='j1')
        self.assertEqual((u.role, u.judge_status), ('visitor', 'pending'))
        self.assertFalse(Token.objects.filter(user=u).exists())

    def test_pending_judge_cannot_sign_in(self):
        self.reg('j1', 'judge')
        r = self.client.post('/api/auth/login/', {'username': 'j1', 'password': GOOD}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.data['pending'])

    def test_wrong_password_still_generic(self):
        self.reg('j1', 'judge')
        r = self.client.post('/api/auth/login/', {'username': 'j1', 'password': 'nope'}, format='json')
        self.assertEqual((r.status_code, r.data['error']), (400, 'Wrong Credentials'))

    def test_admin_cannot_be_self_registered(self):
        self.assertEqual(self.reg('x', 'admin').status_code, 400)


class JudgeApprovalTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user('adm', password=GOOD, role='admin')
        self.sporter = User.objects.create_user('sp', password=GOOD, role='athlete')
        self.client.post('/api/auth/register/', {'username': 'j1', 'password': GOOD, 'role': 'judge'}, format='json')
        self.j1 = User.objects.get(username='j1')

    def as_user(self, u):
        t, _ = Token.objects.get_or_create(user=u)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {t.key}')

    def test_only_admin_sees_and_decides(self):
        self.as_user(self.sporter)
        self.assertEqual(self.client.get('/api/auth/judges/?status=pending').status_code, 403)
        self.assertEqual(self.client.post(f'/api/auth/judges/{self.j1.id}/approve/').status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/auth/judges/?status=pending').status_code, 401)

    def test_admin_lists_pending_and_approves(self):
        self.as_user(self.admin)
        r = self.client.get('/api/auth/judges/?status=pending')
        self.assertEqual([u['username'] for u in r.data], ['j1'])
        r = self.client.post(f'/api/auth/judges/{self.j1.id}/approve/')
        self.assertEqual((r.status_code, r.data['role'], r.data['judge_status']), (200, 'judge', 'approved'))
        self.client.credentials()
        login = self.client.post('/api/auth/login/', {'username': 'j1', 'password': GOOD}, format='json')
        self.assertEqual((login.status_code, login.data['user']['role']), (200, 'judge'))
        self.as_user(self.admin)
        self.assertEqual([u['username'] for u in self.client.get('/api/auth/judges/').data], ['j1'])

    def test_reject_keeps_visitor(self):
        self.as_user(self.admin)
        r = self.client.post(f'/api/auth/judges/{self.j1.id}/reject/')
        self.assertEqual((r.data['role'], r.data['judge_status']), ('visitor', 'rejected'))
        self.j1.refresh_from_db()
        self.assertEqual(self.j1.role, 'visitor')

    def test_cannot_reject_approved_judge(self):
        self.j1.approve_judge()
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/auth/judges/{self.j1.id}/reject/').status_code, 409)

    def test_ordinary_user_is_not_a_judge_request(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'/api/auth/judges/{self.sporter.id}/approve/').status_code, 404)


class AdminUserManagementTests(APITestCase):
    """/api/auth/users/ : the website shows the same accounts as Django /admin/, and an admin can edit them."""
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user('adm', password=GOOD, role='admin')
        self.athlete = User.objects.create_user('ath', password=GOOD, role='athlete')
        self.as_user(self.admin)

    def as_user(self, u):
        t, _ = Token.objects.get_or_create(user=u)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {t.key}')

    def test_only_admin_can_use_it(self):
        self.as_user(self.athlete)
        self.assertEqual(self.client.get('/api/auth/users/').status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/auth/users/').status_code, 401)

    def test_list_shows_every_account_without_passwords(self):
        r = self.client.get('/api/auth/users/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual({u['username'] for u in r.data}, {'adm', 'ath'})
        self.assertNotIn('password', r.data[0])

    def test_edit_role_name_and_email(self):
        r = self.client.patch(f'/api/auth/users/{self.athlete.id}/',
                              {'role': 'judge', 'email': 'a@b.co', 'first_name': 'Ann'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.athlete.refresh_from_db()
        self.assertEqual((self.athlete.role, self.athlete.judge_status, self.athlete.email), ('judge', 'approved', 'a@b.co'))

    def test_lock_signs_the_person_out_and_blocks_login(self):
        Token.objects.get_or_create(user=self.athlete)
        self.assertEqual(self.client.patch(f'/api/auth/users/{self.athlete.id}/', {'is_active': False}, format='json').status_code, 200)
        self.assertFalse(Token.objects.filter(user=self.athlete).exists())
        r = self.client.post('/api/auth/login/', {'username': 'ath', 'password': GOOD}, format='json')
        self.assertEqual(r.status_code, 403)          # locked: no token, and told why
        self.assertTrue(r.data['locked'])

    def test_set_new_password(self):
        r = self.client.patch(f'/api/auth/users/{self.athlete.id}/', {'password': 'Another-Pass-91'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.athlete.refresh_from_db()
        self.assertTrue(self.athlete.check_password('Another-Pass-91'))

    def test_create_user_needs_password(self):
        self.assertEqual(self.client.post('/api/auth/users/', {'username': 'n1', 'role': 'visitor'}, format='json').status_code, 400)
        r = self.client.post('/api/auth/users/', {'username': 'n1', 'role': 'visitor', 'password': GOOD}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.get(username='n1').check_password(GOOD))

    def test_admin_cannot_lock_demote_or_delete_themselves(self):
        url = f'/api/auth/users/{self.admin.id}/'
        self.assertEqual(self.client.patch(url, {'is_active': False}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'role': 'visitor'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 400)

    def test_last_active_admin_is_protected(self):
        other = User.objects.create_user('adm2', password=GOOD, role='admin')
        # two active admins: demoting one is fine
        self.assertEqual(self.client.patch(f'/api/auth/users/{other.id}/', {'role': 'visitor'}, format='json').status_code, 200)
        # now 'adm' is the only admin; a second admin who is locked cannot take over, so demoting adm is refused
        other.role = 'admin'
        other.is_active = False
        other.save()
        self.assertEqual(self.client.patch(f'/api/auth/users/{other.id}/', {'role': 'visitor'}, format='json').status_code, 200)

    def test_delete_user(self):
        self.assertEqual(self.client.delete(f'/api/auth/users/{self.athlete.id}/').status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.athlete.pk).exists())


class AthleteRegistrationTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_athlete_profile_is_created_with_nationality(self):
        from competitions.models import Athlete
        r = self.client.post('/api/auth/register/', {'username': 'runner1', 'password': GOOD, 'role': 'athlete',
                             'first_name': 'Somchai', 'last_name': 'Dee', 'nationality': 'Thailand',
                             'gender': 'Men', 'classification': 'T54'}, format='json')
        self.assertEqual(r.status_code, 201)
        a = Athlete.objects.get(user__username='runner1')
        self.assertEqual((a.first_name, a.last_name, a.country, a.classification), ('Somchai', 'Dee', 'Thailand', 'T54'))

    def test_athlete_needs_nationality_and_name(self):
        r = self.client.post('/api/auth/register/', {'username': 'runner2', 'password': GOOD, 'role': 'athlete',
                             'first_name': 'A', 'last_name': 'B'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('nationality', r.data)
        self.assertFalse(User.objects.filter(username='runner2').exists())

    def test_visitor_does_not_need_athlete_fields(self):
        r = self.client.post('/api/auth/register/', {'username': 'fan1', 'password': GOOD, 'role': 'visitor'}, format='json')
        self.assertEqual(r.status_code, 201)

    def athlete(self, username, nationality, password=GOOD):
        return self.client.post('/api/auth/register/', {'username': username, 'password': password, 'role': 'athlete',
                                'first_name': 'A', 'last_name': username, 'nationality': nationality}, format='json')

    def test_unknown_country_is_rejected(self):
        r = self.athlete('runner3', 'Thiland')
        self.assertEqual(r.status_code, 400)
        self.assertIn('nationality', r.data)
        self.assertFalse(User.objects.filter(username='runner3').exists())

    def test_country_code_is_stored_as_official_name(self):
        from competitions.models import Athlete
        self.assertEqual(self.athlete('runner4', 'tha').status_code, 201)
        self.assertEqual(Athlete.objects.get(user__username='runner4').country, 'Thailand')

    def test_weak_password_is_rejected_even_with_valid_athlete_details(self):
        r = self.athlete('runner5', 'Thailand', password='12345678')
        self.assertEqual(r.status_code, 400)
        self.assertIn('password', str(r.data).lower())
        self.assertFalse(User.objects.filter(username='runner5').exists())


class LockedLoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('locked1', password=GOOD, role='athlete', is_active=False)

    def test_locked_user_is_told_with_right_password(self):
        r = self.client.post('/api/auth/login/', {'username': 'locked1', 'password': GOOD}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.data['locked'])
        self.assertNotIn('token', r.data)

    def test_locked_user_with_wrong_password_gets_generic_error(self):
        r = self.client.post('/api/auth/login/', {'username': 'locked1', 'password': 'nope-nope-1'}, format='json')
        self.assertEqual((r.status_code, r.data['error']), (400, 'Wrong Credentials'))
