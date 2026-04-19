#!/usr/bin/env python3
"""
Descarga un pack de emojis desde GitHub, normaliza nombres para Discord
y redimensiona a 128x128 (opcional) para facilitar subida al bot.

Uso rápido (Twemoji):
  python scripts/download_emoji_pack.py

Pack divertido (sin banderas):
  python scripts/download_emoji_pack.py --profile fun --out assets/emojis/fun_pack --commands-file assets/emojis/upload_commands_fun.txt --clean-out
"""

from __future__ import annotations

import argparse
import io
import re
import sys
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"}


def parse_codepoints_from_filename(filename: str) -> list[int]:
    stem = Path(filename).stem.lower()
    points: list[int] = []
    for token in stem.split("-"):
        if re.fullmatch(r"[0-9a-f]{4,6}", token):
            try:
                points.append(int(token, 16))
            except ValueError:
                continue
    return points


def is_country_flag(points: list[int]) -> bool:
    if len(points) != 2:
        return False
    return all(0x1F1E6 <= value <= 0x1F1FF for value in points)


def is_fun_emoji(points: list[int]) -> bool:
    if not points:
        return False
    if is_country_flag(points):
        return False

    fun_ranges = [
        (0x1F300, 0x1F5FF),  # symbols & pictographs
        (0x1F600, 0x1F64F),  # emoticons
        (0x1F680, 0x1F6FF),  # transport & map
        (0x1F900, 0x1F9FF),  # supplemental symbols
        (0x1FA70, 0x1FAFF),  # extended symbols
        (0x2600, 0x27BF),    # misc + dingbats
    ]

    for value in points:
        for start, end in fun_ranges:
            if start <= value <= end:
                return True
    return False


def should_include_file(path: str, profile: str) -> bool:
    if profile == "all":
        return True
    points = parse_codepoints_from_filename(Path(path).name)
    if profile == "fun":
        return is_fun_emoji(points)
    return True


def sanitize_emoji_name(raw_name: str) -> str:
    base = Path(raw_name).stem.lower()
    cleaned = re.sub(r"[^a-z0-9_]+", "_", base).strip("_")
    if not cleaned:
        cleaned = "emoji"
    if cleaned[0].isdigit():
        cleaned = f"e_{cleaned}"
    if len(cleaned) < 2:
        cleaned = f"{cleaned}_x"
    return cleaned[:32]


def ensure_unique_name(name: str, used: set[str]) -> str:
    if name not in used:
        used.add(name)
        return name

    i = 2
    while True:
        suffix = f"_{i}"
        candidate = (name[: 32 - len(suffix)] + suffix).rstrip("_")
        if candidate not in used:
            used.add(candidate)
            return candidate
        i += 1


def maybe_resize_image(data: bytes, ext: str, size: int, disable_resize: bool) -> tuple[bytes, str]:
    if disable_resize:
        return data, ext

    try:
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Falta Pillow para redimensionar. Instala con: pip install pillow") from exc

    with Image.open(io.BytesIO(data)) as image:
        image = image.convert("RGBA") if ext in {".png", ".webp", ".avif"} else image.convert("RGB")
        image = image.resize((size, size))
        out = io.BytesIO()

        if ext in {".jpg", ".jpeg"}:
            image.save(out, format="JPEG", quality=92, optimize=True)
            return out.getvalue(), ".jpg"
        if ext == ".webp":
            image.save(out, format="WEBP", quality=92, method=6)
            return out.getvalue(), ".webp"

        image.save(out, format="PNG", optimize=True)
        return out.getvalue(), ".png"


def download_github_zip(repo: str, branch: str) -> bytes:
    url = f"https://codeload.github.com/{repo}/zip/refs/heads/{branch}"
    request = Request(url, headers={"User-Agent": "HackLabH-Emoji-Pack-Downloader"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def build_command_file(entries: list[tuple[str, Path]], output_file: Path) -> None:
    lines = [
        "# Comandos para subir emojis con tu bot",
        "# Formato: !emoji add <nombre> <url>",
        "",
    ]
    for name, file_path in entries:
        lines.append(f"# local: {file_path.name}")
        lines.append(f"!emoji add {name} https://TU_DOMINIO_O_CDN/{file_path.name}")
    output_file.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Descarga y prepara emojis desde GitHub.")
    parser.add_argument("--repo", default="twitter/twemoji", help="Repo GitHub, ej: twitter/twemoji")
    parser.add_argument("--branch", default="master", help="Rama, ej: master/main")
    parser.add_argument("--path", default="assets/72x72", help="Ruta dentro del repo donde están los emojis")
    parser.add_argument("--out", default="assets/emojis/twemoji", help="Carpeta de salida")
    parser.add_argument("--size", type=int, default=128, help="Tamaño objetivo (por defecto 128)")
    parser.add_argument("--limit", type=int, default=250, help="Cantidad máxima de emojis a procesar")
    parser.add_argument("--profile", choices=["all", "fun"], default="all", help="Perfil de filtrado")
    parser.add_argument("--no-resize", action="store_true", help="No redimensionar")
    parser.add_argument("--clean-out", action="store_true", help="Vaciar carpeta destino antes de guardar")
    parser.add_argument("--commands-file", default="assets/emojis/upload_commands.txt", help="Archivo de comandos sugeridos")
    args = parser.parse_args()

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.clean_out:
        for file in out_dir.glob("*"):
            if file.is_file():
                file.unlink()

    print(f"[emoji-pack] Descargando {args.repo}@{args.branch} ...")
    zip_bytes = download_github_zip(args.repo, args.branch)
    print(f"[emoji-pack] ZIP descargado ({len(zip_bytes) // 1024} KB)")

    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    prefix = f"{args.repo.split('/')[-1]}-{args.branch}/"
    wanted_prefix = f"{prefix}{args.path.strip('/')}/"

    candidates = [
        name for name in zf.namelist()
        if name.startswith(wanted_prefix)
        and not name.endswith("/")
        and Path(name).suffix.lower() in ALLOWED_EXTENSIONS
        and should_include_file(name, args.profile)
    ]

    if not candidates:
        print("[emoji-pack] No se encontraron archivos con ese filtro. Revisa --path/--profile.")
        return 1

    used_names: set[str] = set()
    processed = 0
    command_entries: list[tuple[str, Path]] = []

    for item in candidates[: max(1, args.limit)]:
        ext = Path(item).suffix.lower()
        safe_name = ensure_unique_name(sanitize_emoji_name(Path(item).name), used_names)

        data = zf.read(item)
        try:
            transformed, final_ext = maybe_resize_image(data, ext, args.size, args.no_resize)
        except RuntimeError as err:
            print(f"[emoji-pack] {err}")
            return 1

        final_name = f"{safe_name}{final_ext}"
        output_path = out_dir / final_name
        output_path.write_bytes(transformed)

        file_size_kb = output_path.stat().st_size / 1024
        if file_size_kb > 256:
            print(f"[warn] {final_name} pesa {file_size_kb:.1f} KB (>256KB)")

        command_entries.append((safe_name, output_path))
        processed += 1

    commands_path = Path(args.commands_file).resolve()
    commands_path.parent.mkdir(parents=True, exist_ok=True)
    build_command_file(command_entries, commands_path)

    print(f"[emoji-pack] Perfil: {args.profile}")
    print(f"[emoji-pack] Emojis preparados: {processed}")
    print(f"[emoji-pack] Carpeta: {out_dir}")
    print(f"[emoji-pack] Comandos sugeridos: {commands_path}")
    print("[emoji-pack] Siguiente paso: reemplaza TU_DOMINIO_O_CDN y usa !emoji add ...")
    return 0


if __name__ == "__main__":
    sys.exit(main())

