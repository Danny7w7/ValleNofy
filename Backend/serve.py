"""Servidor local para Windows, con React compilado y Django en un solo puerto."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


def open_when_ready(url):
    for _ in range(60):
        try:
            with urlopen(url + "/api/health/", timeout=1) as result:
                if json.load(result).get("app") == "vallenofy":
                    webbrowser.open(url)
                    return
        except (URLError, TimeoutError, OSError, ValueError):
            time.sleep(0.5)
    print(f"Abre {url} en tu navegador cuando el servidor esté listo.", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Usa un puerto entre 1024 y 65535.")
    from config.wsgi import application
    from waitress import create_server

    url = f"http://127.0.0.1:{args.port}"
    try:
        server = create_server(application, host="127.0.0.1", port=args.port, threads=4)
    except OSError:
        expected = hashlib.sha256(str(Path(__file__).resolve().parent.parent).encode("utf-8")).hexdigest()[:16]
        try:
            with urlopen(url + "/api/health/", timeout=2) as result:
                existing = json.load(result)
            if existing.get("app") == "vallenofy" and existing.get("instance") == expected:
                print(f"ValleNofy ya estaba abierto: {url}", flush=True)
                if not args.no_browser:
                    webbrowser.open(url)
                return
        except (URLError, TimeoutError, OSError, ValueError):
            pass
        print(f"El puerto {args.port} está ocupado. Cierra la otra aplicación o usa iniciar.bat --port 8001.", file=sys.stderr)
        sys.exit(1)
    print(f"\n  ValleNofy está sonando en {url}", flush=True)
    print("  Mantén esta ventana abierta. Para detenerlo, presiona Ctrl+C.\n", flush=True)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    try:
        server.run()
    except KeyboardInterrupt:
        print("\n¡Nos pillamos, compae! Tus gustos siguen en SQLite.", flush=True)
    finally:
        server.close()


if __name__ == "__main__":
    main()
