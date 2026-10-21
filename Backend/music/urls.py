from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health),
    path("profile/", views.profile),
    path("songs/", views.songs),
    path("songs/search/", views.search_songs),
    path("songs/<int:song_id>/preview/", views.song_preview),
    path("onboarding/", views.onboarding),
    path("recommendations/", views.recommendations),
    path("reactions/<int:song_id>/", views.react),
    path("library/", views.library),
]
