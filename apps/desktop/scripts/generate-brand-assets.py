#!/usr/bin/env python3
"""Generate every RuyiHermesAgent desktop/installer icon from one RGBA master.

The source image is intentionally kept under assets/brand so brand changes are
reproducible. Pillow is already part of the Hermes desktop bootstrap runtime;
run this script from any working directory with:

    python apps/desktop/scripts/generate-brand-assets.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image


DESKTOP_ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP_ROOT = DESKTOP_ROOT.parent / "bootstrap-installer"
SOURCE = DESKTOP_ROOT / "assets" / "brand" / "ruyi-agent-icon-keyed.png"

MASTER_SIZE = 1024
SAFE_PADDING_RATIO = 0.065
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
ICNS_SIZES = (16, 32, 64, 128, 256, 512, 1024)


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def normalized_master(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"brand source is fully transparent: {source}")

    cropped = image.crop(bbox)
    content_size = max(cropped.size)
    padding = max(1, round(content_size * SAFE_PADDING_RATIO))
    canvas_size = content_size + padding * 2
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - cropped.width) // 2, (canvas_size - cropped.height) // 2)
    canvas.alpha_composite(cropped, offset)
    return resized(canvas, MASTER_SIZE)


def save_png(image: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    resized(image, size).save(path, format="PNG", optimize=True)


def save_ico(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="ICO", sizes=[(size, size) for size in ICO_SIZES])


def save_icns(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="ICNS", sizes=[(size, size) for size in ICNS_SIZES])


def validate_png(path: Path, expected_size: int) -> None:
    with Image.open(path) as image:
        if image.format != "PNG" or image.size != (expected_size, expected_size):
            raise ValueError(f"invalid PNG {path}: format={image.format} size={image.size}")
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        if any(alpha.getpixel(point) != 0 for point in ((0, 0), (expected_size - 1, 0), (0, expected_size - 1))):
            raise ValueError(f"PNG safe-area corners are not transparent: {path}")


def validate_ico(path: Path) -> None:
    with Image.open(path) as image:
        sizes = {width for width, height in image.ico.sizes() if width == height}
    missing = set(ICO_SIZES) - sizes
    if missing:
        raise ValueError(f"ICO is missing sizes {sorted(missing)}: {path}")


def validate_icns(path: Path) -> None:
    if path.read_bytes()[:4] != b"icns":
        raise ValueError(f"ICNS magic is invalid: {path}")


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"brand source not found: {SOURCE}")

    master = normalized_master(SOURCE)

    desktop_pngs = {
        DESKTOP_ROOT / "assets" / "icon.png": 1024,
        DESKTOP_ROOT / "public" / "app-icon.png": 1024,
        DESKTOP_ROOT / "public" / "ruyi-agent-logo.png": 512,
        DESKTOP_ROOT / "public" / "apple-touch-icon.png": 180,
        DESKTOP_ROOT / "public" / "favicon-32x32.png": 32,
        DESKTOP_ROOT / "public" / "favicon-16x16.png": 16,
        BOOTSTRAP_ROOT / "public" / "ruyi-agent-logo.png": 512,
        BOOTSTRAP_ROOT / "src-tauri" / "icons" / "32x32.png": 32,
        BOOTSTRAP_ROOT / "src-tauri" / "icons" / "128x128.png": 128,
        BOOTSTRAP_ROOT / "src-tauri" / "icons" / "128x128@2x.png": 256,
    }

    for path, size in desktop_pngs.items():
        save_png(master, path, size)

    ico_paths = (
        DESKTOP_ROOT / "assets" / "icon.ico",
        DESKTOP_ROOT / "public" / "favicon.ico",
        BOOTSTRAP_ROOT / "src-tauri" / "icons" / "icon.ico",
    )
    icns_paths = (
        DESKTOP_ROOT / "assets" / "icon.icns",
        BOOTSTRAP_ROOT / "src-tauri" / "icons" / "icon.icns",
    )

    for path in ico_paths:
        save_ico(master, path)
    for path in icns_paths:
        save_icns(master, path)

    for path, size in desktop_pngs.items():
        validate_png(path, size)
    for path in ico_paths:
        validate_ico(path)
    for path in icns_paths:
        validate_icns(path)

    print(f"RuyiHermesAgent brand assets generated from {SOURCE}")
    print(f"PNG assets: {len(desktop_pngs)}; ICO assets: {len(ico_paths)}; ICNS assets: {len(icns_paths)}")


if __name__ == "__main__":
    main()
