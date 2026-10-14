from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User

# Only these roles may be chosen when registering. Admins are created with
# "python manage.py createsuperuser" or by an existing admin in /admin/.
SELF_REGISTER_ROLES = ('sporter', 'judge')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    role = serializers.ChoiceField(choices=[(r, r) for r in SELF_REGISTER_ROLES], default='sporter')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role']

    def validate(self, attrs):
        candidate = User(username=attrs.get('username', ''), email=attrs.get('email', ''))
        validate_password(attrs['password'], user=candidate)
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data['role'],
        )
