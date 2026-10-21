import hashlib
import json
import re
import uuid
from functools import wraps
from urllib.error import URLError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Profile, Reaction, Song
from .recommender import normalized, recommend


class ApiError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def response(data, status=200):
    result = JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False})
    result["Cache-Control"] = "no-store"
    return result


def api(*methods):
    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                result = response({"error": "Método no permitido."}, 405)
                result["Allow"] = ", ".join(methods)
                return result
            try:
                return view(request, *args, **kwargs)
            except ApiError as error:
                return response({"error": error.message}, error.status)
        return wrapped
    return decorate


def payload(request):
    if len(request.body) > 8192:
        raise ApiError("La solicitud es demasiado grande.")
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ApiError("Envía un objeto JSON válido.")
    if not isinstance(data, dict):
        raise ApiError("Envía un objeto JSON válido.")
    return data


def current_profile(request):
    identifier = request.session.get("profile_id")
    profile = None
    if identifier:
        try:
            profile = Profile.objects.filter(id=uuid.UUID(identifier)).first()
        except (ValueError, TypeError, AttributeError):
            pass
    if profile is None:
        profile = Profile.objects.create()
        request.session["profile_id"] = str(profile.id)
    return profile


def profile_data(profile):
    seed_ids = list(profile.seeds.values_list("id", flat=True))
    reactions = list(profile.reactions.values_list("reaction", flat=True))
    stats = {
        "liked": reactions.count("like"), "loved": reactions.count("love"),
        "disliked": reactions.count("dislike"), "total": len(reactions),
    }
    return {
        "id": str(profile.id), "onboarded": len(seed_ids) == 5 and bool(stats["liked"] + stats["loved"]),
        "seed_ids": seed_ids, "stats": stats,
    }


def song_data(song):
    query = quote(f"{song.title} {song.artist}", safe="")
    is_apple = not song.is_recommendable
    selection_key = f"apple:{song.apple_track_id}" if is_apple else f"catalog:{song.id}"
    return {
        "id": song.id, "title": song.title, "artist": song.artist,
        "album": song.album, "year": song.year, "decade": song.year // 10 * 10,
        "tags": song.tags, "genre": song.genre, "art_color": song.art_color,
        "source": "apple" if is_apple else "catalog",
        "selection_key": selection_key,
        "apple_track_id": song.apple_track_id or "",
        "source_url": song.source_url,
        **({
            "preview_embed_url": song.preview_embed_url,
            "preview_source_url": song.preview_source_url or song.source_url,
        } if is_apple else {}),
        "youtube_url": f"https://www.youtube.com/results?search_query={query}",
        "spotify_url": f"https://open.spotify.com/search/{query}",
    }


@api("GET")
def health(request):
    instance = hashlib.sha256(str(settings.PROJECT_DIR).encode("utf-8")).hexdigest()[:16]
    return response({"app": "vallenofy", "status": "ok", "instance": instance})


@ensure_csrf_cookie
@api("GET")
def profile(request):
    return response(profile_data(current_profile(request)))


@api("POST")
def reset_profile(request):
    user = current_profile(request)
    with transaction.atomic():
        user.reactions.all().delete()
        user.seeds.clear()
    return response(profile_data(user))


def matching_catalog_songs(raw_query, artist):
    query = normalized(raw_query)
    all_songs = list(Song.objects.filter(is_recommendable=True))
    filtered = [song for song in all_songs if (
        (not artist or song.artist == artist) and
        (not query or query in normalized(f"{song.title} {song.artist} {song.album}"))
    )]
    return all_songs, filtered


@api("GET")
def songs(request):
    raw_query = request.GET.get("q", "")[:180].strip()
    artist = request.GET.get("artist", "")[:160].strip()
    all_songs, filtered = matching_catalog_songs(raw_query, artist)
    return response({
        "songs": [song_data(song) for song in filtered],
        "artists": sorted({song.artist for song in all_songs}, key=lambda name: name.casefold()),
    })


@api("GET")
def search_songs(request):
    raw_query = request.GET.get("q", "")[:180].strip()
    artist = request.GET.get("artist", "")[:160].strip()
    all_songs, filtered = matching_catalog_songs(raw_query, artist)
    results = [song_data(song) for song in filtered]
    local_exact = {
        normalized(f"{song.title} {song.artist}"): result
        for song, result in zip(filtered, results)
    }
    apple_results = []
    apple_error = ""
    apple_excluded_count = 0
    search_term = " ".join(part for part in (raw_query, artist) if part)
    if len(search_term) >= 2:
        try:
            apple_payload = apple_api_json("/search", {
                "term": search_term, "entity": "song", "country": "co", "limit": "25",
            }, "No pudimos buscar canciones en Apple Music.")
            known_apple_ids = set(Song.objects.filter(
                apple_track_id__isnull=False
            ).values_list("apple_track_id", flat=True))
            seen_apple_ids = set()
            for track in apple_result_list(apple_payload, "Apple Music devolvió una búsqueda no válida."):
                if not isinstance(track, dict) or track.get("wrapperType") != "track":
                    continue
                track_id = apple_track_id(track)
                year = apple_release_year(track)
                if not track_id or year is None or not 1900 <= year <= 2013:
                    apple_excluded_count += 1
                    continue
                title = str(track.get("trackName") or "").strip()
                performer = str(track.get("artistName") or "").strip()
                track_url = track.get("trackViewUrl", "")
                if not title or not performer or not valid_apple_track_url(track_url):
                    apple_excluded_count += 1
                    continue
                if track_id in seen_apple_ids:
                    continue
                seen_apple_ids.add(track_id)
                genre = str(track.get("primaryGenreName") or "")[:100]
                embed_url = apple_embed_url(track_url, track_id)
                saved = None
                if track_id in known_apple_ids:
                    saved = Song.objects.filter(apple_track_id=track_id).first()
                exact_local = local_exact.get(normalized(f"{title} {performer}"))
                if exact_local is not None:
                    if saved is not None:
                        exact_local.clear()
                        exact_local.update(song_data(saved))
                    else:
                        exact_local["genre"] = genre or exact_local.get("genre", "")
                    if embed_url:
                        exact_local["preview_embed_url"] = embed_url
                        exact_local["preview_source_url"] = track_url
                    continue

                if saved is not None:
                    item = song_data(saved)
                    item["genre"] = genre or item["genre"]
                    if embed_url:
                        item["preview_embed_url"] = embed_url
                        item["preview_source_url"] = track_url
                else:
                    item = apple_search_song_data(track, track_id, year, genre, embed_url)
                apple_results.append(item)
        except ApiError as error:
            apple_error = error.message

    artists = {song.artist for song in all_songs}
    artists.update(item["artist"] for item in (*apple_results, *results))
    return response({
        "songs": [*apple_results, *results],
        "artists": sorted(artists, key=lambda name: name.casefold()),
        "apple_error": apple_error,
        "apple_excluded_count": apple_excluded_count,
    })


def apple_api_json(endpoint, parameters, error_message):
    url = "https://itunes.apple.com" + endpoint + "?" + urlencode(parameters)
    apple_request = Request(url, headers={"User-Agent": "ValleNofy/1.0"})
    try:
        with urlopen(apple_request, timeout=8) as result:
            payload = json.load(result)
    except (OSError, TimeoutError, ValueError, URLError) as exc:
        raise ApiError(error_message, 502) from exc
    if not isinstance(payload, dict):
        raise ApiError(error_message, 502)
    return payload


def apple_result_list(payload, error_message):
    results = payload.get("results")
    if not isinstance(results, list):
        raise ApiError(error_message, 502)
    return results


def apple_track_id(track):
    value = track.get("trackId")
    if isinstance(value, int) and not isinstance(value, bool) and 0 < value < 10 ** 32:
        return str(value)
    if isinstance(value, str) and value.isdecimal() and len(value) <= 32:
        return value
    return ""


def apple_release_year(track):
    release_date = track.get("releaseDate")
    if not isinstance(release_date, str) or len(release_date) < 4:
        return None
    try:
        return int(release_date[:4])
    except ValueError:
        return None


def valid_apple_track_url(value):
    try:
        source = urlsplit(value)
    except (TypeError, ValueError):
        return False
    return (
        source.scheme == "https"
        and source.hostname in {"music.apple.com", "itunes.apple.com"}
        and bool(source.path)
    )


def apple_embed_url(track_url, track_id):
    try:
        source = urlsplit(track_url)
    except (TypeError, ValueError):
        return ""
    if (
        source.scheme != "https" or source.hostname != "music.apple.com"
        or "/album/" not in source.path or not str(track_id).isdecimal()
    ):
        return ""
    return urlunsplit((
        "https", "embed.music.apple.com", source.path,
        urlencode({"i": str(track_id)}), "",
    ))


def apple_search_song_data(track, track_id, year, genre, embed_url):
    title = str(track.get("trackName") or "").strip()[:180]
    artist = str(track.get("artistName") or "").strip()[:160]
    album = str(track.get("collectionName") or "Sencillo").strip()[:180] or "Sencillo"
    track_url = track.get("trackViewUrl", "")
    query = quote(f"{title} {artist}", safe="")
    return {
        "id": f"apple:{track_id}",
        "apple_track_id": track_id,
        "selection_key": f"apple:{track_id}",
        "source": "apple",
        "title": title,
        "artist": artist,
        "album": album,
        "year": year,
        "decade": year // 10 * 10,
        "genre": genre,
        "tags": ["vallenato"],
        "art_color": "#d98245",
        "source_url": track_url,
        "preview_embed_url": embed_url,
        "preview_source_url": track_url,
        "youtube_url": f"https://www.youtube.com/results?search_query={query}",
        "spotify_url": f"https://open.spotify.com/search/{query}",
    }


def apple_track_embed(song):
    source = urlsplit(song.source_url)
    album_id_match = re.search(r"/album/[^/]+/(\d+)(?:/|$)", source.path)
    if source.scheme != "https" or source.hostname != "music.apple.com" or not album_id_match:
        return None

    album_id = album_id_match.group(1)
    target_title = re.sub(r"[^a-z0-9]+", "", normalized(song.title))
    for storefront in ("co", "us"):
        payload = apple_api_json("/lookup", {
            "id": album_id, "entity": "song", "country": storefront,
        }, "No pudimos conectar con Apple Music para cargar el reproductor.")

        match = next((track for track in apple_result_list(
                          payload, "Apple Music devolvió una respuesta no válida."
                      )
                      if isinstance(track, dict) and track.get("wrapperType") == "track"
                      and re.sub(r"[^a-z0-9]+", "", normalized(str(track.get("trackName") or ""))) == target_title), None)
        if match:
            track_url = match.get("trackViewUrl", "")
            track_id = apple_track_id(match)
            embed_url = apple_embed_url(track_url, track_id)
            if embed_url and valid_apple_track_url(track_url):
                return embed_url, track_url
    return None


@api("GET")
def song_preview(request, song_id):
    song = Song.objects.filter(id=song_id).first()
    if song is None:
        raise ApiError("Esa canción ya no está en el catálogo.", 404)

    if not song.preview_lookup_done:
        resolved = apple_track_embed(song)
        song.preview_embed_url = resolved[0] if resolved else ""
        song.preview_source_url = resolved[1] if resolved else song.source_url
        song.preview_lookup_done = True
        song.save(update_fields=("preview_embed_url", "preview_source_url", "preview_lookup_done"))

    return response({
        "available": bool(song.preview_embed_url),
        "embed_url": song.preview_embed_url,
        "source_url": song.preview_source_url or song.source_url,
    })


@api("POST")
def onboarding(request):
    data = payload(request)
    references = data.get("songs")
    if references is None:
        identifiers = data.get("song_ids")
        if not isinstance(identifiers, list) or len(identifiers) != 5 or any(
            type(item) is not int or item < 1 for item in identifiers
        ) or len(set(identifiers)) != 5:
            raise ApiError("Escoge exactamente cinco canciones diferentes, compae.")
        references = [{"source": "catalog", "id": item} for item in identifiers]

    if not isinstance(references, list) or len(references) != 5:
        raise ApiError("Escoge exactamente cinco canciones diferentes, compae.")

    normalized_references = []
    reference_keys = set()
    for item in references:
        if not isinstance(item, dict):
            raise ApiError("Una de las canciones seleccionadas no es válida.")
        source = item.get("source")
        if source == "catalog":
            identifier = item.get("id")
            if type(identifier) is not int or identifier < 1:
                raise ApiError("Una de las canciones del catálogo no es válida.")
            key = f"catalog:{identifier}"
            normalized_references.append({"source": source, "id": identifier, "key": key})
        elif source == "apple":
            track_id = item.get("track_id")
            if isinstance(track_id, int) and not isinstance(track_id, bool):
                track_id = str(track_id)
            if not isinstance(track_id, str) or not track_id.isdecimal() or len(track_id) > 32:
                raise ApiError("Una de las canciones de Apple Music no es válida.")
            key = f"apple:{track_id}"
            normalized_references.append({"source": source, "track_id": track_id, "key": key})
        else:
            raise ApiError("Una de las canciones seleccionadas no es válida.")
        if key in reference_keys:
            raise ApiError("Escoge cinco canciones diferentes, compae.")
        reference_keys.add(key)

    local_ids = [
        item["id"] for item in normalized_references if item["source"] == "catalog"
    ]
    local_songs = {
        song.id: song for song in Song.objects.filter(
            id__in=local_ids, is_recommendable=True
        )
    }
    if len(local_songs) != len(local_ids):
        raise ApiError("Una de las canciones del catálogo ya no está disponible.")

    apple_ids = [
        item["track_id"] for item in normalized_references if item["source"] == "apple"
    ]
    existing_apple = {
        song.apple_track_id: song for song in Song.objects.filter(apple_track_id__in=apple_ids)
    }
    missing_apple_ids = [track_id for track_id in apple_ids if track_id not in existing_apple]
    apple_tracks = {}
    if missing_apple_ids:
        apple_payload = apple_api_json("/lookup", {
            "id": ",".join(missing_apple_ids), "entity": "song", "country": "co",
        }, "No pudimos confirmar las canciones seleccionadas con Apple Music. Revisa tu conexión e inténtalo otra vez.")
        apple_tracks = {
            track_id: track for track in apple_result_list(
                apple_payload, "Apple Music devolvió una respuesta no válida."
            )
            if isinstance(track, dict) and track.get("wrapperType") == "track"
            and (track_id := apple_track_id(track)) in missing_apple_ids
        }
        if any(track_id not in apple_tracks for track_id in missing_apple_ids):
            raise ApiError("Apple Music no encontró una de las canciones seleccionadas. Vuelve a buscarla.", 422)
        for track_id, track in apple_tracks.items():
            year = apple_release_year(track)
            if year is None or not 1900 <= year <= 2013:
                raise ApiError("Solo se pueden guardar canciones con año confirmado hasta 2013.", 422)
            if not valid_apple_track_url(track.get("trackViewUrl", "")):
                raise ApiError("Apple Music no devolvió un enlace válido para una canción.", 422)

    with transaction.atomic():
        apple_songs = {}
        for track_id in missing_apple_ids:
            track = apple_tracks[track_id]
            title = str(track.get("trackName") or "").strip()[:180]
            artist = str(track.get("artistName") or "").strip()[:160]
            album = str(track.get("collectionName") or "Sencillo").strip()[:180] or "Sencillo"
            genre = str(track.get("primaryGenreName") or "")[:100]
            track_url = track["trackViewUrl"]
            if not title or not artist:
                raise ApiError("Apple Music no devolvió título e intérprete para una canción.", 422)
            song, _ = Song.objects.update_or_create(
                apple_track_id=track_id,
                defaults={
                    "key": f"apple-{track_id}",
                    "is_recommendable": False,
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "year": apple_release_year(track),
                    "genre": genre,
                    "tags": ["vallenato"],
                    "art_color": "#d98245",
                    "source_url": track_url,
                    "preview_embed_url": apple_embed_url(track_url, track_id),
                    "preview_source_url": track_url,
                    "preview_lookup_done": True,
                },
            )
            apple_songs[track_id] = song

        chosen = []
        for item in normalized_references:
            if item["source"] == "catalog":
                chosen.append(local_songs[item["id"]])
            else:
                chosen.append(existing_apple.get(item["track_id"]) or apple_songs[item["track_id"]])

        user = current_profile(request)
        user.seeds.set(chosen)
        for song in chosen:
            # Volver a escoger una descartada es una nueva preferencia positiva.
            existing = Reaction.objects.filter(profile=user, song=song).first()
            if existing is None or existing.reaction != Reaction.Kind.LOVE:
                Reaction.objects.update_or_create(
                    profile=user, song=song, defaults={"reaction": Reaction.Kind.LIKE}
                )
    return response(profile_data(user))


@api("GET")
def recommendations(request):
    user = current_profile(request)
    if not profile_data(user)["onboarded"]:
        return response({"recommendations": [], "remaining": 0, "needs_onboarding": True})
    reactions = dict(user.reactions.values_list("song_id", "reaction"))
    seed_ids = set(user.seeds.values_list("id", flat=True))
    catalog_songs = list(Song.objects.filter(is_recommendable=True))
    preference_ids = set(reactions) | seed_ids
    preference_songs = list(Song.objects.filter(id__in=preference_ids))
    results, remaining = recommend(
        catalog_songs, reactions, seed_ids, preference_songs=preference_songs
    )
    return response({
        "recommendations": [dict(item, song=song_data(item["song"])) for item in results],
        "remaining": remaining,
    })


@api("PUT")
def react(request, song_id):
    data = payload(request)
    kind = data.get("reaction")
    if kind not in Reaction.Kind.values:
        raise ApiError("Escoge una de las tres reacciones disponibles.")
    song = Song.objects.filter(id=song_id).first()
    if song is None:
        raise ApiError("Esa canción no está en el catálogo.", 404)
    with transaction.atomic():
        user = current_profile(request)
        if user.seeds.count() != 5:
            raise ApiError("Primero escoge tus cinco canciones para arrancar.", 409)
        Reaction.objects.update_or_create(profile=user, song=song, defaults={"reaction": kind})
    return response({"reaction": kind, "profile": profile_data(user)})


@api("GET")
def library(request):
    user = current_profile(request)
    seed_ids = set(user.seeds.values_list("id", flat=True))
    return response({
        "entries": [{
            "song": song_data(entry.song), "reaction": entry.reaction,
            "is_seed": entry.song_id in seed_ids, "updated_at": entry.updated_at.isoformat(),
        } for entry in user.reactions.select_related("song")],
        "stats": profile_data(user)["stats"],
    })


def csrf_failure(request, reason=""):
    return response({"error": "La sesión necesita refrescarse. Recarga la página e inténtalo otra vez."}, 403)


def frontend(request):
    if request.path == "/favicon.svg":
        target = settings.FRONTEND_DIST / "favicon.svg"
        if target.is_file():
            return FileResponse(target.open("rb"), content_type="image/svg+xml")
        return HttpResponse(status=404)
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        return HttpResponse(
            "ValleNofy necesita compilar su interfaz. Ejecuta iniciar.bat desde la raíz del proyecto.",
            status=503, content_type="text/plain; charset=utf-8",
        )
    result = FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
    result["Cache-Control"] = "no-cache"
    return result
