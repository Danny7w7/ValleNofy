from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("music", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="song",
            name="preview_embed_url",
            field=models.URLField(blank=True, default="", max_length=500, verbose_name="reproductor Apple Music"),
        ),
        migrations.AddField(
            model_name="song",
            name="preview_source_url",
            field=models.URLField(blank=True, default="", max_length=500, verbose_name="canción en Apple Music"),
        ),
        migrations.AddField(
            model_name="song",
            name="preview_lookup_done",
            field=models.BooleanField(default=False),
        ),
    ]
