from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ChatView,
    ChatHistoryView,
    TaskViewSet,
    NoteViewSet,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='assistant-task')
router.register(r'notes', NoteViewSet, basename='assistant-note')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('chat/', ChatView.as_view(), name='assistant-chat'),
    path('chat/history/', ChatHistoryView.as_view(), name='assistant-chat-history'),
    path('', include(router.urls)),
]
