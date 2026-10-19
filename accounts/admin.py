from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (('Role', {'fields': ('role', 'judge_status')}),)
    add_fieldsets = UserAdmin.add_fieldsets + (('Role', {'fields': ('role', 'judge_status')}),)
    list_display = ('username', 'email', 'role', 'judge_status', 'is_staff')
    list_filter = UserAdmin.list_filter + ('role', 'judge_status')
    actions = ['approve_judges', 'reject_judges']

    @admin.action(description='Approve selected judge requests')
    def approve_judges(self, request, queryset):
        for u in queryset.filter(judge_status='pending'):
            u.approve_judge()

    @admin.action(description='Reject selected judge requests')
    def reject_judges(self, request, queryset):
        for u in queryset.filter(judge_status='pending'):
            u.reject_judge()
