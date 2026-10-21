import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Song(models.Model):
    key = models.SlugField(max_length=180, unique=True)
    apple_track_id = models.CharField(max_length=32, unique=True, null=True, blank=True)
    is_recommendable = models.BooleanField(default=True, db_index=True)
    title = models.CharField("canción", max_length=180)
    artist = models.CharField("intérprete", max_length=160, db_index=True)
    album = models.CharField("álbum", max_length=180)
    year = models.PositiveSmallIntegerField(
        "año", validators=[MinValueValidator(1900), MaxValueValidator(2013)]
    )
    genre = models.CharField("género", max_length=100, blank=True, default="")
    tags = models.JSONField("etiquetas", default=list)
    art_color = models.CharField("color", max_length=7, default="#d98245")
    source_url = models.URLField("fuente del catálogo", max_length=500)
    preview_embed_url = models.URLField("reproductor Apple Music", max_length=500, blank=True, default="")
    preview_source_url = models.URLField("canción en Apple Music", max_length=500, blank=True, default="")
    preview_lookup_done = models.BooleanField(default=False)

    class Meta:
        ordering = ["artist", "title", "id"]
        constraints = [models.CheckConstraint(
            condition=models.Q(year__gte=1900, year__lte=2013), name="song_year_up_to_2013"
        )]
        verbose_name = "canción"
        verbose_name_plural = "canciones"

    def clean(self):
        if not isinstance(self.tags, list) or not self.tags or any(
            not isinstance(tag, str) or not tag.strip() for tag in self.tags
        ):
            raise ValidationError({"tags": "Usa una lista con etiquetas musicales no vacías."})

    def __str__(self):
        return f"{self.title} — {self.artist}"


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeds = models.ManyToManyField(Song, related_name="initial_profiles", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Reaction(models.Model):
    class Kind(models.TextChoices):
        LIKE = "like", "Esa canción me da sed"
        LOVE = "love", "¡Sírvelooo!"
        DISLIKE = "dislike", "Paso, compae"

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="reactions")
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name="reactions")
    reaction = models.CharField(max_length=8, choices=Kind.choices)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["profile", "song"], name="one_reaction_per_profile_song"
        )]
        ordering = ["-updated_at", "-id"]
