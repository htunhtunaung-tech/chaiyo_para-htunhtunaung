from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.authtoken.models import Token
from django.db import transaction
from competitions.countries import official_country
from competitions.models import Athlete

from .models import User

# Only these roles may be chosen when registering. Admins are created with
# "python manage.py createsuperuser" or by an existing admin in /admin/.
SELF_REGISTER_ROLES = ('athlete', 'team_official', 'visitor', 'judge')   # a judge request must be approved by an admin


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'judge_status']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    role = serializers.ChoiceField(choices=[(r, r) for r in SELF_REGISTER_ROLES], default='athlete')
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=False)
    gender = serializers.ChoiceField(choices=Athlete.GENDER_CHOICES, required=False, allow_blank=True)
    classification = serializers.CharField(max_length=50, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'first_name', 'last_name',
                  'nationality', 'gender', 'classification']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # One validate() only: a second definition would silently replace this password check.
        candidate = User(username=attrs.get('username', ''), email=attrs.get('email', ''))
        validate_password(attrs['password'], user=candidate)
        if attrs.get('role', 'athlete') == 'athlete':
            if not attrs.get('nationality', '').strip():
                raise serializers.ValidationError({'nationality': 'Choose your country.'})
            country = official_country(attrs['nationality'])
            if not country:
                raise serializers.ValidationError({'nationality': 'Choose a country from the list of Paralympic delegations.'})
            attrs['nationality'] = country          # always store the official name, e.g. "THA" -> "Thailand"
            if not attrs.get('first_name', '').strip() or not attrs.get('last_name', '').strip():
                raise serializers.ValidationError({'first_name': 'Enter your first and last name to create your athlete profile.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        wants_judge = validated_data['role'] == 'judge'
        first_name = validated_data.pop('first_name', '').strip()
        last_name = validated_data.pop('last_name', '').strip()
        nationality = validated_data.pop('nationality', '').strip()
        gender = validated_data.pop('gender', '')
        classification = validated_data.pop('classification', '').strip()
        requested_role = validated_data.pop('role', 'athlete')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=first_name, last_name=last_name,
            # A judge request never gives judge powers directly.
            role='visitor' if wants_judge else requested_role,
            judge_status='pending' if wants_judge else '',
        )
        if requested_role == 'athlete':
            # Athlete and account are created together; the one-to-one user link keeps this
            # profile out of duplicate/unlinked athlete rows and associates it with Users & Roles.
            Athlete.objects.create(first_name=first_name, last_name=last_name, country=nationality,
                                   gender=gender, classification=classification, user=user)
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """Used by admins only (/api/auth/users/): see and edit every account on the website."""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True,
                                     style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'judge_status',
                  'is_active', 'is_superuser', 'last_login', 'date_joined', 'password']
        read_only_fields = ['id', 'judge_status', 'is_superuser', 'last_login', 'date_joined']

    def _other_active_admins(self, instance):
        qs = User.objects.filter(role='admin', is_active=True)
        return qs.exclude(pk=instance.pk).exists() if instance else True

    def validate(self, attrs):
        inst = self.instance
        request = self.context.get('request')
        if inst is None:      # creating: a password is required
            if not attrs.get('password'):
                raise serializers.ValidationError({'password': 'Enter a password for the new account.'})
        else:
            new_role = attrs.get('role', inst.role)
            new_active = attrs.get('is_active', inst.is_active)
            if inst.is_superuser and new_role != 'admin':
                raise serializers.ValidationError({'role': 'This account is a Django superuser, so it always stays an administrator.'})
            if request is not None and inst.pk == request.user.pk:
                if new_role != 'admin':
                    raise serializers.ValidationError({'role': 'You cannot remove your own admin role.'})
                if not new_active:
                    raise serializers.ValidationError({'is_active': 'You cannot lock your own account.'})
            if inst.role == 'admin' and (new_role != 'admin' or not new_active) and not self._other_active_admins(inst):
                raise serializers.ValidationError('There must always be at least one active administrator.')
        if attrs.get('password'):
            candidate = inst or User(username=attrs.get('username', ''), email=attrs.get('email', ''))
            validate_password(attrs['password'], user=candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role', 'visitor')
        user = User(**validated_data)
        user.set_password(password)
        if role == 'admin':          # administrators can open /admin/ too
            user.is_staff = True
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', '')
        old_role, old_active = instance.role, instance.is_active
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if instance.role != 'judge' and instance.judge_status == 'approved':
            instance.judge_status = ''            # no longer a judge
        if instance.role == 'judge':
            instance.judge_status = 'approved'
        if instance.role == 'admin' and not instance.is_staff:
            instance.is_staff = True
        if password:
            instance.set_password(password)
        instance.save()
        # A locked account or a new password signs the person out everywhere.
        if password or (old_active and not instance.is_active):
            Token.objects.filter(user=instance).delete()
        return instance
