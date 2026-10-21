"""Instala y arranca únicamente dentro del proyecto; invocado por iniciar.bat."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
FRONTEND = ROOT / "Frontent"
STATE_FILE = ROOT / ".setup-state.json"


class SetupError(Exception):
    pass


def digest(paths):
    result = hashlib.sha256()
    for path in sorted(paths):
        if path.is_file():
            result.update(str(path.relative_to(ROOT)).encode("utf-8"))
            result.update(path.read_bytes())
    return result.hexdigest()


def run(arguments, cwd=ROOT):
    completed = subprocess.run([str(value) for value in arguments], cwd=str(cwd), check=False)
    if completed.returncode:
        raise SetupError(f"Falló el paso: {Path(str(arguments[0])).name} {' '.join(str(v) for v in arguments[1:3])}")


def load_state():
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return state if isinstance(state, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Prepara y ejecuta ValleNofy localmente.")
    parser.add_argument("--prepare-only", action="store_true", help="Prepara todo sin iniciar el servidor.")
    parser.add_argument("--no-browser", action="store_true", help="No abre automáticamente el navegador.")
    parser.add_argument("--port", type=int, default=8000, help="Puerto local; por defecto 8000.")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        raise SetupError("El puerto debe estar entre 1024 y 65535.")
    if sys.prefix == sys.base_prefix or Path(sys.prefix).resolve() != (ROOT / "venv").resolve():
        raise SetupError("Ejecuta iniciar.bat para usar exclusivamente el venv de este proyecto.")
    if not (3, 12) <= sys.version_info[:2] <= (3, 14) or struct.calcsize("P") != 8:
        raise SetupError("Se requiere Python 3.12 a 3.14 de 64 bits. No se ha instalado nada globalmente.")
    node = shutil.which("node")
    npm = shutil.which("npm.cmd") if os.name == "nt" else shutil.which("npm")
    if not node or not npm:
        raise SetupError("Instala Node.js 22.12+ o 24 LTS con npm y vuelve a abrir iniciar.bat.")
    version_text = subprocess.check_output([node, "--version"], text=True).strip().lstrip("v")
    version = tuple(int(part) for part in version_text.split(".")[:2])
    if not ((version[0] == 22 and version >= (22, 12)) or version[0] >= 24):
        raise SetupError(f"Node {version_text} es muy antiguo. Se requiere Node 22.12+ o 24 LTS.")

    state = load_state()
    requirements = BACKEND / "requirements.txt"
    python_stamp = digest([requirements]) + sys.version + str(Path(sys.executable).resolve())
    modules_ready = all(importlib.util.find_spec(module) is not None for module in (
        "django", "sklearn", "waitress", "whitenoise"
    ))
    if state.get("python") != python_stamp or not modules_ready:
        print("[1/5] Instalando dependencias exclusivamente en venv...", flush=True)
        run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--only-binary=:all:", "-r", requirements])
        state["python"] = python_stamp
        save_state(state)
    else:
        print("[1/5] Dependencias de Python listas.", flush=True)

    lock = FRONTEND / "package-lock.json"
    if not lock.is_file():
        raise SetupError("Falta Frontent/package-lock.json. Copia el proyecto completo.")
    node_stamp = digest([FRONTEND / "package.json", lock]) + version_text
    if state.get("node") != node_stamp or not (FRONTEND / "node_modules" / ".package-lock.json").is_file():
        print("[2/5] Instalando dependencias en Frontent/node_modules...", flush=True)
        run([npm, "ci", "--no-audit", "--no-fund", "--cache", ROOT / ".cache" / "npm"], cwd=FRONTEND)
        state["node"] = node_stamp
        state.pop("build", None)
        save_state(state)
    else:
        print("[2/5] Dependencias de React listas.", flush=True)

    sources = [FRONTEND / "index.html", FRONTEND / "vite.config.js", FRONTEND / "package.json", lock]
    for directory in (FRONTEND / "src", FRONTEND / "public"):
        if directory.is_dir():
            sources.extend(path for path in directory.rglob("*") if path.is_file())
    build_stamp = digest(sources)
    assets_ready = (FRONTEND / "dist" / "assets").is_dir() and any(
        (FRONTEND / "dist" / "assets").glob("*.js")
    )
    if state.get("build") != build_stamp or not (FRONTEND / "dist" / "index.html").is_file() or not assets_ready:
        print("[3/5] Compilando la interfaz...", flush=True)
        run([npm, "run", "build"], cwd=FRONTEND)
        state["build"] = build_stamp
        save_state(state)
    else:
        print("[3/5] La interfaz ya está compilada.", flush=True)

    print("[4/5] Preparando SQLite y las canciones (tus gustos se conservan)...", flush=True)
    run([sys.executable, BACKEND / "manage.py", "migrate", "--noinput"])
    run([sys.executable, BACKEND / "manage.py", "seed_catalog"])
    print("[5/5] Preparando los archivos de la interfaz...", flush=True)
    run([sys.executable, BACKEND / "manage.py", "collectstatic", "--noinput", "--verbosity", "0"])
    if args.prepare_only:
        print("\nValleNofy está listo. Abre iniciar.bat para comenzar.", flush=True)
        return
    command = [sys.executable, BACKEND / "serve.py", "--port", str(args.port)]
    if args.no_browser:
        command.append("--no-browser")
    run(command)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nParranda terminada. Tus gustos siguen guardados.")
    except (SetupError, OSError, subprocess.SubprocessError) as error:
        print(f"\nNo se pudo iniciar ValleNofy: {error}", file=sys.stderr)
        sys.exit(1)
