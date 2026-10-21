from django.contrib import admin
from django.urls import include, path, re_path

from music.views import frontend

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("music.urls")),
    re_path(r"^(?!api(?:/|$)|admin(?:/|$)|assets(?:/|$)).*$", frontend),
]
