"""Offline contracts for browser preferences, catalog loading, and ranking."""

import json
import unicodedata
from datetime import datetime, timedelta
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.test import Client, TestCase
from django.utils import timezone

from .models import Profile, Reaction, Song
from .recommender import recommend


def create_song(key, **fields):
    defaults = {
        "title": key,
        "artist": "Test artist",
        "album": "Test album",
        "year": 1995,
        "tags": ["romantico"],
        "source_url": "https://example.invalid/catalog/",
    }
    defaults.update(fields)
    return Song.objects.create(key=key, **defaults)


def preference_snapshot():
    """Include identities and timestamps so accidental updates are visible."""
    return {
        "profiles": list(Profile.objects.order_by("id").values()),
        "seeds": list(Profile.seeds.through.objects.order_by("id").values()),
        "reactions": list(Reaction.objects.order_by("id").values()),
    }


class BrowserFixture(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.songs = [create_song(f"browser-song-{index}") for index in range(10)]
        cls.seed_ids = [song.pk for song in cls.songs[:5]]

    def onboard(self, client=None, song_ids=None):
        client = self.client if client is None else client
        song_ids = self.seed_ids if song_ids is None else song_ids
        result = client.post(
            "/api/onboarding/", {"song_ids": song_ids}, content_type="application/json"
        )
        self.assertEqual(result.status_code, 200, result.content)
        return result.json()

    def react(self, song, reaction, client=None):
        client = self.client if client is None else client
        result = client.put(
            f"/api/reactions/{song.pk}/",
            {"reaction": reaction},
            content_type="application/json",
        )
        self.assertEqual(result.status_code, 200, result.content)
        return result.json()


class BrowserSessionTests(BrowserFixture):
    def test_separate_browsers_keep_preferences_and_saved_cookies_restore_them(self):
        first, second = Client(), Client()
        first_response = first.get("/api/profile/")
        second_response = second.get("/api/profile/")
        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertNotEqual(first_response.json()["id"], second_response.json()["id"])
        for result in (first_response, second_response):
            self.assertFalse(result.json()["onboarded"])
            self.assertEqual(result.json()["seed_ids"], [])
            self.assertEqual(result.json()["stats"]["total"], 0)

        cookie = first_response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertGreater(int(cookie["max-age"]), 0)
        self.assertTrue(cookie["expires"])
        self.assertTrue(cookie["httponly"])

        self.onboard(first)
        second_ids = [song.pk for song in self.songs[-5:]]
        self.onboard(second, second_ids)
        shared_song = self.songs[5]
        first_state = self.react(shared_song, "love", first)["profile"]
        second_state = self.react(shared_song, "dislike", second)["profile"]

        restored = Client()
        restored.cookies.update(first.cookies)
        self.assertEqual(restored.get("/api/profile/").json(), first_state)
        self.assertEqual(second.get("/api/profile/").json(), second_state)
        self.assertCountEqual(first_state["seed_ids"], self.seed_ids)
        self.assertCountEqual(second_state["seed_ids"], second_ids)
        self.assertEqual(
            first_state["stats"], {"liked": 5, "loved": 1, "disliked": 0, "total": 6}
        )
        self.assertEqual(
            second_state["stats"], {"liked": 4, "loved": 0, "disliked": 1, "total": 5}
        )
        for browser, expected in ((restored, "love"), (second, "dislike")):
            entries = browser.get("/api/library/").json()["entries"]
            shared = [entry for entry in entries if entry["song"]["id"] == shared_song.pk]
            self.assertEqual(len(shared), 1)
            self.assertEqual(shared[0]["reaction"], expected)
        self.assertEqual(Profile.objects.count(), 2)

        fresh = Client().get("/api/profile/").json()
        self.assertNotIn(fresh["id"], (first_state["id"], second_state["id"]))
        self.assertFalse(fresh["onboarded"])
        self.assertEqual(fresh["stats"]["total"], 0)

    def test_recommendations_require_onboarding_for_each_browser(self):
        self.onboard()
        result = Client().get("/api/recommendations/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            result.json(),
            {"recommendations": [], "remaining": 0, "needs_onboarding": True},
        )
        self.assertTrue(self.client.get("/api/profile/").json()["onboarded"])


class OnboardingTests(BrowserFixture):
    def invalid_bodies(self):
        ids = self.seed_ids
        unknown_id = max(song.pk for song in self.songs) + 1000
        invalid_ids = [
            ("missing", {}),
            ("null", {"song_ids": None}),
            ("string", {"song_ids": ",".join(map(str, ids))}),
            ("object", {"song_ids": {"id": ids[0]}}),
            ("empty", {"song_ids": []}),
            ("four", {"song_ids": ids[:4]}),
            ("six", {"song_ids": [song.pk for song in self.songs[:6]]}),
            ("duplicate", {"song_ids": ids[:4] + [ids[0]]}),
            ("string ids", {"song_ids": list(map(str, ids))}),
            ("boolean", {"song_ids": ids[:4] + [True]}),
            ("float", {"song_ids": ids[:4] + [float(ids[4])]}),
            ("zero", {"song_ids": ids[:4] + [0]}),
            ("negative", {"song_ids": ids[:4] + [-1]}),
            ("null id", {"song_ids": ids[:4] + [None]}),
            ("nested id", {"song_ids": ids[:4] + [[ids[4]]]}),
            ("unknown song", {"song_ids": ids[:4] + [unknown_id]}),
        ]
        return [(name, json.dumps(body)) for name, body in invalid_ids] + [
            ("malformed JSON", "{"),
            ("invalid UTF-8", b"\xff"),
            ("JSON array", json.dumps(ids)),
            ("JSON null", "null"),
            ("JSON scalar", "true"),
            ("oversized", json.dumps({"song_ids": ids, "padding": "x" * 8192})),
        ]

    def test_exactly_five_distinct_songs_create_five_positive_preferences(self):
        state = self.onboard(song_ids=list(reversed(self.seed_ids)))
        self.assertTrue(state["onboarded"])
        self.assertCountEqual(state["seed_ids"], self.seed_ids)
        self.assertEqual(
            state["stats"], {"liked": 5, "loved": 0, "disliked": 0, "total": 5}
        )
        profile = Profile.objects.get(pk=state["id"])
        self.assertCountEqual(profile.seeds.values_list("pk", flat=True), self.seed_ids)
        self.assertCountEqual(
            profile.reactions.values_list("song_id", "reaction"),
            [(song_id, "like") for song_id in self.seed_ids],
        )
        repeated = self.onboard()
        self.assertEqual(repeated, state)
        self.assertEqual(Profile.objects.count(), 1)
        self.assertEqual(Reaction.objects.count(), 5)

    def test_invalid_onboarding_creates_no_profile_seeds_or_reactions(self):
        before = preference_snapshot()
        catalog_before = list(Song.objects.order_by("id").values())
        for name, body in self.invalid_bodies():
            with self.subTest(name=name):
                browser = Client()
                result = browser.post(
                    "/api/onboarding/", body, content_type="application/json"
                )
                self.assertEqual(result.status_code, 400, result.content)
                self.assertIn("error", result.json())
                self.assertEqual(preference_snapshot(), before)
                self.assertEqual(list(Song.objects.order_by("id").values()), catalog_before)
                self.assertNotIn(settings.SESSION_COOKIE_NAME, browser.cookies)

    def test_invalid_onboarding_preserves_existing_preferences_without_updates(self):
        self.onboard()
        self.react(self.songs[0], "love")
        self.react(self.songs[5], "dislike")
        before = preference_snapshot()
        for name, body in self.invalid_bodies():
            with self.subTest(name=name):
                result = self.client.post(
                    "/api/onboarding/", body, content_type="application/json"
                )
                self.assertEqual(result.status_code, 400, result.content)
                self.assertEqual(preference_snapshot(), before)

    def test_reselecting_seeds_preserves_loves_and_history_and_revives_rejections(self):
        original = self.onboard()
        self.react(self.songs[0], "love")
        self.react(self.songs[1], "dislike")
        self.react(self.songs[5], "dislike")
        new_ids = [self.songs[index].pk for index in (0, 1, 2, 5, 6)]
        state = self.onboard(song_ids=new_ids)
        self.assertEqual(state["id"], original["id"])
        self.assertTrue(state["onboarded"])
        self.assertCountEqual(state["seed_ids"], new_ids)
        self.assertEqual(
            state["stats"], {"liked": 6, "loved": 1, "disliked": 0, "total": 7}
        )
        entries = {
            entry["song"]["id"]: entry
            for entry in self.client.get("/api/library/").json()["entries"]
        }
        self.assertEqual(entries[self.songs[0].pk]["reaction"], "love")
        for index in (1, 5):
            self.assertEqual(entries[self.songs[index].pk]["reaction"], "like")
        for index in (3, 4):
            self.assertIn(self.songs[index].pk, entries)
            self.assertFalse(entries[self.songs[index].pk]["is_seed"])


class CsrfTests(BrowserFixture):
    def test_profile_sets_csrf_cookie_and_onboarding_requires_matching_header(self):
        browser = Client(enforce_csrf_checks=True)
        profile = browser.get("/api/profile/")
        self.assertEqual(profile.status_code, 200)
        self.assertIn(settings.CSRF_COOKIE_NAME, profile.cookies)
        token = browser.cookies[settings.CSRF_COOKIE_NAME].value
        self.assertTrue(token)
        before = preference_snapshot()

        rejected = browser.post(
            "/api/onboarding/", {"song_ids": self.seed_ids}, content_type="application/json"
        )
        self.assertEqual(rejected.status_code, 403)
        self.assertIn("error", rejected.json())
        self.assertEqual(preference_snapshot(), before)

        accepted = browser.post(
            "/api/onboarding/",
            {"song_ids": self.seed_ids},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertTrue(accepted.json()["onboarded"])
        self.assertEqual(accepted.json()["id"], profile.json()["id"])
        self.assertEqual(Reaction.objects.count(), 5)

        before = preference_snapshot()
        url = f"/api/reactions/{self.songs[5].pk}/"
        rejected = browser.put(url, {"reaction": "love"}, content_type="application/json")
        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(preference_snapshot(), before)
        accepted = browser.put(
            url,
            {"reaction": "love"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertEqual(accepted.json()["profile"]["stats"]["loved"], 1)


class LibraryAndRecommendationTests(BrowserFixture):
    def test_latest_reaction_replaces_previous_value_and_stats_count_unique_songs(self):
        self.onboard()
        target = self.songs[5]
        self.react(target, "like")
        self.react(self.songs[6], "dislike")
        reaction_id = Reaction.objects.get(song=target).pk
        yesterday = timezone.now() - timedelta(days=1)
        Reaction.objects.update(updated_at=yesterday)
        for kind in ("love", "dislike", "love"):
            self.react(target, kind)

        result = self.client.get("/api/library/")
        self.assertEqual(result.status_code, 200)
        library = result.json()
        entries = library["entries"]
        ids = [entry["song"]["id"] for entry in entries]
        self.assertEqual(len(ids), 7)
        self.assertEqual(len(set(ids)), 7)
        self.assertEqual(ids[0], target.pk)
        self.assertEqual(entries[0]["reaction"], "love")
        self.assertFalse(entries[0]["is_seed"])
        self.assertGreater(datetime.fromisoformat(entries[0]["updated_at"]), yesterday)
        self.assertEqual(Reaction.objects.get(song=target).pk, reaction_id)
        self.assertEqual(Reaction.objects.count(), 7)
        expected_stats = {"liked": 5, "loved": 1, "disliked": 1, "total": 7}
        self.assertEqual(library["stats"], expected_stats)
        self.assertEqual(self.client.get("/api/profile/").json()["stats"], expected_stats)
        self.assertEqual(
            {entry["song"]["id"] for entry in entries if entry["is_seed"]},
            set(self.seed_ids),
        )

    def test_invalid_reactions_leave_preferences_untouched(self):
        self.onboard()
        before = preference_snapshot()
        url = f"/api/reactions/{self.songs[5].pk}/"
        for value in (None, "", "LOVE", "skip", True, 3, [], {}):
            with self.subTest(reaction=value):
                result = self.client.put(
                    url, {"reaction": value}, content_type="application/json"
                )
                self.assertEqual(result.status_code, 400, result.content)
                self.assertEqual(preference_snapshot(), before)
        missing_id = max(song.pk for song in self.songs) + 1000
        result = self.client.put(
            f"/api/reactions/{missing_id}/",
            {"reaction": "love"},
            content_type="application/json",
        )
        self.assertEqual(result.status_code, 404)
        self.assertEqual(preference_snapshot(), before)

    def test_reacting_before_onboarding_creates_no_preferences(self):
        before = preference_snapshot()
        result = self.client.put(
            f"/api/reactions/{self.songs[0].pk}/",
            {"reaction": "love"},
            content_type="application/json",
        )
        self.assertEqual(result.status_code, 409)
        self.assertEqual(preference_snapshot(), before)

    def test_recommendations_exclude_seeds_and_every_kind_of_rated_song(self):
        self.onboard()
        for song, kind in zip(self.songs[5:8], ("like", "love", "dislike")):
            self.react(song, kind)
        result = self.client.get("/api/recommendations/")
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(data["remaining"], 2)
        self.assertCountEqual(
            [item["song"]["id"] for item in data["recommendations"]],
            [song.pk for song in self.songs[8:]],
        )
        for item in data["recommendations"]:
            self.assertIsInstance(item["score"], (int, float))
            self.assertTrue(item["reason"])

    def test_losing_all_positive_reactions_requires_onboarding_again(self):
        self.onboard()
        self.react(self.songs[5], "love")
        for song in self.songs[:5]:
            self.react(song, "dislike")
        self.assertTrue(self.client.get("/api/profile/").json()["onboarded"])
        last = self.react(self.songs[5], "dislike")["profile"]
        self.assertFalse(last["onboarded"])
        self.assertCountEqual(last["seed_ids"], self.seed_ids)
        self.assertEqual(
            last["stats"], {"liked": 0, "loved": 0, "disliked": 6, "total": 6}
        )
        self.assertEqual(self.client.get("/api/profile/").json(), last)
        self.assertEqual(
            self.client.get("/api/recommendations/").json(),
            {"recommendations": [], "remaining": 0, "needs_onboarding": True},
        )
        self.assertEqual(self.client.get("/api/library/").json()["stats"], last["stats"])
        restored = self.react(self.songs[0], "love")["profile"]
        self.assertTrue(restored["onboarded"])
        self.assertTrue(self.client.get("/api/recommendations/").json()["recommendations"])

    def test_exhausting_catalog_keeps_positive_profile_onboarded(self):
        self.onboard()
        for song in self.songs[5:]:
            self.react(song, "like")
        result = self.client.get("/api/recommendations/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["recommendations"], [])
        self.assertEqual(result.json()["remaining"], 0)
        self.assertFalse(result.json().get("needs_onboarding", False))
        self.assertTrue(self.client.get("/api/profile/").json()["onboarded"])


class UnicodeSearchTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.match = create_song(
            "unicode-song",
            title="Canción del corazón",
            artist="Ídolo de la región",
            album="Melodías del río",
        )
        cls.other = create_song(
            "other-song", title="Otro camino", artist="Luna", album="Antología añeja"
        )

    def test_search_matches_title_artist_and_album_with_accents_and_case(self):
        for query in (
            "  CANCION DEL CORAZON  ",
            "CANCIÓN DEL CORAZÓN",
            unicodedata.normalize("NFD", "Canción del corazón"),
            "IDOLO DE LA REGION",
            "ÍDOLO DE LA REGIÓN",
            "MELODIAS DEL RIO",
            unicodedata.normalize("NFD", "Melodías del río"),
        ):
            with self.subTest(query=query):
                result = self.client.get("/api/songs/", {"q": query})
                self.assertEqual(result.status_code, 200)
                self.assertEqual([song["id"] for song in result.json()["songs"]], [self.match.pk])
                song = result.json()["songs"][0]
                self.assertEqual(song["title"], "Canción del corazón")
                self.assertEqual(song["artist"], "Ídolo de la región")
                self.assertEqual(song["album"], "Melodías del río")

    def test_search_handles_enye_and_combines_with_artist_filter(self):
        result = self.client.get("/api/songs/", {"q": "ANTOLOGIA ANEJA"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual([song["id"] for song in result.json()["songs"]], [self.other.pk])
        result = self.client.get(
            "/api/songs/", {"q": "cancion", "artist": "Ídolo de la región"}
        )
        self.assertEqual([song["id"] for song in result.json()["songs"]], [self.match.pk])
        result = self.client.get("/api/songs/", {"q": "cancion", "artist": "Luna"})
        self.assertEqual(result.json()["songs"], [])


class SyntheticRankingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Equal group sizes make the three feature families equally represented.
        # Titles never carry the distinguishing information used by the scorer.
        cls.groups = {
            family: [
                create_song(
                    f"ranking-{family}-{index}",
                    artist=f"Ensemble {family}",
                    tags=[family],
                )
                for index in range(5)
            ]
            for family in ("amber", "blue", "coral")
        }
        cls.catalog = list(Song.objects.order_by("pk"))
        amber, blue, coral = (cls.groups[name] for name in ("amber", "blue", "coral"))
        cls.seed_ids = {song.pk for song in (amber[0], blue[0], blue[1], coral[0], coral[1])}

    def ranking(self, reactions, seed_ids=None, limit=None):
        seed_ids = self.seed_ids if seed_ids is None else seed_ids
        limit = len(self.catalog) if limit is None else limit
        return recommend(self.catalog, reactions, seed_ids, limit=limit)

    def test_one_love_has_the_ranking_influence_of_three_likes(self):
        amber, blue = self.groups["amber"], self.groups["blue"]
        reactions = {song_id: "like" for song_id in self.seed_ids}

        def compare_families():
            results, _ = self.ranking(reactions)
            scores = {item["song"].pk: item["score"] for item in results}
            positions = {item["song"].pk: index for index, item in enumerate(results)}
            return scores, positions

        amber_candidate, blue_candidate = amber[4].pk, blue[4].pk
        scores, positions = compare_families()
        self.assertLess(scores[amber_candidate], scores[blue_candidate])
        self.assertGreater(positions[amber_candidate], positions[blue_candidate])

        reactions[amber[0].pk] = "love"
        scores, positions = compare_families()
        self.assertGreater(scores[amber_candidate], scores[blue_candidate])
        self.assertLess(positions[amber_candidate], positions[blue_candidate])

        reactions[blue[2].pk] = "like"
        scores, _ = compare_families()
        self.assertAlmostEqual(scores[amber_candidate], scores[blue_candidate], places=5)

        reactions[blue[3].pk] = "like"
        scores, positions = compare_families()
        self.assertLess(scores[amber_candidate], scores[blue_candidate])
        self.assertGreater(positions[amber_candidate], positions[blue_candidate])

    def test_rejection_penalizes_similar_candidates_without_changing_positive_seeds(self):
        amber, blue, coral = (self.groups[name] for name in ("amber", "blue", "coral"))
        seed_ids = {song.pk for song in (amber[0], amber[1], blue[0], blue[1], coral[0])}
        reactions = {song_id: "like" for song_id in seed_ids}
        before, _ = self.ranking(reactions, seed_ids)
        before_scores = {item["song"].pk: item["score"] for item in before}
        amber_id, blue_id = amber[4].pk, blue[4].pk
        self.assertAlmostEqual(before_scores[amber_id], before_scores[blue_id], places=5)

        reactions[amber[2].pk] = "dislike"
        after, _ = self.ranking(reactions, seed_ids)
        after_scores = {item["song"].pk: item["score"] for item in after}
        after_ids = [item["song"].pk for item in after]
        self.assertNotIn(amber[2].pk, after_ids)
        self.assertLess(after_scores[amber_id], before_scores[amber_id])
        self.assertGreater(
            before_scores[amber_id] - after_scores[amber_id],
            before_scores[blue_id] - after_scores[blue_id],
        )
        self.assertGreater(after_scores[blue_id], after_scores[amber_id])
        self.assertLess(after_ids.index(blue_id), after_ids.index(amber_id))

    def test_seed_and_rated_exclusion_and_remaining_are_independent_of_limit(self):
        amber = self.groups["amber"]
        reactions = {song_id: "like" for song_id in self.seed_ids}
        # Seeds stay excluded even when one has no reaction row.
        reactions.pop(self.groups["coral"][1].pk)
        reactions.update({amber[1].pk: "like", amber[2].pk: "love", amber[3].pk: "dislike"})
        expected_ids = {song.pk for song in self.catalog} - self.seed_ids - set(reactions)
        results, remaining = self.ranking(reactions)
        self.assertEqual(remaining, len(expected_ids))
        self.assertCountEqual([item["song"].pk for item in results], expected_ids)
        limited, limited_remaining = self.ranking(reactions, limit=3)
        self.assertEqual(len(limited), 3)
        self.assertEqual(limited_remaining, remaining)
        self.assertEqual(
            [item["song"].pk for item in limited],
            [item["song"].pk for item in results[:3]],
        )
        scores = [item["score"] for item in results]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_no_positive_preferences_produces_no_ranked_results(self):
        reactions = {song_id: "dislike" for song_id in self.seed_ids}
        results, remaining = self.ranking(reactions)
        self.assertEqual(results, [])
        self.assertEqual(remaining, len(self.catalog) - 5)


class SeedCatalogTests(TestCase):
    def seed(self):
        call_command("seed_catalog", stdout=StringIO())

    def test_catalog_loads_exactly_sixty_unique_songs_no_later_than_2013(self):
        self.seed()
        self.assertEqual(Song.objects.count(), 60)
        self.assertEqual(Song.objects.values("key").distinct().count(), 60)
        self.assertFalse(Song.objects.filter(year__gt=2013).exists())
        for song in Song.objects.all():
            with self.subTest(song=song.key):
                song.full_clean()

    def test_repeated_seeding_preserves_song_ids_profiles_seeds_and_reactions(self):
        self.seed()
        songs = list(Song.objects.order_by("pk"))
        first, second = Profile.objects.create(), Profile.objects.create()
        first.seeds.set(songs[:5])
        second.seeds.set(songs[3:8])
        for profile, selected in ((first, songs[:5]), (second, songs[3:8])):
            for song, kind in zip(selected, ("love", "dislike", "like", "love", "like")):
                Reaction.objects.create(profile=profile, song=song, reaction=kind)
        catalog_before = list(Song.objects.order_by("pk").values())
        preferences_before = preference_snapshot()
        for _ in range(2):
            self.seed()
            self.assertEqual(Song.objects.count(), 60)
            self.assertEqual(list(Song.objects.order_by("pk").values()), catalog_before)
            self.assertEqual(preference_snapshot(), preferences_before)

    def test_reseeding_refreshes_metadata_without_replacing_reacted_song(self):
        self.seed()
        song = Song.objects.order_by("pk").first()
        original_title = song.title
        profile = Profile.objects.create()
        reaction = Reaction.objects.create(profile=profile, song=song, reaction="love")
        Song.objects.filter(pk=song.pk).update(title="Locally changed title")
        before = preference_snapshot()
        self.seed()
        song.refresh_from_db()
        reaction.refresh_from_db()
        self.assertEqual(song.title, original_title)
        self.assertEqual(reaction.song_id, song.pk)
        self.assertEqual(reaction.reaction, "love")
        self.assertEqual(Song.objects.count(), 60)
        self.assertEqual(preference_snapshot(), before)
