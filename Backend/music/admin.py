from django.contrib import admin

from .models import Song


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "album", "year")
    list_filter = ("artist", "year")
    search_fields = ("title", "artist", "album")


admin.site.site_header = "ValleNofy · Catálogo"
admin.site.site_title = "ValleNofy"
