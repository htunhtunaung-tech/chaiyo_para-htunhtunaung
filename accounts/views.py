from django.contrib.auth import authenticate
from django.db.models import Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from competitions.permissions import IsAdmin
from .serializers import AdminUserSerializer, RegisterSerializer, UserSerializer


class RegisterAPIView(APIView):
    """POST /api/auth/register/  - sporter/visitor: account + token right away.
    judge: account is created as 'pending' (no token); an admin must approve it first."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'auth'

    @extend_schema(request=RegisterSerializer, responses={201: dict})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if user.judge_status == 'pending':
            return Response({'user': UserSerializer(user).data, 'pending': True,
                             'message': 'Your judge account is pending. An admin must approve it before you can sign in.'},
                            status=status.HTTP_201_CREATED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'user': UserSerializer(user).data, 'token': token.key},
                        status=status.HTTP_201_CREATED)


class LoginAPIView(APIView):
    """POST /api/auth/login/  - returns a token."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'auth'

    @extend_schema(request=inline_serializer('LoginInput', {'username': serializers.CharField(), 'password': serializers.CharField()}),
                   responses={200: dict})
    def post(self, request):
        user = authenticate(username=request.data.get('username'),
                            password=request.data.get('password'))
        if user is None:
            # A locked account (is_active=False) also lands here. Say so, but only to someone who
            # knows the right password, so this never reveals which usernames exist.
            locked = User.objects.filter(username=request.data.get('username'), is_active=False).first()
            if locked and locked.check_password(request.data.get('password') or ''):
                return Response({'error': 'This account is locked. Please contact an admin.', 'locked': True},
                                status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Wrong Credentials'}, status=status.HTTP_400_BAD_REQUEST)
        if user.judge_status == 'pending':      # right password, but an admin has not approved the judge request yet
            return Response({'error': 'Your judge account is pending. An admin must approve it first.',
                             'pending': True}, status=status.HTTP_403_FORBIDDEN)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'user': UserSerializer(user).data, 'token': token.key})


class LogoutAPIView(APIView):
    """POST /api/auth/logout/  - deletes the caller's token."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'message': 'Logged out successfully'})


class MeAPIView(APIView):
    """GET /api/auth/me/  - username and role of the logged-in user."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class JudgeListView(APIView):
    """GET /api/auth/judges/?status=pending|approved|rejected  (admin) - approved judges by default."""
    permission_classes = [IsAdmin]

    @extend_schema(responses=UserSerializer(many=True))
    def get(self, request):
        wanted = request.query_params.get('status', 'approved')
        qs = User.objects.filter(role='judge') if wanted == 'approved' else User.objects.filter(judge_status=wanted)
        return Response(UserSerializer(qs.order_by('username'), many=True).data)


class JudgeDecisionView(APIView):
    """POST /api/auth/judges/<id>/approve/ or /reject/  (admin only)."""
    permission_classes = [IsAdmin]
    decision = 'approve'

    @extend_schema(request=None, responses=UserSerializer)
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, judge_status__in=['pending', 'rejected', 'approved'])
        if self.decision == 'approve':
            user.approve_judge()
        else:
            if user.judge_status == 'approved':
                return Response({'detail': 'This judge is already approved.'}, status=status.HTTP_409_CONFLICT)
            user.reject_judge()
        return Response(UserSerializer(user).data)


class AdminUserViewSet(viewsets.ModelViewSet):
    """/api/auth/users/  (admin only) - every account on the website, the same ones as in Django /admin/.
    GET list (?role=, ?status=active|locked|pending, ?search=), POST create, GET/PATCH/DELETE one account."""
    permission_classes = [IsAdmin]
    serializer_class = AdminUserSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = User.objects.all().order_by('username')
        p = self.request.query_params
        if p.get('role'):
            qs = qs.filter(role=p['role'])
        status_ = p.get('status')
        if status_ == 'active':
            qs = qs.filter(is_active=True)
        elif status_ == 'locked':
            qs = qs.filter(is_active=False)
        elif status_ == 'pending':
            qs = qs.filter(judge_status='pending')
        q = (p.get('search') or '').strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) |
                           Q(first_name__icontains=q) | Q(last_name__icontains=q))
        return qs

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({'detail': 'You cannot delete your own account.'})
        if instance.role == 'admin' and not User.objects.filter(role='admin', is_active=True).exclude(pk=instance.pk).exists():
            raise ValidationError({'detail': 'There must always be at least one active administrator.'})
        instance.delete()
