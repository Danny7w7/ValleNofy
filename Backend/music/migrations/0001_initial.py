import uuid

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Song",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=180, unique=True)),
                ("title", models.CharField(max_length=180, verbose_name="canción")),
                ("artist", models.CharField(db_index=True, max_length=160, verbose_name="intérprete")),
                ("album", models.CharField(max_length=180, verbose_name="álbum")),
                ("year", models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1900), django.core.validators.MaxValueValidator(2013)], verbose_name="año")),
                ("tags", models.JSONField(default=list, verbose_name="etiquetas")),
                ("art_color", models.CharField(default="#d98245", max_length=7, verbose_name="color")),
                ("source_url", models.URLField(max_length=500, verbose_name="fuente del catálogo")),
            ],
            options={
                "verbose_name": "canción", "verbose_name_plural": "canciones",
                "ordering": ["artist", "title", "id"],
                "constraints": [models.CheckConstraint(condition=models.Q(year__gte=1900, year__lte=2013), name="song_year_up_to_2013")],
            },
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("seeds", models.ManyToManyField(blank=True, related_name="initial_profiles", to="music.song")),
            ],
        ),
        migrations.CreateModel(
            name="Reaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reaction", models.CharField(choices=[("like", "Esa canción me da sed"), ("love", "¡Sírvelooo!"), ("dislike", "Paso, compae")], max_length=8)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reactions", to="music.profile")),
                ("song", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reactions", to="music.song")),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
                "constraints": [models.UniqueConstraint(fields=("profile", "song"), name="one_reaction_per_profile_song")],
            },
        ),
    ]
