"""Configuración local de ValleNofy; no necesita servicios ni claves externas."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIST = PROJECT_DIR / "Frontent" / "dist"


def local_secret():
    secret_path = PROJECT_DIR / ".local-secret"
    try:
        with secret_path.open("x", encoding="utf-8") as secret_file:
            secret_file.write(secrets.token_urlsafe(64))
    except FileExistsError:
        pass
    return secret_path.read_text(encoding="utf-8").strip()


SECRET_KEY = os.environ.get("VALLENOFY_SECRET_KEY") or local_secret()
DEBUG = os.environ.get("VALLENOFY_DEBUG", "0") == "1"
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]"]
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "music.apps.MusicConfig",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "db.sqlite3",
    "OPTIONS": {"timeout": 20},
}}
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/assets/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST / "assets"] if (FRONTEND_DIST / "assets").is_dir() else []
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
SESSION_COOKIE_NAME = "vallenofy_session"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 365
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CSRF_FAILURE_VIEW = "music.views.csrf_failure"
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
