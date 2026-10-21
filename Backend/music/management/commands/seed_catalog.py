import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from music.models import Song


class Command(BaseCommand):
    help = "Carga las 60 canciones hasta 2013 sin duplicar canciones ni borrar gustos."

    def handle(self, *args, **options):
        source = Path(__file__).resolve().parents[2] / "data" / "catalog.json"
        try:
            data = json.loads(source.read_text(encoding="utf-8"))
            songs = data["songs"]
        except (OSError, ValueError, KeyError) as exc:
            raise CommandError(f"No se pudo leer el catálogo: {exc}") from exc
        if len(songs) != 60 or len({song["key"] for song in songs}) != 60:
            raise CommandError("El catálogo debe contener exactamente 60 canciones distintas.")
        created_count = 0
        existing_sources = dict(Song.objects.values_list("key", "source_url"))
        with transaction.atomic():
            for entry in songs:
                fields = {name: entry[name] for name in (
                    "title", "artist", "album", "year", "tags", "art_color", "source_url"
                )}
                if entry["key"] in existing_sources and existing_sources[entry["key"]] != fields["source_url"]:
                    fields.update({
                        "preview_embed_url": "",
                        "preview_source_url": "",
                        "preview_lookup_done": False,
                    })
                candidate = Song(key=entry["key"], **fields)
                candidate.full_clean(validate_unique=False, validate_constraints=False)
                _, created = Song.objects.update_or_create(key=entry["key"], defaults=fields)
                created_count += int(created)
        self.stdout.write(self.style.SUCCESS(
            f"Catálogo listo: 60 canciones; {created_count} nuevas. Gustos conservados."
        ))
