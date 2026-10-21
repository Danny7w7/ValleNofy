"""Filtrado basado en contenido: TF-IDF + coseno + retroalimentación del usuario.

El vocabulario se aprende del catálogo. Las etiquetas son curaduría editorial;
no se analiza el audio ni se usan modelos remotos. Los pesos son parámetros
explícitos, no resultados de entrenamiento supervisado.
"""
import re
import unicodedata
from functools import lru_cache

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def normalized(value):
    return "".join(
        char for char in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(char)
    ).strip()


def feature_token(value):
    return re.sub(r"[^a-z0-9]+", "_", normalized(value)).strip("_")


def main_artist(artist):
    # El cantante conserva su afinidad aunque cambie de acordeonero entre discos.
    return artist.split(" & ")[0].strip()


def tokens(document):
    return document


@lru_cache(maxsize=4)
def catalog_vectors(fingerprint):
    documents = []
    for _, artist, year, tags, genre in fingerprint:
        # Repetir el término da algo más de influencia al intérprete.
        artist_token = f"artista:{feature_token(main_artist(artist))}"
        documents.append([
            artist_token, artist_token, f"decada:{year // 10 * 10}",
            *(f"etiqueta:{feature_token(tag)}" for tag in tags),
        ])
    vectorizer = TfidfVectorizer(analyzer=tokens, norm="l2")
    return vectorizer.fit_transform(documents)


def explanation(song, closest):
    if main_artist(song.artist) == main_artist(closest.artist):
        return f"Porque te gusta «{closest.title}»: otra canción de {main_artist(song.artist)}."
    shared = [tag for tag in song.tags if tag in closest.tags]
    labels = {
        "romantico": "romántico", "clasico": "clásico", "nostalgia": "nostálgico",
        "parranda": "de parranda", "despecho": "de despecho",
        "alegre": "alegre", "tradicional": "tradicional", "vallenato": "vallenato",
    }
    if shared:
        style = " y ".join(labels.get(tag, tag) for tag in shared[:2])
        return f"Por tu gusto por «{closest.title}»: comparten un ambiente {style}."
    if song.year // 10 == closest.year // 10:
        return f"Por tu gusto por «{closest.title}»: más vallenato de los {song.year // 10 * 10}."
    return f"Una propuesta para explorar a partir de tu gusto por «{closest.title}»."


def recommend(songs, reactions, seed_ids, limit=10, preference_songs=None):
    candidates_pool = [song for song in songs if getattr(song, "is_recommendable", True)]
    if not candidates_pool:
        return [], 0
    feature_songs = list({song.id: song for song in [
        *candidates_pool, *(preference_songs if preference_songs is not None else songs)
    ]}.values())
    has_apple_preferences = any(
        not getattr(song, "is_recommendable", True) for song in feature_songs
    )
    fingerprint = tuple(
        (
            s.id, s.artist, s.year,
            tuple(s.tags) + (("vallenato",) if has_apple_preferences and "vallenato" not in s.tags else ()),
            getattr(s, "genre", ""),
        )
        for s in feature_songs
    )
    matrix = catalog_vectors(fingerprint)
    positions = {song.id: index for index, song in enumerate(feature_songs)}
    positive, weights, negative = [], [], []
    rated_ids = set(reactions) | set(seed_ids)
    for song_id, reaction in reactions.items():
        if song_id not in positions:
            continue
        if reaction == "dislike":
            negative.append(positions[song_id])
        else:
            positive.append(positions[song_id])
            weights.append(3.0 if reaction == "love" else 1.0)
    candidate_positions = [
        positions[song.id] for song in candidates_pool if song.id not in rated_ids
    ]
    candidate_songs = [feature_songs[index] for index in candidate_positions]
    if not candidate_songs:
        return [], 0
    if not positive:
        return [], len(candidate_songs)
    positive_profile = np.asarray(matrix[positive].multiply(np.array(weights)[:, None]).sum(axis=0))
    positive_profile /= sum(weights)
    scores = cosine_similarity(matrix[candidate_positions], positive_profile).ravel()
    if negative:
        negative_profile = np.asarray(matrix[negative].mean(axis=0))
        scores -= 0.5 * cosine_similarity(matrix[candidate_positions], negative_profile).ravel()
    ranked = sorted(range(len(candidate_songs)), key=lambda index: (
        -float(scores[index]), candidate_songs[index].id
    ))
    results = []
    for index in ranked[:limit]:
        candidate_position = candidate_positions[index]
        similarities = cosine_similarity(matrix[candidate_position], matrix[positive]).ravel()
        # La explicación usa una canción positiva y una coincidencia real de metadatos.
        closest = feature_songs[positive[int(np.argmax(similarities))]]
        results.append({
            "song": candidate_songs[index], "score": round(float(scores[index]), 6),
            "reason": explanation(candidate_songs[index], closest),
        })
    return results, len(candidate_songs)
