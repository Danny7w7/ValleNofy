from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("music", "0002_song_preview_embed")]

    operations = [
        migrations.AddField(
            model_name="song",
            name="apple_track_id",
            field=models.CharField(blank=True, max_length=32, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="song",
            name="is_recommendable",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="song",
            name="genre",
            field=models.CharField(blank=True, default="", max_length=100, verbose_name="género"),
        ),
    ]
