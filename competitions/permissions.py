from rest_framework.permissions import BasePermission, SAFE_METHODS


def _role(request):
    user = request.user
    return user.role if user and user.is_authenticated else None


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == 'admin'


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return _role(request) == 'admin'


class IsAdminOrJudge(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in ('admin', 'judge')
